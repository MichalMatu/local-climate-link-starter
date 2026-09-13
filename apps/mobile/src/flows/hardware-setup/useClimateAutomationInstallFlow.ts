import { useMutation } from '@tanstack/react-query';
import {
  createInstallPlan,
  hashScriptCode,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RpcShellyClient,
  RpcShellyScheduleClient,
  type RelayTestResult,
  type ShellyInstallResult
} from '@lcl/shelly-client';
import { useMemo, useState } from 'react';
import { t } from '../../app/i18n.js';
import {
  createInstalledAutomation,
  findRelayOwnerConflict,
  type InstalledAutomation
} from '../installations/model.js';
import { useInstalledAutomationStore } from '../installations/store.js';
import { findScheduleRelayConflict } from '../time-automation/scheduleOwnership.js';
import type { ClimateConfigState } from './ruleConfigDerivation.js';
import {
  cleanupStaleShellyBleDiscoveryScripts,
  createShellyTransport,
  unwrapShellyResult
} from './shellyRequests.js';
import { useHardwareSetupDraftStore, type ShellyDraftDevice } from './setupDraftStore.js';

type HardwareInstallState = {
  shellyId: string;
  scriptId: number;
  scriptHash: string;
};

type HardwareInstallMutationResult = {
  install: ShellyInstallResult;
  installation: InstalledAutomation;
  shellyDraftId: string;
};

type SafeRelayTestMutationResult = {
  install: HardwareInstallState;
  relayTest: RelayTestResult;
};

export const isHardwareInstallStateCurrent = (
  state: HardwareInstallState | null,
  shellyId: string | null,
  scriptHash: string | null
): boolean =>
  state !== null &&
  shellyId !== null &&
  scriptHash !== null &&
  state.shellyId === shellyId &&
  state.scriptHash === scriptHash;

export const useClimateAutomationInstallFlow = ({
  selectedShelly,
  configState,
  isThresholdValid,
  isVpdAssistValid,
  refreshDiagnostics
}: {
  selectedShelly: ShellyDraftDevice | null;
  configState: ClimateConfigState;
  isThresholdValid: boolean;
  isVpdAssistValid: boolean;
  refreshDiagnostics: (scriptId?: number) => void;
}) => {
  const installedAutomations = useInstalledAutomationStore(
    (state) => state.installations
  );
  const upsertInstalledAutomation = useInstalledAutomationStore(
    (state) => state.upsertInstallation
  );
  const setShellyScriptIdDraft = useHardwareSetupDraftStore(
    (state) => state.setShellyScriptId
  );
  const [lastInstallState, setLastInstallState] = useState<HardwareInstallState | null>(
    null
  );
  const [safeRelayTestState, setSafeRelayTestState] =
    useState<HardwareInstallState | null>(null);

  const currentScriptHash = useMemo(
    () =>
      configState.ok
        ? hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${configState.script}`)
        : null,
    [configState]
  );
  const selectedShellyId = selectedShelly?.id ?? null;
  const isLastInstallCurrent = isHardwareInstallStateCurrent(
    lastInstallState,
    selectedShellyId,
    currentScriptHash
  );
  const isSafeRelayTestComplete = isHardwareInstallStateCurrent(
    safeRelayTestState,
    selectedShellyId,
    currentScriptHash
  );
  const canRunSafeRelayTest = isLastInstallCurrent && !isSafeRelayTestComplete;

  const installMutation = useMutation({
    mutationFn: async (): Promise<HardwareInstallMutationResult> => {
      if (!configState.ok) {
        throw new Error(configState.error);
      }
      if (!isThresholdValid) {
        throw new Error(t('hardware.flow.thresholdOrderInvalid'));
      }
      if (!isVpdAssistValid) {
        throw new Error(t('hardware.flow.vpdInvalid'));
      }
      if (!selectedShelly) {
        throw new Error(t('hardware.flow.noSelectedShelly'));
      }

      const shelly = selectedShelly;
      const config = configState.config;
      await cleanupStaleShellyBleDiscoveryScripts(shelly.baseUrl);
      const transport = createShellyTransport(shelly.baseUrl);
      const client = new RpcShellyClient(transport);
      const scheduleClient = new RpcShellyScheduleClient(transport);
      const deviceInfo = unwrapShellyResult(await client.getDeviceInfo());
      const deviceId = deviceInfo.id?.trim();
      if (!deviceId) {
        throw new Error(t('hardware.flow.shellyIdentityMissing'));
      }
      if (
        findRelayOwnerConflict({
          installations: installedAutomations,
          deviceId,
          relayId: config.output.relayId,
          requestedKind: 'climate'
        })
      ) {
        throw new Error(t('hardware.flow.relayOwnedByTimeAutomation'));
      }
      const schedules = unwrapShellyResult(await scheduleClient.list());
      if (findScheduleRelayConflict(schedules.jobs, config.output.relayId)) {
        throw new Error(t('hardware.flow.relayOwnedByNativeSchedule'));
      }
      const install = unwrapShellyResult(
        await client.installScript(createInstallPlan(configState.script))
      );
      return {
        install,
        installation: createInstalledAutomation({
          shelly: deviceInfo,
          shellyName: shelly.name,
          baseUrl: shelly.baseUrl,
          scriptId: install.scriptId,
          scriptHash: install.scriptHash,
          config
        }),
        shellyDraftId: shelly.id
      };
    },
    onSuccess: ({ install, installation, shellyDraftId }) => {
      setShellyScriptIdDraft(shellyDraftId, String(install.scriptId));
      upsertInstalledAutomation(installation);
      setLastInstallState({
        shellyId: shellyDraftId,
        scriptId: install.scriptId,
        scriptHash: install.scriptHash
      });
      setSafeRelayTestState(null);
    }
  });

  const safeRelayTestMutation = useMutation({
    mutationFn: async (): Promise<SafeRelayTestMutationResult> => {
      if (!selectedShelly) {
        throw new Error(t('hardware.flow.noSelectedShelly'));
      }
      if (!isLastInstallCurrent || !lastInstallState) {
        throw new Error(t('hardware.flow.installFirst'));
      }
      const client = new RpcShellyClient(createShellyTransport(selectedShelly.baseUrl));
      const relayTest = unwrapShellyResult(await client.safeRelayTest());
      if (relayTest.finalRelayOn) {
        throw new Error(t('hardware.flow.relayOffNotConfirmed'));
      }
      return {
        install: lastInstallState,
        relayTest
      };
    },
    onSuccess: ({ install }) => {
      setSafeRelayTestState(install);
      refreshDiagnostics(install.scriptId);
    }
  });

  const resetInstallState = () => {
    setLastInstallState(null);
    setSafeRelayTestState(null);
  };

  return {
    canRunSafeRelayTest,
    installMutation,
    safeRelayTestMutation,
    resetInstallState
  };
};

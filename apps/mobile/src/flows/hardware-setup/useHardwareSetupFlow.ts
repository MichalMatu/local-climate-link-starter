import { useMutation } from '@tanstack/react-query';
import type { RulePresetId } from '@lcl/automation-core';
import {
  decodeShellyThermostatScript,
  type DecodedShellyThermostatScript
} from '@lcl/script-generator';
import { LOCAL_CLIMATE_LINK_SCRIPT_NAME } from '@lcl/shelly-client';
import { useMemo, useState } from 'react';
import { t } from '../../app/i18n.js';
import type { HardwareSetupStatus } from './schemas.js';
import {
  readShellyAutomationScriptState,
  readShellySetupStatus,
  type ShellyAutomationScriptState
} from './shellyRequests.js';
import { useHardwareSetupDraftStore, type ShellyDraftDevice } from './setupDraftStore.js';
import { DEFAULT_RULE_ADVANCED_SETTINGS } from './ruleAdvancedSettings.js';
import {
  deriveClimateRuleState,
  deriveShellyInputState
} from './ruleConfigDerivation.js';
import { useClimateAutomationInstallFlow } from './useClimateAutomationInstallFlow.js';
import { useSensorSetupFlow } from './usePhoneSensorFlow.js';
import { useShellyBleDiscoveryFlow } from './useShellyBleDiscoveryFlow.js';
import { useShellySetupScanFlow } from './useShellySetupScanFlow.js';
import {
  shellyControlStatusFromSetupStatus,
  useShellyControlFlow
} from './useShellyControlFlow.js';

type ShellyCheckMutationInput = {
  baseUrl: string;
  name: string;
};

type ShellyCheckMutationResult = HardwareSetupStatus & {
  checkedDevice: ShellyDraftDevice;
};

type LoadedShellyAutomationScriptState = Omit<
  ShellyAutomationScriptState,
  'script' | 'code'
> & {
  script: NonNullable<ShellyAutomationScriptState['script']>;
  code: string;
};

type ShellyAutomationScriptLoadMutationResult = {
  device: ShellyDraftDevice;
  state: LoadedShellyAutomationScriptState;
  decoded: DecodedShellyThermostatScript;
};

const numberInput = (value: number): string => String(Number(value.toFixed(4)));

export const useHardwareSetupFlow = () => {
  const shellyNameInput = useHardwareSetupDraftStore((state) => state.shellyNameInput);
  const setShellyNameInput = useHardwareSetupDraftStore(
    (state) => state.setShellyNameInput
  );
  const shellyUrlInput = useHardwareSetupDraftStore((state) => state.shellyUrlInput);
  const setShellyUrlInputDraft = useHardwareSetupDraftStore(
    (state) => state.setShellyUrlInput
  );
  const shellyDevices = useHardwareSetupDraftStore((state) => state.shellyDevices);
  const selectedShellyId = useHardwareSetupDraftStore((state) => state.selectedShellyId);
  const selectShellyDeviceDraft = useHardwareSetupDraftStore(
    (state) => state.selectShellyDevice
  );
  const setShellyDeviceName = useHardwareSetupDraftStore(
    (state) => state.setShellyDeviceName
  );
  const setShellyDeviceMetadata = useHardwareSetupDraftStore(
    (state) => state.setShellyDeviceMetadata
  );
  const setShellyScriptIdDraft = useHardwareSetupDraftStore(
    (state) => state.setShellyScriptId
  );
  const removeShellyDeviceDraft = useHardwareSetupDraftStore(
    (state) => state.removeShellyDevice
  );
  const upsertShellyDevice = useHardwareSetupDraftStore(
    (state) => state.upsertShellyDevice
  );
  const selectedSensorId = useHardwareSetupDraftStore((state) => state.selectedSensorId);
  const selectSensorDeviceDraft = useHardwareSetupDraftStore(
    (state) => state.selectSensorDevice
  );
  const rulePreset = useHardwareSetupDraftStore((state) => state.rulePreset);
  const setRulePreset = useHardwareSetupDraftStore((state) => state.setRulePreset);
  const onThresholdInput = useHardwareSetupDraftStore((state) => state.onThresholdInput);
  const setOnThresholdInput = useHardwareSetupDraftStore(
    (state) => state.setOnThresholdInput
  );
  const offThresholdInput = useHardwareSetupDraftStore(
    (state) => state.offThresholdInput
  );
  const setOffThresholdInput = useHardwareSetupDraftStore(
    (state) => state.setOffThresholdInput
  );
  const vpdAssistEnabled = useHardwareSetupDraftStore((state) => state.vpdAssistEnabled);
  const setVpdAssistEnabled = useHardwareSetupDraftStore(
    (state) => state.setVpdAssistEnabled
  );
  const vpdTargetInput = useHardwareSetupDraftStore((state) => state.vpdTargetInput);
  const setVpdTargetInput = useHardwareSetupDraftStore(
    (state) => state.setVpdTargetInput
  );
  const rssiMinInput = useHardwareSetupDraftStore((state) => state.rssiMinInput);
  const setRssiMinInput = useHardwareSetupDraftStore((state) => state.setRssiMinInput);
  const staleTimeoutMinInput = useHardwareSetupDraftStore(
    (state) => state.staleTimeoutMinInput
  );
  const setStaleTimeoutMinInput = useHardwareSetupDraftStore(
    (state) => state.setStaleTimeoutMinInput
  );
  const minChangeMinInput = useHardwareSetupDraftStore(
    (state) => state.minChangeMinInput
  );
  const setMinChangeMinInput = useHardwareSetupDraftStore(
    (state) => state.setMinChangeMinInput
  );
  const maxOnHoursInput = useHardwareSetupDraftStore((state) => state.maxOnHoursInput);
  const setMaxOnHoursInput = useHardwareSetupDraftStore(
    (state) => state.setMaxOnHoursInput
  );
  const [setupStatus, setSetupStatus] = useState<HardwareSetupStatus | null>(null);
  const { upsertSensorDevice, ...sensorSetupFlow } = useSensorSetupFlow();
  const { sensorDevices } = sensorSetupFlow;

  const {
    shellyControlStates,
    refreshShellyControl,
    acknowledgeShellyControlFeedback,
    applyControlStatus,
    applyControlError,
    removeShellyControlState
  } = useShellyControlFlow();
  const {
    bleDiscoverySession,
    bleDiscoverySnapshot,
    startBleDiscoveryMutation,
    refreshBleDiscoveryMutation,
    restartBleDiscoveryMutation,
    stopBleDiscoveryMutation,
    startBleDiscovery,
    refreshBleDiscovery,
    restartBleDiscovery,
    stopBleDiscovery,
    cleanupBleDiscovery,
    resetBleDiscovery
  } = useShellyBleDiscoveryFlow();
  const {
    shellyScanStartInput,
    setShellyScanStartInput,
    shellyScanEndInput,
    setShellyScanEndInput,
    shellyScanStopped,
    shellyScanResults,
    shellyScanMutation,
    startShellyScan,
    stopShellyScan,
    resetShellyScan
  } = useShellySetupScanFlow();

  const updateShellyUrlInput = (value: string) => {
    setShellyUrlInputDraft(value);
    setSetupStatus(null);
  };

  const selectedShelly = useMemo(
    () => shellyDevices.find((device) => device.id === selectedShellyId) ?? null,
    [selectedShellyId, shellyDevices]
  );
  const selectedSensor = useMemo(
    () => sensorDevices.find((device) => device.id === selectedSensorId) ?? null,
    [selectedSensorId, sensorDevices]
  );
  const shellyBaseUrl = useMemo(() => {
    return selectedShelly?.baseUrl ?? null;
  }, [selectedShelly]);
  const shellyInputState = useMemo(
    () => deriveShellyInputState({ shellyNameInput, shellyUrlInput }),
    [shellyNameInput, shellyUrlInput]
  );

  const { advancedSettingsValidation, configState, isThresholdValid, isVpdAssistValid } =
    useMemo(
      () =>
        deriveClimateRuleState({
          selectedSensor,
          rulePreset,
          onThresholdInput,
          offThresholdInput,
          vpdAssistEnabled,
          vpdTargetInput,
          rssiMinInput,
          staleTimeoutMinInput,
          minChangeMinInput,
          maxOnHoursInput
        }),
      [
        maxOnHoursInput,
        minChangeMinInput,
        offThresholdInput,
        onThresholdInput,
        rssiMinInput,
        rulePreset,
        selectedSensor,
        staleTimeoutMinInput,
        vpdAssistEnabled,
        vpdTargetInput
      ]
    );

  const {
    canRunSafeRelayTest,
    installMutation,
    safeRelayTestMutation,
    resetInstallState
  } = useClimateAutomationInstallFlow({
    selectedShelly,
    configState,
    isThresholdValid,
    isVpdAssistValid
  });

  const checkShellyMutation = useMutation({
    mutationFn: async (
      input?: ShellyCheckMutationInput
    ): Promise<ShellyCheckMutationResult> => {
      const inputState = input
        ? deriveShellyInputState({
            shellyNameInput: input.name,
            shellyUrlInput: input.baseUrl
          })
        : shellyInputState;
      if (!inputState.ok) {
        throw new Error(
          inputState.fieldErrors.url ??
            inputState.fieldErrors.name ??
            t('hardware.flow.fixShellyData')
        );
      }
      const { baseUrl, name } = inputState;
      const status = await readShellySetupStatus(baseUrl);
      const existingScript = status.scripts.find(
        (script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME
      );
      return {
        ...status,
        checkedDevice: {
          id: baseUrl,
          name,
          baseUrl,
          scriptIdInput: existingScript ? String(existingScript.id) : '1',
          model: status.deviceInfo.model,
          gen: status.deviceInfo.gen
        }
      };
    },
    onSuccess: (status) => {
      setSetupStatus(status);
      upsertShellyDevice(status.checkedDevice);
      applyControlStatus(
        status.checkedDevice,
        shellyControlStatusFromSetupStatus(status),
        null
      );
    },
    onError: () => {
      setSetupStatus(null);
    }
  });

  const recheckShellyMutation = useMutation({
    mutationFn: async (device: ShellyDraftDevice): Promise<HardwareSetupStatus> =>
      readShellySetupStatus(device.baseUrl),
    onSuccess: (status, device) => {
      setSetupStatus(status);
      setShellyDeviceMetadata(device.id, {
        model: status.deviceInfo.model,
        gen: status.deviceInfo.gen
      });
      applyControlStatus(device, shellyControlStatusFromSetupStatus(status), null);
    },
    onError: () => {
      setSetupStatus(null);
    }
  });

  const loadAutomationScriptMutation = useMutation({
    mutationFn: async (
      device: ShellyDraftDevice
    ): Promise<ShellyAutomationScriptLoadMutationResult> => {
      const state = await readShellyAutomationScriptState(device.baseUrl);
      if (!state.script || !state.code) {
        throw new Error(t('hardware.rule.loadScriptMissing'));
      }
      const script = state.script;
      const code = state.code;

      const decoded = decodeShellyThermostatScript(code);
      if (!decoded) {
        throw new Error(t('hardware.rule.loadScriptUnknown'));
      }

      return { device, state: { ...state, script, code }, decoded };
    },
    onSuccess: ({ device, state, decoded }) => {
      const settings = decoded.settings;
      setShellyScriptIdDraft(device.id, String(state.script.id));
      upsertSensorDevice({
        id: settings.runtimeAddress,
        name: settings.sensorDisplayName,
        runtimeAddress: settings.runtimeAddress,
        profileId: settings.sensorProfileId
      });
      setRulePreset(settings.mode);
      setOnThresholdInput(numberInput(settings.control.onThreshold));
      setOffThresholdInput(numberInput(settings.control.offThreshold));
      setVpdAssistEnabled(settings.vpdAssist.enabled);
      setVpdTargetInput(
        settings.vpdAssist.targetKpa === null
          ? DEFAULT_RULE_ADVANCED_SETTINGS.vpdTargetInput
          : numberInput(settings.vpdAssist.targetKpa)
      );
      setRssiMinInput(String(settings.rssiMin));
      setStaleTimeoutMinInput(numberInput(settings.staleTimeoutSec / 60));
      setMinChangeMinInput(numberInput(settings.minChangeMs / 60_000));
      setMaxOnHoursInput(numberInput(settings.maxOnMs / 3_600_000));
      resetInstallState();
      applyControlStatus(device, state.status, null);
    },
    onError: (error, device) => applyControlError(device, error)
  });

  const loadAutomationScript = (device: ShellyDraftDevice) => {
    loadAutomationScriptMutation.mutate(device);
  };

  const selectShellyDevice = (id: string) => {
    selectShellyDeviceDraft(id);
    setSetupStatus(null);
    resetInstallState();
  };

  const selectSensorDevice = (id: string) => {
    selectSensorDeviceDraft(id);
    resetInstallState();
  };

  const removeShellyDevice = (id: string) => {
    removeShellyDeviceDraft(id);
    removeShellyControlState(id);
    setSetupStatus(null);
    resetInstallState();
  };

  const removeSensorDevice = (id: string) => {
    sensorSetupFlow.removeSensorDevice(id);
    resetInstallState();
  };

  return {
    shellyNameInput,
    setShellyNameInput,
    shellyUrlInput,
    setShellyUrlInput: updateShellyUrlInput,
    shellyInputState,
    shellyDevices,
    selectedShellyId,
    selectedShelly,
    selectShellyDevice,
    setShellyDeviceName,
    upsertShellyDevice,
    removeShellyDevice,
    ...sensorSetupFlow,
    selectedSensorId,
    selectedSensor,
    selectSensorDevice,
    removeSensorDevice,
    rulePreset,
    setRulePreset: (value: RulePresetId) => setRulePreset(value),
    onThresholdInput,
    setOnThresholdInput,
    offThresholdInput,
    setOffThresholdInput,
    vpdAssistEnabled,
    setVpdAssistEnabled,
    vpdTargetInput,
    setVpdTargetInput,
    rssiMinInput,
    setRssiMinInput,
    staleTimeoutMinInput,
    setStaleTimeoutMinInput,
    minChangeMinInput,
    setMinChangeMinInput,
    maxOnHoursInput,
    setMaxOnHoursInput,
    isAdvancedSettingsValid: advancedSettingsValidation.isValid,
    shellyBaseUrl,
    configState,
    isThresholdValid,
    isVpdAssistValid,
    canRunSafeRelayTest,
    setupStatus,
    checkShellyMutation,
    recheckShellyMutation,
    shellyScanStartInput,
    setShellyScanStartInput,
    shellyScanEndInput,
    setShellyScanEndInput,
    shellyScanStopped,
    shellyScanResults,
    shellyScanMutation,
    startShellyScan,
    stopShellyScan,
    resetShellyScan,
    shellyControlStates,
    loadAutomationScriptMutation,
    refreshShellyControl,
    acknowledgeShellyControlFeedback,
    loadAutomationScript,
    bleDiscoverySession,
    bleDiscoverySnapshot,
    startBleDiscoveryMutation,
    refreshBleDiscoveryMutation,
    restartBleDiscoveryMutation,
    stopBleDiscoveryMutation,
    startBleDiscovery,
    refreshBleDiscovery,
    restartBleDiscovery,
    stopBleDiscovery,
    cleanupBleDiscovery,
    resetBleDiscovery,
    installMutation,
    safeRelayTestMutation
  };
};

export type HardwareSetupFlow = ReturnType<typeof useHardwareSetupFlow>;

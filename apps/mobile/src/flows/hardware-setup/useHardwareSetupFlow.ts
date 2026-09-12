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
  deleteShellyAutomationScript,
  readShellyAutomationScriptState,
  readShellySetupStatus,
  type ShellyAutomationScriptState,
  type ShellyControlStatus
} from './shellyRequests.js';
import { useHardwareSetupDraftStore, type ShellyDraftDevice } from './setupDraftStore.js';
import { useHardwareSetupReadingsStore } from './sensorReadingsStore.js';
import { DEFAULT_RULE_ADVANCED_SETTINGS } from './ruleAdvancedSettings.js';
import {
  deriveClimateRuleState,
  deriveSensorInputState,
  deriveShellyInputState
} from './ruleConfigDerivation.js';
import { useClimateAutomationInstallFlow } from './useClimateAutomationInstallFlow.js';
import { useHardwareDiagnosticsFlow } from './useHardwareDiagnosticsFlow.js';
import { usePhoneSensorFlow } from './usePhoneSensorFlow.js';
import { useShellyBleDiscoveryFlow } from './useShellyBleDiscoveryFlow.js';
import { useShellySetupScanFlow } from './useShellySetupScanFlow.js';
import {
  shellyControlStatusFromSetupStatus,
  useShellyControlFlow
} from './useShellyControlFlow.js';

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

type ShellyAutomationDeleteMutationResult = {
  device: ShellyDraftDevice;
  status: ShellyControlStatus;
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
  const setShellyScriptIdDraft = useHardwareSetupDraftStore(
    (state) => state.setShellyScriptId
  );
  const removeShellyDeviceDraft = useHardwareSetupDraftStore(
    (state) => state.removeShellyDevice
  );
  const upsertShellyDevice = useHardwareSetupDraftStore(
    (state) => state.upsertShellyDevice
  );
  const sensorMacInput = useHardwareSetupDraftStore((state) => state.sensorMacInput);
  const setSensorMacInput = useHardwareSetupDraftStore(
    (state) => state.setSensorMacInput
  );
  const sensorProfileInput = useHardwareSetupDraftStore(
    (state) => state.sensorProfileInput
  );
  const setSensorProfileInput = useHardwareSetupDraftStore(
    (state) => state.setSensorProfileInput
  );
  const sensorNameInput = useHardwareSetupDraftStore((state) => state.sensorNameInput);
  const setSensorNameInput = useHardwareSetupDraftStore(
    (state) => state.setSensorNameInput
  );
  const sensorDevices = useHardwareSetupDraftStore((state) => state.sensorDevices);
  const selectedSensorId = useHardwareSetupDraftStore((state) => state.selectedSensorId);
  const selectSensorDeviceDraft = useHardwareSetupDraftStore(
    (state) => state.selectSensorDevice
  );
  const setSensorDeviceName = useHardwareSetupDraftStore(
    (state) => state.setSensorDeviceName
  );
  const removeSensorDeviceDraft = useHardwareSetupDraftStore(
    (state) => state.removeSensorDevice
  );
  const upsertSensorDevice = useHardwareSetupDraftStore(
    (state) => state.upsertSensorDevice
  );
  const diagnosticShellyId = useHardwareSetupDraftStore(
    (state) => state.diagnosticShellyId
  );
  const setDiagnosticShellyIdDraft = useHardwareSetupDraftStore(
    (state) => state.setDiagnosticShellyId
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
  const sensorSamplesById = useHardwareSetupReadingsStore(
    (state) => state.samplesBySensorId
  );
  const clearSensorReadings = useHardwareSetupReadingsStore(
    (state) => state.clearSensorReadings
  );
  const [setupStatus, setSetupStatus] = useState<HardwareSetupStatus | null>(null);

  const {
    shellyControlStates,
    refreshShellyControl,
    turnRelayOn,
    turnRelayOff,
    setAutomationAuto,
    setAutomationManual,
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
    phoneBleScanCandidates,
    phoneBleScanMutation,
    startPhoneBleScan,
    stopPhoneBleScan,
    resetPhoneBleScan,
    savedSensorLiveScanState,
    startSavedSensorLiveScan,
    restartSavedSensorLiveScan,
    stopSavedSensorLiveScan,
    addDiscoveredSensor,
    setPvvxTimeMutation
  } = usePhoneSensorFlow(sensorDevices);
  const {
    shellyScanStartInput,
    setShellyScanStartInput,
    shellyScanEndInput,
    setShellyScanEndInput,
    shellyScanStopped,
    shellyScanMutation,
    startShellyScan,
    stopShellyScan,
    resetShellyScan
  } = useShellySetupScanFlow(shellyDevices);

  const updateShellyUrlInput = (value: string) => {
    setShellyUrlInputDraft(value);
    setSetupStatus(null);
    clearDiagnosticSnapshot();
  };

  const selectedShelly = useMemo(
    () => shellyDevices.find((device) => device.id === selectedShellyId) ?? null,
    [selectedShellyId, shellyDevices]
  );
  const selectedSensor = useMemo(
    () => sensorDevices.find((device) => device.id === selectedSensorId) ?? null,
    [selectedSensorId, sensorDevices]
  );
  const diagnosticShelly = useMemo(
    () => shellyDevices.find((device) => device.id === diagnosticShellyId) ?? null,
    [diagnosticShellyId, shellyDevices]
  );
  const {
    diagnosticSnapshot,
    diagnosticResources,
    diagnosticFetchedAtMs,
    clearDiagnosticSnapshot,
    diagnosticMutation,
    diagnosticResourceMutation,
    refreshDiagnostics
  } = useHardwareDiagnosticsFlow(diagnosticShelly);
  const shellyBaseUrl = useMemo(() => {
    return selectedShelly?.baseUrl ?? null;
  }, [selectedShelly]);
  const shellyInputState = useMemo(
    () => deriveShellyInputState({ shellyNameInput, shellyUrlInput }),
    [shellyNameInput, shellyUrlInput]
  );

  const sensorInputState = useMemo(
    () =>
      deriveSensorInputState({
        sensorMacInput,
        sensorNameInput,
        sensorProfileInput
      }),
    [sensorMacInput, sensorNameInput, sensorProfileInput]
  );

  const addSensorDraft = () => {
    if (sensorInputState.ok) {
      upsertSensorDevice(sensorInputState.device);
    }
  };

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
    isVpdAssistValid,
    refreshDiagnostics
  });

  const checkShellyMutation = useMutation({
    mutationFn: async (): Promise<ShellyCheckMutationResult> => {
      if (!shellyInputState.ok) {
        throw new Error(
          shellyInputState.fieldErrors.url ??
            shellyInputState.fieldErrors.name ??
            t('hardware.flow.fixShellyData')
        );
      }
      const { baseUrl, name } = shellyInputState;
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
          scriptIdInput: existingScript ? String(existingScript.id) : '1'
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
      clearDiagnosticSnapshot();
      applyControlStatus(device, state.status, null);
    },
    onError: (error, device) => applyControlError(device, error)
  });

  const deleteAutomationScriptMutation = useMutation({
    mutationFn: async (
      device: ShellyDraftDevice
    ): Promise<ShellyAutomationDeleteMutationResult> => ({
      device,
      status: await deleteShellyAutomationScript(device.baseUrl)
    }),
    onSuccess: ({ device, status }) => {
      setShellyScriptIdDraft(device.id, '1');
      applyControlStatus(device, status, t('hardware.flow.scriptDeleted'));
    },
    onError: (error, device) => applyControlError(device, error)
  });

  const loadAutomationScript = (device: ShellyDraftDevice) => {
    loadAutomationScriptMutation.mutate(device);
  };

  const deleteAutomationScript = (device: ShellyDraftDevice) => {
    deleteAutomationScriptMutation.mutate(device);
  };

  const selectShellyDevice = (id: string) => {
    selectShellyDeviceDraft(id);
    setSetupStatus(null);
    clearDiagnosticSnapshot();
    resetInstallState();
  };

  const selectSensorDevice = (id: string) => {
    selectSensorDeviceDraft(id);
    clearDiagnosticSnapshot();
    resetInstallState();
  };

  const setDiagnosticShellyId = (id: string) => {
    setDiagnosticShellyIdDraft(id);
    clearDiagnosticSnapshot();
  };

  const removeShellyDevice = (id: string) => {
    removeShellyDeviceDraft(id);
    removeShellyControlState(id);
    setSetupStatus(null);
    clearDiagnosticSnapshot();
    resetInstallState();
  };

  const removeSensorDevice = (id: string) => {
    removeSensorDeviceDraft(id);
    clearSensorReadings(id);
    clearDiagnosticSnapshot();
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
    sensorProfileInput,
    setSensorProfileInput,
    sensorMacInput,
    setSensorMacInput,
    sensorNameInput,
    setSensorNameInput,
    sensorDevices,
    sensorSamplesById,
    selectedSensorId,
    selectedSensor,
    sensorInputState,
    addSensorDraft,
    selectSensorDevice,
    setSensorDeviceName,
    removeSensorDevice,
    diagnosticShellyId,
    setDiagnosticShellyId,
    diagnosticShelly,
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
    diagnosticSnapshot,
    diagnosticResources,
    diagnosticFetchedAtMs,
    checkShellyMutation,
    recheckShellyMutation,
    shellyScanStartInput,
    setShellyScanStartInput,
    shellyScanEndInput,
    setShellyScanEndInput,
    shellyScanStopped,
    shellyScanMutation,
    startShellyScan,
    stopShellyScan,
    resetShellyScan,
    shellyControlStates,
    loadAutomationScriptMutation,
    deleteAutomationScriptMutation,
    refreshShellyControl,
    turnRelayOn,
    turnRelayOff,
    setAutomationAuto,
    setAutomationManual,
    acknowledgeShellyControlFeedback,
    loadAutomationScript,
    deleteAutomationScript,
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
    phoneBleScanCandidates,
    phoneBleScanMutation,
    startPhoneBleScan,
    stopPhoneBleScan,
    resetPhoneBleScan,
    savedSensorLiveScanState,
    startSavedSensorLiveScan,
    restartSavedSensorLiveScan,
    stopSavedSensorLiveScan,
    addDiscoveredSensor,
    setPvvxTimeMutation,
    installMutation,
    safeRelayTestMutation,
    diagnosticMutation,
    diagnosticResourceMutation,
    refreshDiagnostics
  };
};

export type HardwareSetupFlow = ReturnType<typeof useHardwareSetupFlow>;

import type { RulePresetId } from '@lcl/automation-core';
import { useMemo } from 'react';
import {
  DEFAULT_RULE_ADVANCED_SETTINGS,
  useClimateAutomationScriptLoadFlow
} from '../../features/automations/index.js';
import { useHardwareSetupDraftStore } from './setupDraftStore.js';
import {
  deriveClimateRuleState,
  deriveShellyInputState
} from './ruleConfigDerivation.js';
import { useClimateAutomationInstallFlow } from './useClimateAutomationInstallFlow.js';
import { useSensorSetupFlow } from './usePhoneSensorFlow.js';
import { useShellyBleDiscoveryFlow } from './useShellyBleDiscoveryFlow.js';
import { useShellySetupScanFlow } from './useShellySetupScanFlow.js';
import { useShellyControlFlow } from './useShellyControlFlow.js';

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
  const { upsertSensorDevice, ...sensorSetupFlow } = useSensorSetupFlow();
  const { sensorDevices } = sensorSetupFlow;

  const {
    setupStatus,
    checkShellyMutation,
    recheckShellyMutation,
    resetShellySetupStatus,
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
    resetShellySetupStatus();
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

  const { loadAutomationScriptMutation, loadAutomationScript } =
    useClimateAutomationScriptLoadFlow({
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

  const selectShellyDevice = (id: string) => {
    selectShellyDeviceDraft(id);
    resetShellySetupStatus();
    resetInstallState();
  };

  const selectSensorDevice = (id: string) => {
    selectSensorDeviceDraft(id);
    resetInstallState();
  };

  const removeShellyDevice = (id: string) => {
    removeShellyDeviceDraft(id);
    removeShellyControlState(id);
    resetShellySetupStatus();
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

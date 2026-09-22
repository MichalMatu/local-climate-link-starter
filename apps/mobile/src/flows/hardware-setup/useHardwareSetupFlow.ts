import type { RulePresetId } from '@lcl/automation-core';
import { useMemo } from 'react';
import { useHardwareSetupDraftStore } from './setupDraftStore.js';
import {
  deriveClimateRuleState,
  deriveShellyInputState
} from './ruleConfigDerivation.js';
import { useClimateAutomationInstallFlow } from './useClimateAutomationInstallFlow.js';
import { useClimateAutomationScriptLoadDraftFlow } from '../../features/automations/index.js';
import { useSensorSetupFlow } from './usePhoneSensorFlow.js';
import { useShellyBleDiscoveryFlow } from './useShellyBleDiscoveryFlow.js';
import { useShellySetupScanFlow } from './useShellySetupScanFlow.js';
import { useShellyControlFlow } from './useShellyControlFlow.js';

export const useHardwareSetupFlow = (editInstallationId?: string) => {
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
  const additionalSensorIds = useHardwareSetupDraftStore(
    (state) => state.additionalSensorIds
  );
  const inheritedSensorIds = useHardwareSetupDraftStore(
    (state) => state.inheritedSensorIds
  );
  const toggleAdditionalSensorDeviceDraft = useHardwareSetupDraftStore(
    (state) => state.toggleAdditionalSensorDevice
  );
  const sensorAggregation = useHardwareSetupDraftStore(
    (state) => state.sensorAggregation
  );
  const setSensorAggregationDraft = useHardwareSetupDraftStore(
    (state) => state.setSensorAggregation
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
  const additionalSensors = useMemo(
    () =>
      additionalSensorIds
        .map((id) => sensorDevices.find((device) => device.id === id) ?? null)
        .filter((device): device is (typeof sensorDevices)[number] => device !== null),
    [additionalSensorIds, sensorDevices]
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
          additionalSensors,
          sensorAggregation,
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
        additionalSensors,
        maxOnHoursInput,
        minChangeMinInput,
        offThresholdInput,
        onThresholdInput,
        rssiMinInput,
        rulePreset,
        selectedSensor,
        sensorAggregation,
        staleTimeoutMinInput,
        vpdAssistEnabled,
        vpdTargetInput
      ]
    );

  const {
    canRunSafeRelayTest,
    isEditingClimateAutomation,
    installMutation,
    safeRelayTestMutation,
    resetInstallState
  } = useClimateAutomationInstallFlow({
    selectedShelly,
    configState,
    isThresholdValid,
    isVpdAssistValid,
    ...(editInstallationId ? { editInstallationId } : {})
  });

  const { loadAutomationScriptMutation, loadAutomationScript } =
    useClimateAutomationScriptLoadDraftFlow({
      getDraftActions: useHardwareSetupDraftStore.getState,
      upsertSensorDevice,
      resetInstallState,
      applyControlStatus,
      applyControlError
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

  const toggleAdditionalSensorDevice = (id: string) => {
    toggleAdditionalSensorDeviceDraft(id);
    resetInstallState();
  };

  const updateSensorAggregation = (value: typeof sensorAggregation) => {
    setSensorAggregationDraft(value);
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
    additionalSensorIds,
    inheritedSensorIds,
    additionalSensors,
    selectSensorDevice,
    toggleAdditionalSensorDevice,
    sensorAggregation,
    setSensorAggregation: updateSensorAggregation,
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
    isEditingClimateAutomation,
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

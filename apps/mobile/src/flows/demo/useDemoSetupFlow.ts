import { useMutation } from '@tanstack/react-query';
import { createDemoParsedSensors } from '@lcl/ble-core';
import { exportSupportSummary, InMemoryDiagnosticLogger } from '@lcl/diagnostics';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import {
  FakeShellyClient,
  createInstallPlan,
  type ShellyStatus
} from '@lcl/shelly-client';
import { useMemo, useRef, useState } from 'react';
import { getDemoBlePermissionStatus } from '../../permissions/blePermissions.js';
import { useSetupDraftStore, type DemoSensorChoice } from './setupDraftStore.js';

export type DemoStep =
  'start' | 'sensor' | 'shelly' | 'rule' | 'script' | 'install' | 'relay' | 'done';

type AsyncState = 'empty' | 'loading' | 'success' | 'error';

const DEMO_RUNTIME_ADDRESSES: Record<DemoSensorChoice, string> = {
  xiaomi_lywsd03mmc_bthome_v2: 'AA:BB:CC:DD:EE:FF',
  tp357_custom_v1: '11:22:33:44:55:66'
};

export const useDemoSetupFlow = () => {
  const [step, setStep] = useState<DemoStep>('start');
  const [sensorState, setSensorState] = useState<AsyncState>('empty');
  const [shellyState, setShellyState] = useState<AsyncState>('empty');
  const [shellyStatus, setShellyStatus] = useState<ShellyStatus | null>(null);
  const [matterBlockedScenario, setMatterBlockedScenarioState] = useState(false);
  const [matterBlockedVisible, setMatterBlockedVisible] = useState(false);
  const [relayFinalOff, setRelayFinalOff] = useState(false);
  const [diagnosticsVersion, setDiagnosticsVersion] = useState(0);
  const sensors = useMemo(() => createDemoParsedSensors(1_720_000_000_000), []);
  const shellyClientRef = useRef(
    new FakeShellyClient({ sleepMs: () => Promise.resolve() })
  );
  const blockedShellyClientRef = useRef(new FakeShellyClient({ matterEnabled: true }));
  const diagnosticsRef = useRef(new InMemoryDiagnosticLogger(80));
  const {
    selectedSensorProfileId,
    onThreshold,
    offThreshold,
    setSelectedSensorProfileId,
    setOnThreshold,
    setOffThreshold
  } = useSetupDraftStore();

  const firstSensor = sensors[0];
  if (firstSensor === undefined) {
    throw new Error('Demo sensors unavailable.');
  }
  const selectedSensor =
    sensors.find((sensor) => sensor.profileId === selectedSensorProfileId) ?? firstSensor;
  const runtimeAddress = DEMO_RUNTIME_ADDRESSES[selectedSensorProfileId];
  const isThresholdValid = onThreshold < offThreshold;

  const config: ShellyThermostatConfig = useMemo(() => {
    const nextConfig = createDefaultShellyThermostatConfig(selectedSensorProfileId);
    return {
      ...nextConfig,
      sensor: {
        ...nextConfig.sensor,
        sensorId: selectedSensor.measurement.sensorId,
        runtimeAddress
      },
      rule: {
        ...nextConfig.rule,
        control: {
          ...nextConfig.rule.control,
          onThreshold,
          offThreshold
        }
      }
    };
  }, [
    offThreshold,
    onThreshold,
    runtimeAddress,
    selectedSensor.measurement.sensorId,
    selectedSensorProfileId
  ]);

  const script = useMemo(
    () => (isThresholdValid ? generateShellyThermostatScript(config) : ''),
    [config, isThresholdValid]
  );

  const refreshDiagnostics = () => setDiagnosticsVersion((value) => value + 1);

  const setMatterBlockedScenario = (value: boolean) => {
    setMatterBlockedScenarioState(value);
    setMatterBlockedVisible(false);
    setShellyStatus(null);
    setShellyState('empty');
  };

  const installMutation = useMutation({
    mutationFn: async () =>
      shellyClientRef.current.installScript(createInstallPlan(script)),
    onSuccess: (result) => {
      diagnosticsRef.current.add({
        kind: 'script-upload',
        severity: result.ok ? 'info' : 'error',
        message: result.ok ? 'Fake script upload succeeded.' : result.error.kind
      });
      refreshDiagnostics();
      if (result.ok) {
        setStep('relay');
      }
    }
  });

  const relayMutation = useMutation({
    mutationFn: async () => shellyClientRef.current.safeRelayTest({ onDurationMs: 0 }),
    onSuccess: (result) => {
      const finalOff = result.ok && !result.value.finalRelayOn;
      setRelayFinalOff(finalOff);
      diagnosticsRef.current.add({
        kind: 'relay-test',
        severity: finalOff ? 'info' : 'error',
        message: finalOff
          ? 'Fake relay test ended OFF.'
          : 'Relay test did not confirm OFF.'
      });
      refreshDiagnostics();
      setStep('done');
    }
  });

  const start = () => {
    diagnosticsRef.current.add({
      kind: 'setup-started',
      severity: 'info',
      message: 'Demo setup started.'
    });
    refreshDiagnostics();
    setStep('sensor');
  };

  const scanSensors = async () => {
    setSensorState('loading');
    await Promise.resolve();
    setSensorState('success');
    diagnosticsRef.current.add({
      kind: 'sensor-reading',
      severity: 'info',
      message: 'Demo Xiaomi and TP357 readings are visible.',
      fields: { count: sensors.length }
    });
    refreshDiagnostics();
  };

  const checkShelly = async () => {
    setShellyState('loading');
    const activeClient = matterBlockedScenario
      ? blockedShellyClientRef.current
      : shellyClientRef.current;
    const status = await activeClient.getStatus();
    setShellyStatus(status.ok ? status.value : null);
    setMatterBlockedVisible(Boolean(status.ok && status.value.matterEnabled));
    setShellyState(status.ok ? 'success' : 'error');
    diagnosticsRef.current.add({
      kind: status.ok && status.value.matterEnabled ? 'matter-blocked' : 'shelly-status',
      severity: status.ok && status.value.matterEnabled ? 'warning' : 'info',
      message:
        status.ok && status.value.matterEnabled
          ? 'Demo Matter blocked state shown.'
          : 'Fake Shelly is compatible.',
      fields: { runtimeAddress, simulatedRuntimeAddress: true }
    });
    refreshDiagnostics();
  };

  const diagnostics = useMemo(() => diagnosticsRef.current.list(), [diagnosticsVersion]);
  const supportSummary = useMemo(
    () =>
      exportSupportSummary({
        appVersion: '0.1.0',
        platform: 'web-demo',
        blePermissionStatus: getDemoBlePermissionStatus(),
        sensorProfile: selectedSensorProfileId,
        shellyRuntimeAddress: `${runtimeAddress} (demo simulated)`,
        shellyModel: 'Shelly Plug S Gen3',
        matterStatus: matterBlockedVisible ? 'demo blocked state visible' : 'off',
        scriptStatus: installMutation.isSuccess ? 'uploaded demo' : 'not uploaded',
        relayState: relayFinalOff ? 'OFF' : 'unknown',
        events: diagnostics
      }),
    [
      diagnostics,
      installMutation.isSuccess,
      matterBlockedVisible,
      relayFinalOff,
      runtimeAddress,
      selectedSensorProfileId
    ]
  );

  return {
    step,
    setStep,
    sensors,
    selectedSensor,
    selectedSensorProfileId,
    setSelectedSensorProfileId,
    runtimeAddress,
    onThreshold,
    setOnThreshold,
    offThreshold,
    setOffThreshold,
    isThresholdValid,
    config,
    script,
    sensorState,
    shellyState,
    shellyStatus,
    matterBlockedScenario,
    setMatterBlockedScenario,
    matterBlockedVisible,
    relayFinalOff,
    installMutation,
    relayMutation,
    diagnostics,
    supportSummary,
    start,
    scanSensors,
    checkShelly
  };
};

import {
  createDefaultShellyThermostatConfig,
  decodeShellyThermostatScript,
  generateShellyThermostatScript,
  normalizeConfig,
  serializeShellyRuntimeConfig
} from '@lcl/script-generator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetHardwareSetupDraftStore,
  useHardwareSetupDraftStore
} from '../../../flows/hardware-setup/setupDraftStore.js';
import type { ClimateAutomationScriptLoadResult } from './useClimateAutomationScriptLoadFlow.js';

const useClimateAutomationScriptLoadFlowMock = vi.hoisted(() => vi.fn());

vi.mock('./useClimateAutomationScriptLoadFlow.js', () => ({
  useClimateAutomationScriptLoadFlow: useClimateAutomationScriptLoadFlowMock
}));

import { useClimateAutomationScriptLoadDraftFlow } from './useClimateAutomationScriptLoadDraftFlow.js';

type LoadCallbacks = {
  onSuccess?(result: ClimateAutomationScriptLoadResult): void;
  onError?(error: unknown, device: ClimateAutomationScriptLoadResult['device']): void;
};

describe('useClimateAutomationScriptLoadDraftFlow', () => {
  beforeEach(() => {
    resetHardwareSetupDraftStore();
    useClimateAutomationScriptLoadFlowMock.mockReset();
  });

  it('replaces draft membership with the complete runtime sensor set loaded from Shelly', () => {
    let callbacks: LoadCallbacks | undefined;
    useClimateAutomationScriptLoadFlowMock.mockImplementation(
      (nextCallbacks: LoadCallbacks) => {
        callbacks = nextCallbacks;
        return {
          loadAutomationScriptMutation: {},
          loadAutomationScript: vi.fn()
        };
      }
    );

    const addresses = [
      'C2:C0:00:30:64:01',
      'C2:C0:00:30:64:02',
      'C2:C0:00:30:64:03',
      'A4:C1:38:4F:24:CD'
    ] as const;
    const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating');
    const configuredSensor = (runtimeAddress: string, displayName: string) => ({
      ...base.sensor,
      sensorId: `sensor-${runtimeAddress.replaceAll(':', '').toLowerCase()}`,
      runtimeAddress,
      displayName
    });
    const config = normalizeConfig({
      ...base,
      sensor: configuredSensor(addresses[0], 'TP357 1'),
      sensorSet: {
        aggregation: 'avg',
        additionalSensors: [
          configuredSensor(addresses[1], 'TP357 2'),
          configuredSensor(addresses[2], 'TP357 3'),
          configuredSensor(addresses[3], 'Recovered sensor')
        ]
      }
    });
    const code = generateShellyThermostatScript(config);
    const persistedRuntimeConfigJson = serializeShellyRuntimeConfig(config);
    const decoded = decodeShellyThermostatScript(code, persistedRuntimeConfigJson);
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    useHardwareSetupDraftStore.setState({
      inheritedSensorIds: [addresses[3]]
    });

    useClimateAutomationScriptLoadDraftFlow({
      getDraftActions: useHardwareSetupDraftStore.getState,
      upsertSensorDevice: (device) =>
        useHardwareSetupDraftStore.getState().upsertSensorDevice(device),
      resetInstallState: vi.fn(),
      applyControlStatus: vi.fn(),
      applyControlError: vi.fn()
    });

    const result = {
      device: { id: 'shelly-abc', baseUrl: 'http://192.168.0.10/' },
      state: {
        script: { id: 7 },
        code,
        persistedRuntimeConfigJson,
        runtimeConfigStorageSupported: true,
        status: {}
      },
      decoded
    } as unknown as ClimateAutomationScriptLoadResult;

    callbacks?.onSuccess?.(result);

    const draft = useHardwareSetupDraftStore.getState();
    expect(draft.sensorDevices.map((sensor) => sensor.runtimeAddress)).toEqual(
      [...addresses].reverse()
    );
    expect(draft.selectedSensorId).toBe(addresses[0]);
    expect(draft.additionalSensorIds).toEqual(addresses.slice(1));
    expect(draft.sensorAggregation).toBe('avg');
    expect(draft.inheritedSensorIds).toEqual([]);
  });
});

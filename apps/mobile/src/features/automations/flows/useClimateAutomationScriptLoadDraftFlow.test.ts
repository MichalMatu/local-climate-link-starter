import {
  createDefaultShellyThermostatConfig,
  decodeShellyThermostatScript,
  generateShellyThermostatScript,
  normalizeConfig,
  serializeShellyRuntimeConfig
} from '@lcl/script-generator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    const draftActions = {
      setShellyScriptId: vi.fn(),
      selectSensorDevice: vi.fn(),
      setAdditionalSensorIds: vi.fn(),
      setSensorAggregation: vi.fn(),
      setRulePreset: vi.fn(),
      setOnThresholdInput: vi.fn(),
      setOffThresholdInput: vi.fn(),
      setVpdAssistEnabled: vi.fn(),
      setVpdTargetInput: vi.fn(),
      setRssiMinInput: vi.fn(),
      setStaleTimeoutMinInput: vi.fn(),
      setMinChangeMinInput: vi.fn(),
      setMaxOnHoursInput: vi.fn()
    };
    const upsertSensorDevice = vi.fn();

    useClimateAutomationScriptLoadDraftFlow({
      getDraftActions: () => draftActions,
      upsertSensorDevice,
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

    expect(draftActions.setShellyScriptId).toHaveBeenCalledWith('shelly-abc', '7');
    expect(
      upsertSensorDevice.mock.calls.map(([device]) => device.runtimeAddress)
    ).toEqual(addresses);
    expect(draftActions.selectSensorDevice).toHaveBeenCalledWith(addresses[0]);
    expect(draftActions.setAdditionalSensorIds).toHaveBeenCalledWith(addresses.slice(1));
    expect(draftActions.setSensorAggregation).toHaveBeenCalledWith('avg');
  });
});

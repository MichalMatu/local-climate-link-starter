import {
  createDefaultShellyThermostatConfig,
  normalizeConfig
} from '@lcl/script-generator';
import { describe, expect, it } from 'vitest';
import { createClimateAutomationEditDraftPatch } from './climateAutomationEditDraft.js';
import { createInstalledAutomation } from './installedAutomation.js';

describe('createClimateAutomationEditDraftPatch', () => {
  it('restores primary, additional sensors and aggregation from a multi-sensor installation', () => {
    const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating');
    const config = normalizeConfig({
      ...base,
      sensor: {
        ...base.sensor,
        sensorId: 'primary-local-id',
        runtimeAddress: 'C2:C0:00:30:64:01',
        displayName: 'Primary TP357'
      },
      sensorSet: {
        aggregation: 'min',
        additionalSensors: [
          {
            ...base.sensor,
            sensorId: 'additional-local-id',
            runtimeAddress: 'C2:C0:00:30:64:02',
            displayName: 'Additional TP357'
          }
        ]
      }
    });
    const installation = createInstalledAutomation({
      shelly: { id: 'shelly-abc', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Grow plug',
      baseUrl: 'http://192.168.0.10/',
      scriptId: 1,
      scriptHash: 'script-hash',
      config,
      nowMs: 1000
    });

    const patch = createClimateAutomationEditDraftPatch(
      { shellyDevices: [], sensorDevices: [] },
      installation
    );

    expect(patch.selectedSensorId).toBe('primary-local-id');
    expect(patch.additionalSensorIds).toEqual(['additional-local-id']);
    expect(patch.sensorAggregation).toBe('min');
    expect(patch.sensorDevices).toEqual([
      {
        id: 'primary-local-id',
        name: 'Primary TP357',
        runtimeAddress: 'C2:C0:00:30:64:01',
        profileId: 'tp357_custom_v1'
      },
      {
        id: 'additional-local-id',
        name: 'Additional TP357',
        runtimeAddress: 'C2:C0:00:30:64:02',
        profileId: 'tp357_custom_v1'
      }
    ]);
  });
});

import {
  createDefaultShellyThermostatConfig,
  normalizeConfig
} from '@lcl/script-generator';
import { describe, expect, it } from 'vitest';
import { createClimateAutomationEditDraftPatch } from './climateAutomationEditDraft.js';
import { createInstalledAutomation } from './installedAutomation.js';

const tp357Sensor = (
  base: ReturnType<typeof createDefaultShellyThermostatConfig>['sensor'],
  runtimeAddress: string,
  sensorId: string,
  displayName: string
) => ({
  ...base,
  sensorId,
  runtimeAddress,
  displayName
});

describe('createClimateAutomationEditDraftPatch', () => {
  it('restores primary, additional sensors and aggregation from a multi-sensor installation', () => {
    const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating');
    const config = normalizeConfig({
      ...base,
      sensor: tp357Sensor(
        base.sensor,
        'C2:C0:00:30:64:01',
        'primary-local-id',
        'Primary TP357'
      ),
      sensorSet: {
        aggregation: 'min',
        additionalSensors: [
          tp357Sensor(
            base.sensor,
            'C2:C0:00:30:64:02',
            'additional-local-id',
            'Additional TP357'
          )
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

    expect(patch.selectedSensorId).toBe('C2:C0:00:30:64:01');
    expect(patch.additionalSensorIds).toEqual(['C2:C0:00:30:64:02']);
    expect(patch.sensorAggregation).toBe('min');
    expect(patch.sensorDevices).toEqual([
      {
        id: 'C2:C0:00:30:64:01',
        name: 'Primary TP357',
        runtimeAddress: 'C2:C0:00:30:64:01',
        profileId: 'tp357_custom_v1'
      },
      {
        id: 'C2:C0:00:30:64:02',
        name: 'Additional TP357',
        runtimeAddress: 'C2:C0:00:30:64:02',
        profileId: 'tp357_custom_v1'
      }
    ]);
  });

  it('deduplicates phone-saved and recovered runtime sensors by physical BLE address', () => {
    const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating');
    const addresses = [
      'C2:C0:00:30:64:01',
      'C2:C0:00:30:64:02',
      'C2:C0:00:30:64:03',
      'A4:C1:38:4F:24:CD'
    ] as const;
    const config = normalizeConfig({
      ...base,
      sensor: tp357Sensor(base.sensor, addresses[0], 'sensor-c2c000306401', 'TP357 1'),
      sensorSet: {
        aggregation: 'avg',
        additionalSensors: [
          tp357Sensor(base.sensor, addresses[1], 'sensor-c2c000306402', 'TP357 2'),
          tp357Sensor(base.sensor, addresses[2], 'sensor-c2c000306403', 'TP357 3'),
          tp357Sensor(base.sensor, addresses[3], addresses[3], 'Recovered legacy sensor')
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
      {
        shellyDevices: [],
        sensorDevices: addresses.slice(0, 3).map((runtimeAddress, index) => ({
          id: runtimeAddress,
          name: `Saved TP357 ${index + 1}`,
          runtimeAddress,
          profileId: 'tp357_custom_v1' as const
        }))
      },
      installation
    );

    expect(patch.sensorDevices).toHaveLength(4);
    expect(patch.sensorDevices.map((sensor) => sensor.runtimeAddress)).toEqual(addresses);
    expect(new Set(patch.sensorDevices.map((sensor) => sensor.runtimeAddress)).size).toBe(
      4
    );
    expect(patch.sensorDevices.map((sensor) => sensor.id)).toEqual(addresses);
    expect(patch.selectedSensorId).toBe(addresses[0]);
    expect(patch.additionalSensorIds).toEqual(addresses.slice(1));
  });

  it('preserves the current saved sensor name when the installed snapshot is older', () => {
    const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating');
    const runtimeAddress = 'C2:C0:00:30:64:01';
    const installation = createInstalledAutomation({
      shelly: { id: 'shelly-abc', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Grow plug',
      baseUrl: 'http://192.168.0.10/',
      scriptId: 1,
      scriptHash: 'script-hash',
      config: normalizeConfig({
        ...base,
        sensor: tp357Sensor(
          base.sensor,
          runtimeAddress,
          'sensor-c2c000306401',
          'Installed old name'
        )
      }),
      nowMs: 1000
    });

    const patch = createClimateAutomationEditDraftPatch(
      {
        shellyDevices: [],
        sensorDevices: [
          {
            id: 'saved-local-id',
            name: 'Kitchen thermometer',
            runtimeAddress,
            profileId: 'tp357_custom_v1'
          }
        ]
      },
      installation
    );

    expect(patch.sensorDevices[0]).toMatchObject({
      id: runtimeAddress,
      name: 'Kitchen thermometer',
      runtimeAddress
    });
  });

  it('keeps configured-only inherited provenance after the hydrated row exists locally', () => {
    const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating');
    const primaryAddress = 'C2:C0:00:30:64:01';
    const inheritedAddress = 'C2:C0:00:30:64:02';
    const installation = createInstalledAutomation({
      shelly: { id: 'shelly-abc', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Grow plug',
      baseUrl: 'http://192.168.0.10/',
      scriptId: 1,
      scriptHash: 'script-hash',
      config: normalizeConfig({
        ...base,
        sensor: tp357Sensor(
          base.sensor,
          primaryAddress,
          'sensor-c2c000306401',
          'Primary'
        ),
        sensorSet: {
          aggregation: 'avg',
          additionalSensors: [
            tp357Sensor(
              base.sensor,
              inheritedAddress,
              'sensor-c2c000306402',
              'Configured only'
            )
          ]
        }
      }),
      nowMs: 1000
    });

    const patch = createClimateAutomationEditDraftPatch(
      {
        shellyDevices: [],
        sensorDevices: [
          {
            id: primaryAddress,
            name: 'Primary',
            runtimeAddress: primaryAddress,
            profileId: 'tp357_custom_v1'
          },
          {
            id: inheritedAddress,
            name: 'Configured only',
            runtimeAddress: inheritedAddress,
            profileId: 'tp357_custom_v1'
          }
        ],
        inheritedSensorIds: [inheritedAddress],
        inheritedSensorSourceId: installation.id
      },
      installation
    );

    expect(patch.inheritedSensorIds).toEqual([inheritedAddress]);
    expect(patch.inheritedSensorSourceId).toBe(installation.id);
  });

  it('does not reuse inherited provenance from a different automation', () => {
    const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating');
    const runtimeAddress = 'C2:C0:00:30:64:02';
    const installation = createInstalledAutomation({
      shelly: { id: 'shelly-b', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Second plug',
      baseUrl: 'http://192.168.0.11/',
      scriptId: 1,
      scriptHash: 'script-hash-b',
      config: normalizeConfig({
        ...base,
        sensor: tp357Sensor(
          base.sensor,
          runtimeAddress,
          'sensor-c2c000306402',
          'Saved member'
        )
      }),
      nowMs: 2000
    });

    const patch = createClimateAutomationEditDraftPatch(
      {
        shellyDevices: [],
        sensorDevices: [
          {
            id: runtimeAddress,
            name: 'Saved member',
            runtimeAddress,
            profileId: 'tp357_custom_v1'
          }
        ],
        inheritedSensorIds: [runtimeAddress],
        inheritedSensorSourceId: 'climate:some-other-installation'
      },
      installation
    );

    expect(patch.inheritedSensorIds).toEqual([]);
    expect(patch.inheritedSensorSourceId).toBeNull();
  });
});

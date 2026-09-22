import {
  createDefaultShellyThermostatConfig,
  normalizeConfig
} from '@lcl/script-generator';
import { describe, expect, it } from 'vitest';
import type { ClimateInstalledAutomation } from '../installations/model.js';
import type { HardwareDiagnosticSnapshot } from './schemas.js';
import type { SensorReadingSample } from './sensorReadingsStore.js';
import {
  buildRuleSensorReadings,
  ruleSensorReadingKey
} from './useRuleSensorReadings.js';

const primaryAddress = 'A4:C1:38:4F:24:CD';
const additionalAddress = '11:22:33:44:55:66';

const baseConfig = createDefaultShellyThermostatConfig(
  'xiaomi_lywsd03mmc_bthome_v2',
  'heating'
);

const config = normalizeConfig({
  ...baseConfig,
  sensor: {
    ...baseConfig.sensor,
    sensorId: 'primary',
    runtimeAddress: primaryAddress,
    displayName: 'Primary'
  },
  sensorSet: {
    aggregation: 'avg',
    additionalSensors: [
      {
        ...baseConfig.sensor,
        sensorId: 'additional',
        runtimeAddress: additionalAddress,
        displayName: 'Additional'
      }
    ]
  }
});

const installation = (withAdditional = true) =>
  ({
    kind: 'climate',
    id: 'climate:test',
    shelly: {
      deviceId: 'shelly-test',
      name: 'Grow plug',
      baseUrl: 'http://192.168.0.20'
    },
    config: withAdditional
      ? config
      : normalizeConfig({
          ...config,
          sensorSet: undefined
        })
  }) as unknown as ClimateInstalledAutomation;

const snapshot = (
  diagnostics: HardwareDiagnosticSnapshot['sensorDiagnostics']
): HardwareDiagnosticSnapshot =>
  ({
    time: {
      uptimeSec: 1000
    },
    sensorDiagnostics: diagnostics
  }) as unknown as HardwareDiagnosticSnapshot;

const sensorDevices = [
  {
    id: primaryAddress,
    name: 'Primary',
    runtimeAddress: primaryAddress,
    profileId: 'xiaomi_lywsd03mmc_bthome_v2'
  },
  {
    id: additionalAddress,
    name: 'Additional',
    runtimeAddress: additionalAddress,
    profileId: 'xiaomi_lywsd03mmc_bthome_v2'
  }
] as const;

const plugDiagnostic = (
  runtimeAddress: string,
  overrides: Partial<HardwareDiagnosticSnapshot['sensorDiagnostics'][number]> = {}
): HardwareDiagnosticSnapshot['sensorDiagnostics'][number] => ({
  runtimeAddress,
  temperatureC: 21.5,
  humidityPct: 55,
  batteryPct: 88,
  rssi: -60,
  lastSeenUptimeMs: 995_000,
  fresh: true,
  ...overrides
});

describe('buildRuleSensorReadings', () => {
  it('maps Plug diagnostics to every configured thermometer', () => {
    const readings = buildRuleSensorReadings({
      sensorDevices,
      samplesBySensorId: {},
      runtimeSnapshots: [
        {
          installation: installation(),
          snapshot: snapshot([
            plugDiagnostic(primaryAddress),
            plugDiagnostic(additionalAddress, {
              temperatureC: 22.2,
              humidityPct: 57,
              batteryPct: 77,
              rssi: -65,
              lastSeenUptimeMs: 980_000
            })
          ]),
          fetchedAtMs: 20_000
        }
      ]
    });

    expect(readings[ruleSensorReadingKey(primaryAddress)]).toMatchObject({
      source: 'shelly-runtime',
      temperatureC: 21.5,
      humidityPct: 55,
      batteryPct: 88,
      rssi: -60,
      ageMs: 5000,
      stale: false,
      shellyName: 'Grow plug'
    });
    expect(readings[ruleSensorReadingKey(additionalAddress)]).toMatchObject({
      source: 'shelly-runtime',
      temperatureC: 22.2,
      humidityPct: 57,
      batteryPct: 77,
      rssi: -65,
      ageMs: 20_000,
      stale: false
    });
  });

  it('ignores a cached Plug record after that sensor leaves the current config', () => {
    const readings = buildRuleSensorReadings({
      sensorDevices,
      samplesBySensorId: {},
      runtimeSnapshots: [
        {
          installation: installation(false),
          snapshot: snapshot([plugDiagnostic(additionalAddress)]),
          fetchedAtMs: 20_000
        }
      ]
    });

    expect(readings[ruleSensorReadingKey(additionalAddress)]).toBeUndefined();
  });

  it('does not invent a telemetry source for recovered identity provenance', () => {
    const readings = buildRuleSensorReadings({
      sensorDevices,
      samplesBySensorId: {},
      inheritedSensorIds: [additionalAddress]
    });

    expect(readings[ruleSensorReadingKey(additionalAddress)]).toEqual({
      identityProvenance: 'recovered-runtime'
    });
    expect(readings[ruleSensorReadingKey(additionalAddress)]?.source).toBeUndefined();
  });

  it('keeps recovered identity provenance separate from a Plug BLE live source', () => {
    const readings = buildRuleSensorReadings({
      sensorDevices,
      samplesBySensorId: {},
      inheritedSensorIds: [additionalAddress],
      runtimeSnapshots: [
        {
          installation: installation(),
          snapshot: snapshot([
            plugDiagnostic(additionalAddress, {
              temperatureC: 23.1,
              humidityPct: 58
            })
          ]),
          fetchedAtMs: 20_000
        }
      ]
    });

    expect(readings[ruleSensorReadingKey(additionalAddress)]).toMatchObject({
      source: 'shelly-runtime',
      identityProvenance: 'recovered-runtime',
      temperatureC: 23.1,
      humidityPct: 58,
      stale: false
    });
  });

  it('keeps a fresh phone reading instead of replacing it with stale Plug data', () => {
    const phone: SensorReadingSample = {
      sensorId: primaryAddress,
      source: 'phone-scan',
      temperatureC: 20.4,
      humidityPct: 53,
      batteryPct: 91,
      rssi: -50,
      seenAtMs: 19_000
    };
    const readings = buildRuleSensorReadings({
      sensorDevices,
      samplesBySensorId: { [primaryAddress]: [phone] },
      runtimeSnapshots: [
        {
          installation: installation(),
          snapshot: snapshot([
            plugDiagnostic(primaryAddress, {
              temperatureC: 17,
              lastSeenUptimeMs: 700_000,
              fresh: false
            })
          ]),
          fetchedAtMs: 20_000
        }
      ],
      nowMs: 20_000
    });

    expect(readings[ruleSensorReadingKey(primaryAddress)]).toMatchObject({
      source: 'phone',
      temperatureC: 20.4,
      batteryPct: 91,
      rssi: -50,
      stale: false
    });
  });
});

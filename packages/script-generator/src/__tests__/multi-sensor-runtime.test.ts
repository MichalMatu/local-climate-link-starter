import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultShellyThermostatConfig,
  decodeShellyThermostatScript,
  generateShellyThermostatScript,
  normalizeConfig,
  serializeShellyRuntimeConfig,
  type ClimateSensorAggregation,
  type ShellyThermostatConfig
} from '../index.js';

const createBthomeAdvertisement = (payload: number[]): number[] => [
  payload.length + 3,
  0x16,
  0xd2,
  0xfc,
  ...payload
];

const humidityPacket = (humidity: number): number[] => {
  const raw = Math.round(humidity * 100);
  return createBthomeAdvertisement([0x40, 0x03, raw & 0xff, (raw >> 8) & 0xff]);
};

const createExecutableRuntime = (script: string) => {
  let scanCallback:
    | ((event: string, result: { addr: string; advData: number[]; rssi: number }) => void)
    | undefined;
  const switchCalls: Array<{ id: number; on: boolean }> = [];
  const shelly = {
    call: (
      method: string,
      params: { id: number; on: boolean },
      callback?: (_result: unknown, code: number) => void
    ) => {
      if (method === 'Switch.Set') switchCalls.push(params);
      callback?.({}, 0);
    },
    getComponentStatus: () => ({ output: false }),
    getUptimeMs: () => Date.now()
  };
  const ble = {
    Scanner: {
      SCAN_RESULT: 'scan-result',
      stop: () => undefined,
      subscribe: (
        callback: (
          event: string,
          result: { addr: string; advData: number[]; rssi: number }
        ) => void
      ) => {
        scanCallback = callback;
      },
      start: () => true
    }
  };
  const timer = { set: () => undefined };
  const runtime = new Function(
    'Shelly',
    'BLE',
    'Timer',
    `${script}\nreturn {diag:function(){return JSON.parse(diag());}};`
  )(shelly, ble, timer) as { diag: () => { g: unknown[]; u: unknown[] } };

  if (!scanCallback)
    throw new Error('Generated runtime did not subscribe to BLE scanner.');
  return { runtime, scan: scanCallback, switchCalls };
};

const multiSensorConfig = (
  aggregation: ClimateSensorAggregation
): ShellyThermostatConfig => {
  const base = createDefaultShellyThermostatConfig(
    'xiaomi_lywsd03mmc_bthome_v2',
    'humidifying'
  );
  return normalizeConfig({
    ...base,
    sensor: {
      ...base.sensor,
      sensorId: 'sensor-a',
      runtimeAddress: 'AA:BB:CC:DD:EE:01',
      displayName: 'Sensor A'
    },
    sensorSet: {
      aggregation,
      additionalSensors: [
        {
          ...base.sensor,
          sensorId: 'sensor-b',
          runtimeAddress: 'AA:BB:CC:DD:EE:02',
          displayName: 'Sensor B'
        }
      ]
    },
    rule: {
      ...base.rule,
      consecutiveHits: 1
    }
  });
};

describe('multi-sensor climate runtime', () => {
  it.each([
    ['avg', 50],
    ['min', 40],
    ['max', 60],
    ['firstValid', 40]
  ] as const)('aggregates fresh humidity with %s', (aggregation, expected) => {
    const config = multiSensorConfig(aggregation);
    const { runtime, scan } = createExecutableRuntime(
      generateShellyThermostatScript(config)
    );

    scan('scan-result', {
      addr: 'AA:BB:CC:DD:EE:01',
      advData: humidityPacket(40),
      rssi: -35
    });
    scan('scan-result', {
      addr: 'AA:BB:CC:DD:EE:02',
      advData: humidityPacket(60),
      rssi: -35
    });

    expect(runtime.diag().g[2]).toBe(expected);
    expect(runtime.diag().u).toEqual([
      2,
      2,
      aggregation === 'avg'
        ? 0
        : aggregation === 'min'
          ? 1
          : aggregation === 'max'
            ? 2
            : 3
    ]);
  });

  it('ignores stale members while keeping a fresh member actionable', () => {
    let nowMs = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    try {
      const config = multiSensorConfig('avg');
      const { runtime, scan } = createExecutableRuntime(
        generateShellyThermostatScript(config)
      );

      scan('scan-result', {
        addr: 'AA:BB:CC:DD:EE:01',
        advData: humidityPacket(40),
        rssi: -35
      });
      nowMs += 91_000;
      scan('scan-result', {
        addr: 'AA:BB:CC:DD:EE:02',
        advData: humidityPacket(60),
        rssi: -35
      });

      expect(runtime.diag().g[2]).toBe(60);
      expect(runtime.diag().u[0]).toBe(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('round-trips ordered sensors, aggregation, and mixed parser profiles', () => {
    const base = multiSensorConfig('max');
    const config = normalizeConfig({
      ...base,
      sensorSet: {
        aggregation: 'max',
        additionalSensors: [
          {
            ...base.sensor,
            profileId: 'tp357_custom_v1',
            sensorId: 'tp357-b',
            runtimeAddress: '11:22:33:44:55:66',
            displayName: 'TP357 B'
          }
        ]
      }
    });

    const decoded = decodeShellyThermostatScript(generateShellyThermostatScript(config));

    expect(decoded?.settings.aggregation).toBe('max');
    expect(decoded?.settings.sensors).toEqual([
      {
        sensorProfileId: 'xiaomi_lywsd03mmc_bthome_v2',
        sensorDisplayName: 'Sensor A',
        runtimeAddress: 'AA:BB:CC:DD:EE:01',
        compactAddress: 'AABBCCDDEE01'
      },
      {
        sensorProfileId: 'tp357_custom_v1',
        sensorDisplayName: 'TP357 B',
        runtimeAddress: '11:22:33:44:55:66',
        compactAddress: '112233445566'
      }
    ]);
    expect(decoded?.runtimeConfig.ss?.map((sensor) => sensor[2])).toEqual([0, 1]);
  });

  it('rejects duplicate runtime addresses across the sensor set', () => {
    const base = createDefaultShellyThermostatConfig();
    expect(() =>
      normalizeConfig({
        ...base,
        sensorSet: {
          aggregation: 'avg',
          additionalSensors: [
            {
              ...base.sensor,
              sensorId: 'duplicate'
            }
          ]
        }
      })
    ).toThrow(/unique runtime addresses/);
  });

  it('keeps eight typical sensors within the Script.storage value limit', () => {
    const base = createDefaultShellyThermostatConfig();
    const additionalSensors = Array.from({ length: 7 }, (_, index) => ({
      ...base.sensor,
      sensorId: `sensor-${index + 2}`,
      runtimeAddress: `AA:BB:CC:DD:EE:${String(index + 2).padStart(2, '0')}`,
      displayName: `Sensor ${index + 2}`
    }));
    const config = normalizeConfig({
      ...base,
      sensor: {
        ...base.sensor,
        sensorId: 'sensor-1',
        runtimeAddress: 'AA:BB:CC:DD:EE:01',
        displayName: 'Sensor 1'
      },
      sensorSet: { aggregation: 'avg', additionalSensors }
    });

    expect(
      new TextEncoder().encode(serializeShellyRuntimeConfig(config)).length
    ).toBeLessThanOrEqual(1024);
  });
});

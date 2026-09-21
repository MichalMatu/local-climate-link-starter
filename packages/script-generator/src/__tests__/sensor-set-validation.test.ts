import { describe, expect, it } from 'vitest';
import {
  createDefaultShellyThermostatConfig,
  MAX_CLIMATE_SENSORS,
  normalizeConfig
} from '../index.js';

const sensor = (index: number) => ({
  ...createDefaultShellyThermostatConfig().sensor,
  sensorId: `sensor-${index}`,
  runtimeAddress: `AA:BB:CC:DD:EE:${String(index).padStart(2, '0')}`,
  displayName: `Sensor ${index}`
});

describe('multi-sensor config limits', () => {
  it('accepts exactly eight sensors', () => {
    const base = createDefaultShellyThermostatConfig();
    const config = normalizeConfig({
      ...base,
      sensor: sensor(1),
      sensorSet: {
        aggregation: 'avg',
        additionalSensors: Array.from(
          { length: MAX_CLIMATE_SENSORS - 1 },
          (_, index) => sensor(index + 2)
        )
      }
    });

    expect(1 + (config.sensorSet?.additionalSensors.length ?? 0)).toBe(
      MAX_CLIMATE_SENSORS
    );
  });

  it('rejects a ninth sensor', () => {
    const base = createDefaultShellyThermostatConfig();
    expect(() =>
      normalizeConfig({
        ...base,
        sensor: sensor(1),
        sensorSet: {
          aggregation: 'avg',
          additionalSensors: Array.from(
            { length: MAX_CLIMATE_SENSORS },
            (_, index) => sensor(index + 2)
          )
        }
      })
    ).toThrow();
  });
});

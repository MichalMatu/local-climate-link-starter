import { beforeEach, describe, expect, it } from 'vitest';
import {
  resetHardwareSetupReadingsStore,
  useHardwareSetupReadingsStore
} from './sensorReadingsStore.js';

describe('hardware setup sensor readings store', () => {
  beforeEach(() => resetHardwareSetupReadingsStore());

  it('keeps only the latest live state per sensor', () => {
    const store = useHardwareSetupReadingsStore.getState();
    store.appendSensorReading({
      sensorId: 'aa:bb:cc:dd:ee:ff',
      source: 'phone-scan',
      temperatureC: 21.5,
      humidityPct: 44,
      seenAtMs: 1000
    });
    useHardwareSetupReadingsStore.getState().appendSensorReading({
      sensorId: 'aa:bb:cc:dd:ee:ff',
      source: 'phone-scan',
      temperatureC: 21.7,
      rssi: -52,
      seenAtMs: 2000
    });

    expect(
      useHardwareSetupReadingsStore.getState().samplesBySensorId['AA:BB:CC:DD:EE:FF']
    ).toEqual([
      {
        sensorId: 'AA:BB:CC:DD:EE:FF',
        source: 'phone-scan',
        temperatureC: 21.7,
        humidityPct: 44,
        rssi: -52,
        seenAtMs: 2000
      }
    ]);
  });

  it('clears live state for a removed sensor', () => {
    useHardwareSetupReadingsStore.getState().appendSensorReading({
      sensorId: 'aa:bb:cc:dd:ee:ff',
      source: 'phone-scan',
      temperatureC: 21.5,
      seenAtMs: 1000
    });
    useHardwareSetupReadingsStore.getState().clearSensorReadings('AA:BB:CC:DD:EE:FF');
    expect(useHardwareSetupReadingsStore.getState().samplesBySensorId).toEqual({});
  });
});

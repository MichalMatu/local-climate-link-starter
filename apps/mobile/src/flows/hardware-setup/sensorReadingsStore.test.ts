import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('hardware setup sensor readings store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it('persists and hydrates bounded sensor chart samples', async () => {
    const firstStoreModule = await import('./sensorReadingsStore.js');

    firstStoreModule.useHardwareSetupReadingsStore.getState().appendSensorReading({
      sensorId: 'aa:bb:cc:dd:ee:ff',
      source: 'phone-scan',
      temperatureC: 21.5,
      humidityPct: 44,
      rssi: -52,
      seenAtMs: 1000
    });

    expect(
      window.localStorage.getItem(firstStoreModule.HARDWARE_SETUP_READINGS_STORAGE_KEY)
    ).toContain('AA:BB:CC:DD:EE:FF');

    vi.resetModules();
    const reloadedStoreModule = await import('./sensorReadingsStore.js');

    expect(
      reloadedStoreModule.useHardwareSetupReadingsStore.getState().samplesBySensorId[
        'AA:BB:CC:DD:EE:FF'
      ]
    ).toEqual([
      {
        sensorId: 'AA:BB:CC:DD:EE:FF',
        source: 'phone-scan',
        temperatureC: 21.5,
        humidityPct: 44,
        rssi: -52,
        seenAtMs: 1000
      }
    ]);
  });

  it('keeps only the newest chart samples per sensor', async () => {
    const storeModule = await import('./sensorReadingsStore.js');

    storeModule.useHardwareSetupReadingsStore.getState().appendSensorReadings(
      'aa:bb:cc:dd:ee:ff',
      Array.from({ length: 130 }, (_, index) => ({
        sensorId: 'aa:bb:cc:dd:ee:ff',
        source: 'phone-scan',
        temperatureC: index,
        humidityPct: 50,
        seenAtMs: index
      }))
    );

    const samples =
      storeModule.useHardwareSetupReadingsStore.getState().samplesBySensorId[
        'AA:BB:CC:DD:EE:FF'
      ] ?? [];

    expect(samples).toHaveLength(120);
    expect(samples[0]?.temperatureC).toBe(10);
    expect(samples.at(-1)?.temperatureC).toBe(129);
  });
});

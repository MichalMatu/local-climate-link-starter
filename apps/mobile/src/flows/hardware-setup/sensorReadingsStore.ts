import type { Measurement } from '@lcl/ble-core';
import { create } from 'zustand';
import { z } from 'zod';
import type { BleDiscoveryCandidate } from './schemas.js';

const MAX_SENSOR_SAMPLES = 120;
export const HARDWARE_SETUP_READINGS_STORAGE_KEY = 'lcl.hardwareSetupReadings.v1';

export interface SensorReadingSample {
  sensorId: string;
  source: Measurement['source'];
  temperatureC?: number | undefined;
  humidityPct?: number | undefined;
  batteryPct?: number | undefined;
  voltageV?: number | undefined;
  rssi?: number | undefined;
  seenAtMs: number;
}

type SensorReadingsState = {
  samplesBySensorId: Record<string, SensorReadingSample[]>;
  appendSensorReading(sample: SensorReadingSample): void;
  appendSensorReadings(sensorId: string, samples: SensorReadingSample[]): void;
  clearSensorReadings(sensorId: string): void;
};

const normalizeSensorId = (sensorId: string): string => sensorId.toUpperCase();

const sensorReadingSampleSchema = z.object({
  sensorId: z.string(),
  source: z.enum(['phone-scan', 'phone-gatt', 'pvvx-history', 'shelly-scan', 'demo']),
  temperatureC: z.number().optional(),
  humidityPct: z.number().optional(),
  batteryPct: z.number().optional(),
  voltageV: z.number().optional(),
  rssi: z.number().optional(),
  seenAtMs: z.number()
});

const persistedSensorReadingsSchema = z.object({
  samplesBySensorId: z.record(z.array(sensorReadingSampleSchema))
});

const isStorageAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const warnStorageFailure = (operation: string, error: unknown): void => {
  if (typeof console !== 'undefined') {
    console.warn(`Sensor readings storage ${operation} failed.`, error);
  }
};

const sampleKey = (sample: SensorReadingSample): string =>
  [
    sample.seenAtMs,
    sample.source,
    sample.temperatureC ?? '',
    sample.humidityPct ?? '',
    sample.batteryPct ?? '',
    sample.voltageV ?? '',
    sample.rssi ?? ''
  ].join('|');

const mergeSamples = (
  existing: SensorReadingSample[],
  incoming: SensorReadingSample[]
): SensorReadingSample[] => {
  const unique = new Map<string, SensorReadingSample>();
  for (const sample of [...existing, ...incoming]) {
    unique.set(sampleKey(sample), sample);
  }

  return [...unique.values()]
    .sort((first, second) => first.seenAtMs - second.seenAtMs)
    .slice(-MAX_SENSOR_SAMPLES);
};

const normalizeSamplesBySensorId = (
  samplesBySensorId: Record<string, SensorReadingSample[]>
): Record<string, SensorReadingSample[]> => {
  const normalized: Record<string, SensorReadingSample[]> = {};

  for (const [sensorId, samples] of Object.entries(samplesBySensorId)) {
    const normalizedSensorId = normalizeSensorId(sensorId);
    normalized[normalizedSensorId] = mergeSamples(
      normalized[normalizedSensorId] ?? [],
      samples.map((sample) => ({
        ...sample,
        sensorId: normalizeSensorId(sample.sensorId || normalizedSensorId)
      }))
    );
  }

  return normalized;
};

const readPersistedReadings = (): Record<string, SensorReadingSample[]> => {
  if (!isStorageAvailable()) {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(HARDWARE_SETUP_READINGS_STORAGE_KEY);
    if (!stored) {
      return {};
    }
    const parsed = persistedSensorReadingsSchema.safeParse(JSON.parse(stored));
    if (!parsed.success) {
      return {};
    }
    return normalizeSamplesBySensorId(parsed.data.samplesBySensorId);
  } catch (error) {
    warnStorageFailure('read', error);
    return {};
  }
};

const persistReadings = (
  samplesBySensorId: Record<string, SensorReadingSample[]>
): void => {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.setItem(
      HARDWARE_SETUP_READINGS_STORAGE_KEY,
      JSON.stringify({ samplesBySensorId: normalizeSamplesBySensorId(samplesBySensorId) })
    );
  } catch (error) {
    warnStorageFailure('write', error);
  }
};

export const sensorReadingFromCandidate = (
  candidate: BleDiscoveryCandidate,
  source: Measurement['source']
): SensorReadingSample => ({
  sensorId: normalizeSensorId(candidate.runtimeAddress),
  source,
  temperatureC: candidate.temperatureC ?? undefined,
  humidityPct: candidate.humidityPct ?? undefined,
  batteryPct: candidate.batteryPct ?? undefined,
  voltageV: candidate.voltageV ?? undefined,
  rssi: candidate.rssi ?? undefined,
  seenAtMs: candidate.seenAt ?? Date.now()
});

export const sensorReadingFromMeasurement = (
  measurement: Measurement
): SensorReadingSample => ({
  sensorId: normalizeSensorId(measurement.sensorId),
  source: measurement.source,
  temperatureC: measurement.temperatureC,
  humidityPct: measurement.humidityPct,
  batteryPct: measurement.batteryPct,
  voltageV: measurement.voltageV,
  rssi: measurement.rssi,
  seenAtMs: measurement.seenAtMs
});

export const useHardwareSetupReadingsStore = create<SensorReadingsState>((set) => ({
  samplesBySensorId: readPersistedReadings(),
  appendSensorReading: (sample) =>
    set((state) => {
      const sensorId = normalizeSensorId(sample.sensorId);
      const samplesBySensorId = {
        ...state.samplesBySensorId,
        [sensorId]: mergeSamples(state.samplesBySensorId[sensorId] ?? [], [
          { ...sample, sensorId }
        ])
      };
      persistReadings(samplesBySensorId);
      return {
        samplesBySensorId
      };
    }),
  appendSensorReadings: (sensorId, samples) =>
    set((state) => {
      const normalizedSensorId = normalizeSensorId(sensorId);
      const samplesBySensorId = {
        ...state.samplesBySensorId,
        [normalizedSensorId]: mergeSamples(
          state.samplesBySensorId[normalizedSensorId] ?? [],
          samples.map((sample) => ({
            ...sample,
            sensorId: normalizedSensorId
          }))
        )
      };
      persistReadings(samplesBySensorId);
      return {
        samplesBySensorId
      };
    }),
  clearSensorReadings: (sensorId) =>
    set((state) => {
      const normalizedSensorId = normalizeSensorId(sensorId);
      const remaining = { ...state.samplesBySensorId };
      delete remaining[normalizedSensorId];
      persistReadings(remaining);
      return { samplesBySensorId: remaining };
    })
}));

export const resetHardwareSetupReadingsStore = (): void => {
  if (isStorageAvailable()) {
    window.localStorage.removeItem(HARDWARE_SETUP_READINGS_STORAGE_KEY);
  }
  useHardwareSetupReadingsStore.setState({ samplesBySensorId: {} });
};

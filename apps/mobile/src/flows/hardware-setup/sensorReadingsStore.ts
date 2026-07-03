import type { Measurement } from '@lcl/ble-core';
import { create } from 'zustand';
import type { BleDiscoveryCandidate } from './schemas.js';

const MAX_SENSOR_SAMPLES = 120;

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
  samplesBySensorId: {},
  appendSensorReading: (sample) =>
    set((state) => {
      const sensorId = normalizeSensorId(sample.sensorId);
      return {
        samplesBySensorId: {
          ...state.samplesBySensorId,
          [sensorId]: mergeSamples(state.samplesBySensorId[sensorId] ?? [], [
            { ...sample, sensorId }
          ])
        }
      };
    }),
  appendSensorReadings: (sensorId, samples) =>
    set((state) => {
      const normalizedSensorId = normalizeSensorId(sensorId);
      return {
        samplesBySensorId: {
          ...state.samplesBySensorId,
          [normalizedSensorId]: mergeSamples(
            state.samplesBySensorId[normalizedSensorId] ?? [],
            samples.map((sample) => ({
              ...sample,
              sensorId: normalizedSensorId
            }))
          )
        }
      };
    }),
  clearSensorReadings: (sensorId) =>
    set((state) => {
      const normalizedSensorId = normalizeSensorId(sensorId);
      const remaining = { ...state.samplesBySensorId };
      delete remaining[normalizedSensorId];
      return { samplesBySensorId: remaining };
    })
}));

export const resetHardwareSetupReadingsStore = (): void => {
  useHardwareSetupReadingsStore.setState({ samplesBySensorId: {} });
};

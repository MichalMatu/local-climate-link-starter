import type { Measurement } from '@lcl/ble-core';
import { create } from 'zustand';
import type { BleDiscoveryCandidate } from './schemas.js';

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
  clearSensorReadings(sensorId: string): void;
};

const normalizeSensorId = (sensorId: string): string => sensorId.toUpperCase();

const mergeLatestReading = (
  previous: SensorReadingSample | undefined,
  incoming: SensorReadingSample
): SensorReadingSample => ({
  sensorId: normalizeSensorId(incoming.sensorId),
  source:
    previous && previous.seenAtMs > incoming.seenAtMs ? previous.source : incoming.source,
  temperatureC: incoming.temperatureC ?? previous?.temperatureC,
  humidityPct: incoming.humidityPct ?? previous?.humidityPct,
  batteryPct: incoming.batteryPct ?? previous?.batteryPct,
  voltageV: incoming.voltageV ?? previous?.voltageV,
  rssi: incoming.rssi ?? previous?.rssi,
  seenAtMs: Math.max(previous?.seenAtMs ?? 0, incoming.seenAtMs)
});

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

export const useHardwareSetupReadingsStore = create<SensorReadingsState>((set) => ({
  samplesBySensorId: {},
  appendSensorReading: (sample) =>
    set((state) => {
      const sensorId = normalizeSensorId(sample.sensorId);
      const previous = state.samplesBySensorId[sensorId]?.[0];
      return {
        samplesBySensorId: {
          ...state.samplesBySensorId,
          [sensorId]: [mergeLatestReading(previous, { ...sample, sensorId })]
        }
      };
    }),
  clearSensorReadings: (sensorId) =>
    set((state) => {
      const remaining = { ...state.samplesBySensorId };
      delete remaining[normalizeSensorId(sensorId)];
      return { samplesBySensorId: remaining };
    })
}));

export const resetHardwareSetupReadingsStore = (): void => {
  useHardwareSetupReadingsStore.setState({ samplesBySensorId: {} });
};

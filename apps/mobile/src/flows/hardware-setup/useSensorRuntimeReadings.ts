import { useQueries } from '@tanstack/react-query';
import type { ClimateInstalledAutomation } from '../installations/model.js';
import { fetchInstalledAutomationDiagnostics } from '../installations/runtimeDiagnostics.js';
import { useInstalledAutomationStore } from '../installations/store.js';
import { installedAutomationDiagnosticsQueryKey } from '../installations/useInstalledAutomationRuntime.js';
import type { SensorDraftDevice } from './setupDraftStore.js';

const SENSOR_RUNTIME_REFRESH_MS = 5_000;

const normalizeSensorId = (sensorId: string): string => sensorId.trim().toUpperCase();

const finiteNumber = (value: number | null | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const calculateSensorVpdKpa = (
  temperatureC: number | null | undefined,
  humidityPct: number | null | undefined
): number | undefined => {
  if (
    typeof temperatureC !== 'number' ||
    !Number.isFinite(temperatureC) ||
    temperatureC <= -237.3 ||
    typeof humidityPct !== 'number' ||
    !Number.isFinite(humidityPct) ||
    humidityPct < 0 ||
    humidityPct > 100
  ) {
    return undefined;
  }

  const saturationVaporPressure =
    0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));
  return saturationVaporPressure * (1 - humidityPct / 100);
};

export type SensorRuntimeReading = {
  sensorId: string;
  source: 'shelly-runtime';
  shellyName: string;
  temperatureC?: number | undefined;
  humidityPct?: number | undefined;
  vpdKpa?: number | undefined;
  batteryPct?: number | undefined;
  rssi?: number | undefined;
  seenAtMs: number;
  stale: boolean;
};

const isClimateInstallation = (
  installation: ReturnType<
    typeof useInstalledAutomationStore.getState
  >['installations'][number]
): installation is ClimateInstalledAutomation => installation.kind === 'climate';

export const useSensorRuntimeReadings = (
  sensorDevices: readonly SensorDraftDevice[]
): Record<string, SensorRuntimeReading> => {
  const installations = useInstalledAutomationStore((state) => state.installations);
  const sensorIds = new Set(
    sensorDevices.map((device) => normalizeSensorId(device.runtimeAddress))
  );
  const runtimeInstallations = installations.filter(
    (installation): installation is ClimateInstalledAutomation =>
      isClimateInstallation(installation) &&
      sensorIds.has(normalizeSensorId(installation.config.sensor.runtimeAddress))
  );

  const runtimeQueries = useQueries({
    queries: runtimeInstallations.map((installation) => ({
      queryKey: installedAutomationDiagnosticsQueryKey(installation),
      queryFn: () => fetchInstalledAutomationDiagnostics(installation),
      retry: false,
      refetchInterval: SENSOR_RUNTIME_REFRESH_MS,
      refetchIntervalInBackground: false,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    }))
  });

  const readings: Record<string, SensorRuntimeReading> = {};

  runtimeInstallations.forEach((installation, index) => {
    const query = runtimeQueries[index];
    const snapshot = query?.data;
    if (!snapshot) return;

    const diagnostics = snapshot.diagnostics;
    const temperatureC = finiteNumber(diagnostics.lastTemp);
    const humidityPct = finiteNumber(diagnostics.lastHumidity);
    const lastSeenUptimeMs = finiteNumber(diagnostics.lastSeenUptimeMs);
    if (
      temperatureC === undefined &&
      humidityPct === undefined &&
      lastSeenUptimeMs === undefined
    ) {
      return;
    }

    const currentUptimeMs =
      typeof snapshot.time.uptimeSec === 'number' &&
      Number.isFinite(snapshot.time.uptimeSec)
        ? snapshot.time.uptimeSec * 1000
        : undefined;
    const ageMs =
      currentUptimeMs !== undefined && lastSeenUptimeMs !== undefined
        ? Math.max(0, currentUptimeMs - lastSeenUptimeMs)
        : 0;
    const fetchedAtMs = query.dataUpdatedAt > 0 ? query.dataUpdatedAt : Date.now();
    const sensorId = normalizeSensorId(installation.config.sensor.runtimeAddress);
    const reading: SensorRuntimeReading = {
      sensorId,
      source: 'shelly-runtime',
      shellyName: installation.shelly.name,
      temperatureC,
      humidityPct,
      vpdKpa: calculateSensorVpdKpa(temperatureC, humidityPct),
      batteryPct: finiteNumber(diagnostics.lastBattery),
      rssi: finiteNumber(diagnostics.lastRssi),
      seenAtMs: Math.max(0, fetchedAtMs - ageMs),
      stale:
        diagnostics.dataState === 'st' ||
        (lastSeenUptimeMs !== undefined &&
          currentUptimeMs !== undefined &&
          ageMs > snapshot.rule.staleTimeoutSec * 1000)
    };

    const existing = readings[sensorId];
    if (
      !existing ||
      (existing.stale && !reading.stale) ||
      (existing.stale === reading.stale && reading.seenAtMs > existing.seenAtMs)
    ) {
      readings[sensorId] = reading;
    }
  });

  return readings;
};

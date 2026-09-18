import { calculateVpdKpa } from '@lcl/automation-core';
import { useQueries } from '@tanstack/react-query';
import type { ClimateInstalledAutomation } from '../installations/model.js';
import { fetchInstalledAutomationDiagnostics } from '../installations/runtimeDiagnostics.js';
import { useInstalledAutomationStore } from '../installations/store.js';
import { installedAutomationDiagnosticsQueryKey } from '../installations/useInstalledAutomationRuntime.js';
import type { SensorReadingSample } from './sensorReadingsStore.js';
import type { SensorDraftDevice } from './setupDraftStore.js';

const RULE_SENSOR_RUNTIME_REFRESH_MS = 5_000;

const normalizeSensorId = (sensorId: string): string => sensorId.trim().toUpperCase();
const normalizeBaseUrl = (baseUrl: string | null | undefined): string =>
  baseUrl?.trim().replace(/\/$/, '').toLowerCase() ?? '';

const finiteNumber = (value: number | null | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export type RuleSensorLiveReading = {
  source: 'phone' | 'shelly-runtime';
  temperatureC?: number | undefined;
  humidityPct?: number | undefined;
  vpdKpa?: number | undefined;
  seenAtMs: number;
  stale: boolean;
  shellyName?: string | undefined;
  shellyBaseUrl?: string | undefined;
};

type RuleSensorReadingsOptions = {
  sensorDevices: readonly SensorDraftDevice[];
  samplesBySensorId: Record<string, SensorReadingSample[]>;
  preferredShellyBaseUrl?: string | null | undefined;
};

const isClimateInstallation = (
  installation: ReturnType<
    typeof useInstalledAutomationStore.getState
  >['installations'][number]
): installation is ClimateInstalledAutomation => installation.kind === 'climate';

const phoneReading = (
  sample: SensorReadingSample | undefined
): RuleSensorLiveReading | null => {
  if (!sample || sample.source !== 'phone-scan') {
    return null;
  }

  const temperatureC = finiteNumber(sample.temperatureC);
  const humidityPct = finiteNumber(sample.humidityPct);
  return {
    source: 'phone',
    temperatureC,
    humidityPct,
    vpdKpa: finiteNumber(calculateVpdKpa(temperatureC, humidityPct)),
    seenAtMs: sample.seenAtMs,
    stale: false
  };
};

const shouldReplaceRuntimeReading = ({
  current,
  candidate,
  preferredShellyBaseUrl
}: {
  current: RuleSensorLiveReading | undefined;
  candidate: RuleSensorLiveReading;
  preferredShellyBaseUrl: string;
}): boolean => {
  if (!current || current.source === 'phone') {
    return true;
  }

  const currentPreferred =
    preferredShellyBaseUrl.length > 0 &&
    normalizeBaseUrl(current.shellyBaseUrl) === preferredShellyBaseUrl;
  const candidatePreferred =
    preferredShellyBaseUrl.length > 0 &&
    normalizeBaseUrl(candidate.shellyBaseUrl) === preferredShellyBaseUrl;

  if (currentPreferred !== candidatePreferred) {
    return candidatePreferred;
  }
  if (current.stale !== candidate.stale) {
    return current.stale && !candidate.stale;
  }
  return candidate.seenAtMs > current.seenAtMs;
};

export const useRuleSensorReadings = ({
  sensorDevices,
  samplesBySensorId,
  preferredShellyBaseUrl
}: RuleSensorReadingsOptions): Record<string, RuleSensorLiveReading> => {
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
      refetchInterval: RULE_SENSOR_RUNTIME_REFRESH_MS,
      refetchIntervalInBackground: false,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    }))
  });

  const readings: Record<string, RuleSensorLiveReading> = {};

  sensorDevices.forEach((device) => {
    const sensorId = normalizeSensorId(device.runtimeAddress);
    const sample = samplesBySensorId[sensorId]?.at(-1);
    const reading = phoneReading(sample);
    if (reading) {
      readings[sensorId] = reading;
    }
  });

  const preferredBaseUrl = normalizeBaseUrl(preferredShellyBaseUrl);
  runtimeInstallations.forEach((installation, index) => {
    const query = runtimeQueries[index];
    const snapshot = query?.data;
    if (!snapshot) {
      return;
    }

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
    const explicitVpdKpa = finiteNumber(diagnostics.lastVpd);
    const candidate: RuleSensorLiveReading = {
      source: 'shelly-runtime',
      temperatureC,
      humidityPct,
      vpdKpa: explicitVpdKpa ?? finiteNumber(calculateVpdKpa(temperatureC, humidityPct)),
      seenAtMs: Math.max(0, fetchedAtMs - ageMs),
      stale:
        diagnostics.dataState === 'st' ||
        (lastSeenUptimeMs !== undefined &&
          currentUptimeMs !== undefined &&
          ageMs > snapshot.rule.staleTimeoutSec * 1000),
      shellyName: installation.shelly.name,
      shellyBaseUrl: installation.shelly.baseUrl
    };

    if (
      shouldReplaceRuntimeReading({
        current: readings[sensorId],
        candidate,
        preferredShellyBaseUrl: preferredBaseUrl
      })
    ) {
      readings[sensorId] = candidate;
    }
  });

  return readings;
};

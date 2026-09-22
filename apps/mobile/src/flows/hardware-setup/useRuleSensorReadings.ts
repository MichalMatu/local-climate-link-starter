import { calculateVpdKpa } from '@lcl/automation-core';
import { climateSensorsForConfig } from '@lcl/script-generator';
import { useQueries } from '@tanstack/react-query';
import type { ClimateInstalledAutomation } from '../installations/model.js';
import { fetchInstalledAutomationDiagnostics } from '../installations/runtimeDiagnostics.js';
import { useInstalledAutomationStore } from '../installations/store.js';
import { installedAutomationDiagnosticsQueryKey } from '../installations/useInstalledAutomationRuntime.js';
import type { HardwareDiagnosticSnapshot } from './schemas.js';
import type { SensorReadingSample } from './sensorReadingsStore.js';
import type { SensorDraftDevice } from './setupDraftStore.js';

const RULE_SENSOR_RUNTIME_REFRESH_MS = 5_000;

export const ruleSensorReadingKey = (sensorId: string): string =>
  sensorId.trim().replace(/[:-]/g, '').toUpperCase();

const normalizeBaseUrl = (baseUrl: string | null | undefined): string =>
  baseUrl?.trim().replace(/\/$/, '').toLowerCase() ?? '';

const finiteNumber = (value: number | null | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export type RuleSensorLiveReading = {
  source?: 'phone' | 'shelly-runtime' | undefined;
  identityProvenance?: 'recovered-runtime' | undefined;
  temperatureC?: number | undefined;
  humidityPct?: number | undefined;
  batteryPct?: number | undefined;
  rssi?: number | undefined;
  vpdKpa?: number | undefined;
  seenAtMs?: number | undefined;
  ageMs?: number | undefined;
  stale?: boolean | undefined;
  shellyName?: string | undefined;
  shellyBaseUrl?: string | undefined;
};

type RuleSensorRuntimeSnapshot = {
  installation: ClimateInstalledAutomation;
  snapshot: HardwareDiagnosticSnapshot;
  fetchedAtMs: number;
};

type RuleSensorReadingsOptions = {
  sensorDevices: readonly SensorDraftDevice[];
  samplesBySensorId: Record<string, SensorReadingSample[]>;
  inheritedSensorIds?: readonly string[] | undefined;
  preferredShellyBaseUrl?: string | null | undefined;
};

type BuildRuleSensorReadingsOptions = RuleSensorReadingsOptions & {
  runtimeSnapshots?: readonly RuleSensorRuntimeSnapshot[];
  nowMs?: number;
};

const isClimateInstallation = (
  installation: ReturnType<
    typeof useInstalledAutomationStore.getState
  >['installations'][number]
): installation is ClimateInstalledAutomation => installation.kind === 'climate';

const samplesForSensor = (
  samplesBySensorId: Record<string, SensorReadingSample[]>,
  sensorId: string
): SensorReadingSample[] | undefined => {
  const direct = samplesBySensorId[sensorId];
  if (direct) return direct;
  return Object.entries(samplesBySensorId).find(
    ([candidateId]) => ruleSensorReadingKey(candidateId) === sensorId
  )?.[1];
};

const phoneReading = (
  sample: SensorReadingSample | undefined,
  nowMs: number
): RuleSensorLiveReading | null => {
  if (!sample || (sample.source !== 'phone-scan' && sample.source !== 'phone-gatt')) {
    return null;
  }

  const temperatureC = finiteNumber(sample.temperatureC);
  const humidityPct = finiteNumber(sample.humidityPct);
  return {
    source: 'phone',
    temperatureC,
    humidityPct,
    batteryPct: finiteNumber(sample.batteryPct),
    rssi: finiteNumber(sample.rssi),
    vpdKpa: finiteNumber(calculateVpdKpa(temperatureC, humidityPct)),
    seenAtMs: sample.seenAtMs,
    ageMs: Math.max(0, nowMs - sample.seenAtMs),
    stale: false
  };
};

const shouldReplaceReading = ({
  current,
  candidate,
  preferredShellyBaseUrl
}: {
  current: RuleSensorLiveReading | undefined;
  candidate: RuleSensorLiveReading;
  preferredShellyBaseUrl: string;
}): boolean => {
  if (!current?.source) return true;

  const currentStale = current.stale === true;
  const candidateStale = candidate.stale === true;
  if (currentStale !== candidateStale) {
    return currentStale && !candidateStale;
  }

  const currentPreferred =
    current.source === 'shelly-runtime' &&
    preferredShellyBaseUrl.length > 0 &&
    normalizeBaseUrl(current.shellyBaseUrl) === preferredShellyBaseUrl;
  const candidatePreferred =
    candidate.source === 'shelly-runtime' &&
    preferredShellyBaseUrl.length > 0 &&
    normalizeBaseUrl(candidate.shellyBaseUrl) === preferredShellyBaseUrl;
  if (currentPreferred !== candidatePreferred) {
    return candidatePreferred;
  }

  if (current.source !== candidate.source) {
    return candidate.source === 'shelly-runtime';
  }

  return (candidate.seenAtMs ?? 0) > (current.seenAtMs ?? 0);
};

const preserveIdentityProvenance = (
  current: RuleSensorLiveReading | undefined,
  candidate: RuleSensorLiveReading
): RuleSensorLiveReading =>
  current?.identityProvenance
    ? { ...candidate, identityProvenance: current.identityProvenance }
    : candidate;

export const buildRuleSensorReadings = ({
  sensorDevices,
  samplesBySensorId,
  inheritedSensorIds = [],
  preferredShellyBaseUrl,
  runtimeSnapshots = [],
  nowMs = Date.now()
}: BuildRuleSensorReadingsOptions): Record<string, RuleSensorLiveReading> => {
  const sensorIds = new Set(
    sensorDevices.map((device) => ruleSensorReadingKey(device.runtimeAddress))
  );
  const readings: Record<string, RuleSensorLiveReading> = {};

  inheritedSensorIds.forEach((runtimeAddress) => {
    const sensorId = ruleSensorReadingKey(runtimeAddress);
    if (!sensorIds.has(sensorId)) return;
    readings[sensorId] = {
      identityProvenance: 'recovered-runtime'
    };
  });

  sensorDevices.forEach((device) => {
    const sensorId = ruleSensorReadingKey(device.runtimeAddress);
    const sample = samplesForSensor(samplesBySensorId, sensorId)?.at(-1);
    const reading = phoneReading(sample, nowMs);
    if (
      reading &&
      shouldReplaceReading({
        current: readings[sensorId],
        candidate: reading,
        preferredShellyBaseUrl: normalizeBaseUrl(preferredShellyBaseUrl)
      })
    ) {
      readings[sensorId] = preserveIdentityProvenance(readings[sensorId], reading);
    }
  });

  const preferredBaseUrl = normalizeBaseUrl(preferredShellyBaseUrl);
  runtimeSnapshots.forEach(({ installation, snapshot, fetchedAtMs }) => {
    const configuredIds = new Set(
      climateSensorsForConfig(installation.config).map((sensor) =>
        ruleSensorReadingKey(sensor.runtimeAddress)
      )
    );
    const currentUptimeMs =
      typeof snapshot.time.uptimeSec === 'number' &&
      Number.isFinite(snapshot.time.uptimeSec)
        ? snapshot.time.uptimeSec * 1000
        : undefined;

    snapshot.sensorDiagnostics.forEach((diagnostic) => {
      const sensorId = ruleSensorReadingKey(diagnostic.runtimeAddress);
      if (!sensorIds.has(sensorId) || !configuredIds.has(sensorId)) return;

      const lastSeenUptimeMs = finiteNumber(diagnostic.lastSeenUptimeMs);
      const ageMs =
        currentUptimeMs !== undefined && lastSeenUptimeMs !== undefined
          ? Math.max(0, currentUptimeMs - lastSeenUptimeMs)
          : undefined;
      const temperatureC = finiteNumber(diagnostic.temperatureC);
      const humidityPct = finiteNumber(diagnostic.humidityPct);
      const candidate: RuleSensorLiveReading = {
        source: 'shelly-runtime',
        temperatureC,
        humidityPct,
        batteryPct: finiteNumber(diagnostic.batteryPct),
        rssi: finiteNumber(diagnostic.rssi),
        vpdKpa: finiteNumber(calculateVpdKpa(temperatureC, humidityPct)),
        seenAtMs: ageMs === undefined ? undefined : Math.max(0, fetchedAtMs - ageMs),
        ageMs,
        stale: !diagnostic.fresh,
        shellyName: installation.shelly.name,
        shellyBaseUrl: installation.shelly.baseUrl
      };

      if (
        shouldReplaceReading({
          current: readings[sensorId],
          candidate,
          preferredShellyBaseUrl: preferredBaseUrl
        })
      ) {
        readings[sensorId] = preserveIdentityProvenance(readings[sensorId], candidate);
      }
    });
  });

  return readings;
};

export const useRuleSensorReadings = ({
  sensorDevices,
  samplesBySensorId,
  inheritedSensorIds,
  preferredShellyBaseUrl
}: RuleSensorReadingsOptions): Record<string, RuleSensorLiveReading> => {
  const installations = useInstalledAutomationStore((state) => state.installations);
  const sensorIds = new Set(
    sensorDevices.map((device) => ruleSensorReadingKey(device.runtimeAddress))
  );
  const runtimeInstallations = installations.filter(
    (installation): installation is ClimateInstalledAutomation =>
      isClimateInstallation(installation) &&
      climateSensorsForConfig(installation.config).some((sensor) =>
        sensorIds.has(ruleSensorReadingKey(sensor.runtimeAddress))
      )
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

  return buildRuleSensorReadings({
    sensorDevices,
    samplesBySensorId,
    inheritedSensorIds,
    preferredShellyBaseUrl,
    runtimeSnapshots: runtimeInstallations.flatMap((installation, index) => {
      const query = runtimeQueries[index];
      return query?.data
        ? [
            {
              installation,
              snapshot: query.data,
              fetchedAtMs: query.dataUpdatedAt > 0 ? query.dataUpdatedAt : Date.now()
            }
          ]
        : [];
    })
  });
};

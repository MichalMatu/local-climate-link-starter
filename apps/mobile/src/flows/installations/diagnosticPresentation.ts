import type { Translate, TranslationKey } from '../../app/i18n.js';
import type { HardwareDiagnosticSnapshot } from '../hardware-setup/schemas.js';

type DiagnosticDetails = HardwareDiagnosticSnapshot['diagnostics'];

const diagnosticReasonKeys = new Set([
  'ab',
  'abh',
  'b',
  'bf',
  'bl',
  'blh',
  'bm',
  'bo',
  'boot',
  'bs',
  'cv',
  'ib',
  'mc',
  'mx',
  'ok',
  'pt',
  'rl',
  'se',
  'st',
  'ta',
  'tm',
  'tr',
  'ts'
]);

export const formatDiagnosticDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.trunc(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    return seconds === 0 ? `${totalMinutes} min` : `${totalMinutes} min ${seconds} s`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

export const formatDiagnosticUptimeAge = (
  valueUptimeMs: number | null | undefined,
  currentUptimeSec: number | null | undefined,
  missing: string,
  t: Translate
): string => {
  if (valueUptimeMs == null) return missing;
  if (currentUptimeSec == null || !Number.isFinite(currentUptimeSec)) {
    return t('hardware.diagnostics.uptimeAt', {
      duration: formatDiagnosticDuration(valueUptimeMs)
    });
  }
  return t('hardware.diagnostics.ageAgo', {
    duration: formatDiagnosticDuration(currentUptimeSec * 1000 - valueUptimeMs)
  });
};

export const formatDiagnosticReason = (reason: string, t: Translate): string =>
  diagnosticReasonKeys.has(reason)
    ? t(`hardware.diagnosticsReason.${reason}` as TranslationKey)
    : t('dashboard.health.unknown');

export const formatBleDataState = (
  diagnostics: DiagnosticDetails,
  t: Translate
): string => {
  const hasRuleValue =
    typeof diagnostics.lastControlValue === 'number' &&
    Number.isFinite(diagnostics.lastControlValue) &&
    typeof diagnostics.lastSeenUptimeMs === 'number' &&
    Number.isFinite(diagnostics.lastSeenUptimeMs);

  if (diagnostics.dataState === 'cv' && diagnostics.lastReason !== 'cv' && hasRuleValue) {
    return '-';
  }
  return formatDiagnosticReason(diagnostics.dataState, t);
};

export const formatDiagnosticNumber = (
  value: number | null | undefined,
  suffix: string,
  missing: string,
  digits = 1
): string =>
  value == null || !Number.isFinite(value)
    ? missing
    : `${value.toFixed(digits)}${suffix}`;

export const formatRelayState = (
  value: boolean | null | undefined,
  missing: string
): string => (value == null ? missing : value ? 'ON' : 'OFF');

export type ClimateBleSensorPresentation = {
  id: string;
  name: string;
  address: string;
  temperature: string;
  humidity: string;
  battery: string;
  rssi: string;
  lastMeasurement: string;
  lastPacket?: string;
  dataState: string;
};

type ClimateBleSensorIdentity = {
  displayName: string;
  runtimeAddress: string;
};

export const formatClimateBleSensorPresentations = (
  sensors: readonly ClimateBleSensorIdentity[],
  snapshot: HardwareDiagnosticSnapshot | undefined,
  missing: string,
  t: Translate
): ClimateBleSensorPresentation[] =>
  sensors.map((sensor, index) => {
    const diagnostics = snapshot?.diagnostics;
    const perSensor = snapshot?.sensorDiagnostics.find(
      (item) => item.runtimeAddress.toUpperCase() === sensor.runtimeAddress.toUpperCase()
    );
    const primary = index === 0;
    return {
      id: sensor.runtimeAddress,
      name: sensor.displayName,
      address: sensor.runtimeAddress,
      temperature: formatDiagnosticNumber(perSensor?.temperatureC, '°C', missing, 1),
      humidity: formatDiagnosticNumber(perSensor?.humidityPct, '%', missing, 1),
      battery: formatDiagnosticNumber(
        perSensor?.batteryPct ?? (primary ? diagnostics?.lastBattery : null),
        '%',
        missing,
        0
      ),
      rssi: formatDiagnosticNumber(
        perSensor?.rssi ?? (primary ? diagnostics?.lastRssi : null),
        ' dBm',
        missing,
        0
      ),
      lastMeasurement: formatDiagnosticUptimeAge(
        perSensor?.lastSeenUptimeMs ?? (primary ? diagnostics?.lastSeenUptimeMs : null),
        snapshot?.time.uptimeSec,
        missing,
        t
      ),
      ...(primary
        ? {
            lastPacket: formatDiagnosticUptimeAge(
              diagnostics?.lastPacketSeenUptimeMs,
              snapshot?.time.uptimeSec,
              missing,
              t
            )
          }
        : {}),
      dataState: perSensor
        ? perSensor.fresh
          ? t('hardware.status.running')
          : t('dashboard.health.stale')
        : primary && diagnostics
          ? formatBleDataState(diagnostics, t)
          : missing
    };
  });

export type ScriptDiagnosticPresentationInput = {
  rpcRunning: boolean | null | undefined;
  configHash: string | null | undefined;
  cpuPercent: number | null | undefined;
  memUsedBytes: number | null | undefined;
  memPeakBytes: number | null | undefined;
  memFreeBytes: number | null | undefined;
  snapshotAge: string;
};

export type ScriptDiagnosticPresentationRow = {
  label: string;
  value: string;
};

const formatDiagnosticBytes = (
  value: number | null | undefined,
  missing: string
): string => {
  if (value == null) return missing;
  return value < 1024 ? `${Math.round(value)} B` : `${(value / 1024).toFixed(1)} KiB`;
};

export const formatScriptDiagnosticRows = (
  input: ScriptDiagnosticPresentationInput,
  missing: string,
  t: Translate
): ScriptDiagnosticPresentationRow[] => [
  {
    label: t('hardware.diagnostics.scriptRpcState'),
    value:
      input.rpcRunning === true
        ? 'RUNNING'
        : input.rpcRunning === false
          ? 'STOPPED'
          : missing
  },
  { label: t('hardware.metrics.configHash'), value: input.configHash ?? missing },
  {
    label: t('hardware.diagnostics.scriptCpu'),
    value: formatDiagnosticNumber(input.cpuPercent, '%', missing, 1)
  },
  {
    label: t('hardware.diagnostics.scriptMemUsed'),
    value: formatDiagnosticBytes(input.memUsedBytes, missing)
  },
  {
    label: t('hardware.diagnostics.scriptMemPeak'),
    value: formatDiagnosticBytes(input.memPeakBytes, missing)
  },
  {
    label: t('hardware.diagnostics.scriptMemFree'),
    value: formatDiagnosticBytes(input.memFreeBytes, missing)
  },
  { label: t('hardware.metrics.snapshotAge'), value: input.snapshotAge }
];

type ClimateDetailDiagnosticResources = {
  script?: {
    running?: boolean | null;
    cpuPercent?: number | null;
    memUsedBytes?: number | null;
    memPeakBytes?: number | null;
    memFreeBytes?: number | null;
  } | null;
};

export const formatClimateDetailDiagnostics = ({
  sensors,
  snapshot,
  resources,
  dataUpdatedAt,
  nowMs,
  missing,
  t
}: {
  sensors: readonly ClimateBleSensorIdentity[];
  snapshot: HardwareDiagnosticSnapshot | undefined;
  resources: ClimateDetailDiagnosticResources | undefined;
  dataUpdatedAt: number;
  nowMs: number;
  missing: string;
  t: Translate;
}) => {
  const snapshotAgeMs = dataUpdatedAt ? Math.max(0, nowMs - dataUpdatedAt) : null;
  const snapshotAge =
    snapshotAgeMs == null
      ? missing
      : snapshotAgeMs < 60_000
        ? `${Math.floor(snapshotAgeMs / 1000)} s`
        : `${Math.floor(snapshotAgeMs / 60_000)} min`;

  return {
    bleSensors: formatClimateBleSensorPresentations(sensors, snapshot, missing, t),
    scriptRows: formatScriptDiagnosticRows(
      {
        rpcRunning: resources?.script?.running,
        configHash: snapshot?.script?.configHash,
        cpuPercent: resources?.script?.cpuPercent,
        memUsedBytes: resources?.script?.memUsedBytes,
        memPeakBytes: resources?.script?.memPeakBytes,
        memFreeBytes: resources?.script?.memFreeBytes,
        snapshotAge
      },
      missing,
      t
    )
  };
};

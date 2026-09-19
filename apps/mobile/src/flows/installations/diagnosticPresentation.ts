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
    : reason;

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

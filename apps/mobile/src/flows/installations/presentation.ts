import type { RulePresetId } from '@lcl/automation-core';
import type { Translate, TranslationKey } from '../../app/i18n.js';
import type { ClimateInstalledAutomation } from './model.js';
import type { InstalledAutomationHealth } from './runtimeDiagnostics.js';

export const INSTALLATION_MODE_KEYS: Record<RulePresetId, TranslationKey> = {
  heating: 'hardware.rule.preset.heating',
  cooling: 'hardware.rule.preset.cooling',
  humidifying: 'hardware.rule.preset.humidifying',
  dehumidifying: 'hardware.rule.preset.dehumidifying'
};

export const installationHealthLabel = (
  health: InstalledAutomationHealth,
  t: Translate
): string => {
  switch (health) {
    case 'ok':
      return t('dashboard.health.ok');
    case 'stale':
      return t('dashboard.health.stale');
    case 'unknown':
      return t('dashboard.health.unknown');
  }
};

export const formatInstallationMetric = (
  value: number | null | undefined,
  unit: string,
  digits = 1
): string =>
  value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(digits)}${unit}`;

export const formatInstallationVpd = (
  currentVpdKpa: number | null | undefined,
  targetVpdKpa?: number | null
): string => {
  if (currentVpdKpa == null || !Number.isFinite(currentVpdKpa)) return '—';
  const current = currentVpdKpa.toFixed(2);
  return targetVpdKpa != null && Number.isFinite(targetVpdKpa)
    ? `${current} → ${targetVpdKpa.toFixed(2)} kPa`
    : `${current} kPa`;
};

export const installationThresholdSummary = (
  installation: ClimateInstalledAutomation,
  t: Translate
): string => {
  const { metric, onThreshold, offThreshold } = installation.config.rule.control;
  const unit = metric === 'humidity' ? '%' : '°C';
  const digits = metric === 'humidity' ? 0 : 2;
  const formatThreshold = (value: number) => String(Number(value.toFixed(digits)));
  return `${t('common.on')} ${formatThreshold(onThreshold)}${unit} · ${t('common.off')} ${formatThreshold(offThreshold)}${unit}`;
};

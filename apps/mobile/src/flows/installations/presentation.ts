import type { RulePresetId } from '@lcl/automation-core';
import type { Translate, TranslationKey } from '../../app/i18n.js';
import type { InstalledAutomation } from './model.js';
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

export const installationThresholdSummary = (
  installation: InstalledAutomation,
  effectiveOnThreshold?: number | null,
  effectiveOffThreshold?: number | null
): string => {
  const { metric, onThreshold, offThreshold } = installation.config.rule.control;
  const unit = metric === 'humidity' ? '%' : '°C';
  const activeOnThreshold =
    effectiveOnThreshold != null && Number.isFinite(effectiveOnThreshold)
      ? effectiveOnThreshold
      : onThreshold;
  const activeOffThreshold =
    effectiveOffThreshold != null && Number.isFinite(effectiveOffThreshold)
      ? effectiveOffThreshold
      : offThreshold;
  return `${activeOnThreshold}${unit} / ${activeOffThreshold}${unit}`;
};

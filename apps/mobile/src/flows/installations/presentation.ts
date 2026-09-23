import {
  calculateHumidityForVpdKpa,
  calculateTemperatureForVpdKpa,
  calculateVpdKpa,
  type RulePresetId
} from '@lcl/automation-core';
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

export type InstallationVpdDerivedControl = {
  targetValue: number | null | undefined;
  effectiveOnThreshold: number | null | undefined;
  effectiveOffThreshold: number | null | undefined;
  unit: '%' | '°C';
};

const formatControlValue = (value: number, unit: '%' | '°C'): string =>
  String(Number(value.toFixed(unit === '%' ? 0 : 1)));

export const formatInstallationVpd = (
  currentVpdKpa: number | null | undefined,
  targetVpdKpa?: number | null,
  derivedControl?: InstallationVpdDerivedControl
): string => {
  if (currentVpdKpa == null || !Number.isFinite(currentVpdKpa)) return '—';
  const current = currentVpdKpa.toFixed(2);
  if (targetVpdKpa == null || !Number.isFinite(targetVpdKpa)) return `${current} kPa`;

  const base = `${current} → ${targetVpdKpa.toFixed(2)}`;
  const targetValue = derivedControl?.targetValue;
  if (!derivedControl || targetValue == null || !Number.isFinite(targetValue))
    return `${base} kPa`;

  const target = formatControlValue(targetValue, derivedControl.unit);
  const on = derivedControl.effectiveOnThreshold;
  const off = derivedControl.effectiveOffThreshold;
  if (on == null || off == null || !Number.isFinite(on) || !Number.isFinite(off)) {
    return `${base} → ${target}${derivedControl.unit}`;
  }

  const lower = formatControlValue(Math.min(on, off), derivedControl.unit);
  const upper = formatControlValue(Math.max(on, off), derivedControl.unit);
  return `${base} → ${target}${derivedControl.unit} · ${lower}–${upper}${derivedControl.unit}`;
};

export type InstallationVpdDiagnostics = {
  lastVpd?: number | null;
  lastTemp?: number | null;
  lastHumidity?: number | null;
  lastEffectiveOnThreshold?: number | null;
  lastEffectiveOffThreshold?: number | null;
};

export const installationVpdSummary = (
  installation: ClimateInstalledAutomation,
  diagnostics?: InstallationVpdDiagnostics
): string => {
  const currentVpdKpa =
    diagnostics?.lastVpd ??
    calculateVpdKpa(
      diagnostics?.lastTemp ?? undefined,
      diagnostics?.lastHumidity ?? undefined
    );
  const targetVpdKpa = installation.config.rule.vpdAssist.enabled
    ? installation.config.rule.vpdAssist.targetKpa
    : null;
  if (targetVpdKpa == null) return formatInstallationVpd(currentVpdKpa, null);

  const control = installation.config.rule.control;
  const rawTarget =
    control.metric === 'humidity'
      ? calculateHumidityForVpdKpa(targetVpdKpa, diagnostics?.lastTemp ?? undefined)
      : calculateTemperatureForVpdKpa(
          targetVpdKpa,
          diagnostics?.lastHumidity ?? undefined
        );
  const lowerLimit = Math.min(control.onThreshold, control.offThreshold);
  const upperLimit = Math.max(control.onThreshold, control.offThreshold);
  const targetValue =
    rawTarget == null || !Number.isFinite(rawTarget)
      ? undefined
      : Math.min(upperLimit, Math.max(lowerLimit, rawTarget));

  return formatInstallationVpd(currentVpdKpa, targetVpdKpa, {
    targetValue,
    effectiveOnThreshold: diagnostics?.lastEffectiveOnThreshold,
    effectiveOffThreshold: diagnostics?.lastEffectiveOffThreshold,
    unit: control.metric === 'humidity' ? '%' : '°C'
  });
};

export const installationThresholdSummary = (
  installation: ClimateInstalledAutomation,
  t: Translate
): string => {
  const { metric, onThreshold, offThreshold } = installation.config.rule.control;
  const unit = metric === 'humidity' ? '%' : '°C';
  const digits = metric === 'humidity' ? 0 : 1;
  const formatThreshold = (value: number) => String(Number(value.toFixed(digits)));
  return `${t('common.on')} ${formatThreshold(onThreshold)}${unit} · ${t('common.off')} ${formatThreshold(offThreshold)}${unit}`;
};

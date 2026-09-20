import type { RulePresetId, ThresholdDirection } from '@lcl/automation-core';
import type { Translate, TranslationKey } from '../../../app/i18n.js';

export type RuleControlCopy = {
  labelKey: TranslationKey;
  actionLabelKey: TranslationKey;
  direction: ThresholdDirection;
  unit: string;
  onLabelKey: TranslationKey;
  offLabelKey: TranslationKey;
};

export const RULE_PRESET_COPY: Record<RulePresetId, RuleControlCopy> = {
  heating: {
    labelKey: 'hardware.rule.preset.heating',
    actionLabelKey: 'hardware.rule.preset.heatingAction',
    direction: 'below',
    unit: '°C',
    onLabelKey: 'hardware.rule.thresholdOnBelowC',
    offLabelKey: 'hardware.rule.thresholdOffAboveC'
  },
  cooling: {
    labelKey: 'hardware.rule.preset.cooling',
    actionLabelKey: 'hardware.rule.preset.coolingAction',
    direction: 'above',
    unit: '°C',
    onLabelKey: 'hardware.rule.thresholdOnAboveC',
    offLabelKey: 'hardware.rule.thresholdOffBelowC'
  },
  humidifying: {
    labelKey: 'hardware.rule.preset.humidifying',
    actionLabelKey: 'hardware.rule.preset.humidifyingAction',
    direction: 'below',
    unit: '%',
    onLabelKey: 'hardware.rule.thresholdOnBelowPct',
    offLabelKey: 'hardware.rule.thresholdOffAbovePct'
  },
  dehumidifying: {
    labelKey: 'hardware.rule.preset.dehumidifying',
    actionLabelKey: 'hardware.rule.preset.dehumidifyingAction',
    direction: 'above',
    unit: '%',
    onLabelKey: 'hardware.rule.thresholdOnAbovePct',
    offLabelKey: 'hardware.rule.thresholdOffBelowPct'
  }
};

export const ALL_RULE_PRESETS: readonly RulePresetId[] = [
  'heating',
  'cooling',
  'humidifying',
  'dehumidifying'
];

export const stripTrailingUnit = (label: string, unit: string): string => {
  const suffix = ` (${unit})`;
  return label.endsWith(suffix) ? label.slice(0, -suffix.length) : label;
};

const formatCompactSensorMetric = (
  value: number | undefined,
  unit: string,
  fractionDigits: number
): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(fractionDigits)}${unit}`
    : `—${unit}`;

export const formatSensorLiveSummary = (
  reading:
    | {
        temperatureC?: number | undefined;
        humidityPct?: number | undefined;
      }
    | undefined
): string =>
  `${formatCompactSensorMetric(reading?.temperatureC, '°C', 1)} · ${formatCompactSensorMetric(
    reading?.humidityPct,
    '%',
    1
  )}`;

export const formatRuleSummary = ({
  actionLabel,
  direction,
  onThreshold,
  offThreshold,
  unit,
  staleTimeoutMin,
  minChangeMin,
  maxOnHours,
  shellyName,
  sensorName,
  vpdAssist,
  rssiMinDbm,
  t
}: {
  actionLabel: string;
  direction: ThresholdDirection;
  onThreshold: number;
  offThreshold: number;
  unit: string;
  staleTimeoutMin: number;
  minChangeMin: number;
  maxOnHours: number;
  shellyName?: string | undefined;
  sensorName?: string | undefined;
  vpdAssist?: string | undefined;
  rssiMinDbm?: number | undefined;
  t: Translate;
}): string => {
  const onComparator =
    direction === 'below'
      ? t('hardware.rule.comparator.below')
      : t('hardware.rule.comparator.above');
  const offComparator =
    direction === 'below'
      ? t('hardware.rule.comparator.above')
      : t('hardware.rule.comparator.below');
  const actionName = `${actionLabel.charAt(0).toUpperCase()}${actionLabel.slice(1)}`;
  const sensorLabel = sensorName
    ? t('hardware.rule.summarySensorNamed', { address: sensorName })
    : t('hardware.rule.summarySensorDefault');
  const shellyLabel = shellyName
    ? t('hardware.rule.summaryShellyNamed', { address: shellyName })
    : t('hardware.rule.summaryShellyDefault');
  const vpdCopy = vpdAssist ? t('hardware.rule.summaryVpd', { vpd: vpdAssist }) : '';
  const rssiCopy = Number.isFinite(rssiMinDbm)
    ? t('hardware.rule.summaryRssi', { rssi: rssiMinDbm as number })
    : '';

  return t('hardware.rule.summary', {
    action: actionName,
    onComparator,
    onThreshold: onThreshold.toFixed(1),
    offComparator,
    offThreshold: offThreshold.toFixed(1),
    unit,
    sensor: sensorLabel,
    staleTimeoutMin,
    shelly: shellyLabel,
    maxOnHours,
    minChangeMin,
    vpd: vpdCopy,
    rssi: rssiCopy
  });
};

import type { ShellyClockStatus } from '@lcl/shelly-client';
import type { Translate } from '../../app/i18n.js';

const formatMetric = (
  value: number | undefined,
  missing: string,
  suffix: string,
  digits: number
): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(digits)}${suffix}`
    : missing;

export const formatPlugPower = (value: number | undefined, t: Translate): string =>
  formatMetric(value, t('common.missing'), ' W', 1);

export const formatPlugVoltage = (value: number | undefined, t: Translate): string =>
  formatMetric(value, t('common.missing'), ' V', 0);

export const formatPlugEnergy = (value: number | undefined, t: Translate): string => {
  if (value === undefined || !Number.isFinite(value)) return t('common.missing');
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kWh` : `${value.toFixed(0)} Wh`;
};

export const formatPlugClock = (
  clock: ShellyClockStatus | undefined,
  t: Translate
): string => clock?.localTime ?? t('common.missing');

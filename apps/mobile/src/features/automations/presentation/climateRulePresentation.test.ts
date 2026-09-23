import { describe, expect, it } from 'vitest';
import type { Translate } from '../../../app/i18n.js';
import { formatVpdWorkingRange } from './climateRulePresentation.js';

const t = ((key: string, params?: Record<string, string | number>) =>
  key === 'hardware.rule.vpdWorkingRange'
    ? `${params?.min}–${params?.max}${params?.unit} · ${params?.metric}`
    : key) as Translate;

describe('climate rule presentation', () => {
  it('formats the VPD clamp range from valid rule thresholds', () => {
    expect(
      formatVpdWorkingRange({
        isThresholdValid: true,
        onThresholdInput: '19',
        offThresholdInput: '20',
        unit: '°C',
        metricLabel: 'Temperature',
        t
      })
    ).toBe('19–20°C · Temperature');
  });

  it('hides the VPD clamp range for empty or invalid thresholds', () => {
    expect(
      formatVpdWorkingRange({
        isThresholdValid: true,
        onThresholdInput: '',
        offThresholdInput: '20',
        unit: '°C',
        metricLabel: 'Temperature',
        t
      })
    ).toBeNull();
    expect(
      formatVpdWorkingRange({
        isThresholdValid: false,
        onThresholdInput: '20',
        offThresholdInput: '19',
        unit: '°C',
        metricLabel: 'Temperature',
        t
      })
    ).toBeNull();
  });
});

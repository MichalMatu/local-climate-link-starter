import { describe, expect, it } from 'vitest';
import {
  defaultRulePresetForSetupIntent,
  rulePresetsForSetupIntent
} from './setup-intent.js';

describe('setup intent', () => {
  it('keeps temperature and humidity modes inside their matching user goal', () => {
    expect(rulePresetsForSetupIntent('temperature')).toEqual(['heating', 'cooling']);
    expect(rulePresetsForSetupIntent('humidity')).toEqual([
      'humidifying',
      'dehumidifying'
    ]);
    expect(rulePresetsForSetupIntent('manage')).toEqual([
      'heating',
      'cooling',
      'humidifying',
      'dehumidifying'
    ]);
  });

  it('selects a safe default only when a new goal needs one', () => {
    expect(defaultRulePresetForSetupIntent('temperature')).toBe('heating');
    expect(defaultRulePresetForSetupIntent('humidity')).toBe('humidifying');
    expect(defaultRulePresetForSetupIntent('manage')).toBeNull();
  });
});

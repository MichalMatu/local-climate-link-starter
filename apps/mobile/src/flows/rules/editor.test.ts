import { describe, expect, it } from 'vitest';
import { climate, plug, sensor, time } from '../registry/fixtures.test-support.js';
import {
  buildDesiredRule,
  changeRuleEditorPreset,
  createRuleEditorState,
  validateRuleEditorState
} from './editor.js';

describe('rule editor model', () => {
  it('builds a climate rule from independent saved device references', () => {
    const state = {
      ...createRuleEditorState({
        intent: 'temperature',
        rule: null,
        plugs: [plug],
        sensors: [sensor]
      }),
      name: 'Greenhouse heat'
    };
    const result = buildDesiredRule({
      state,
      intent: 'temperature',
      existing: null,
      plugs: [plug],
      sensors: [sensor],
      rules: [],
      newId: 'rule-new',
      nowMs: 10
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: 'rule-new',
      kind: 'climate',
      name: 'Greenhouse heat',
      plugId: plug.id,
      sensorId: sensor.id,
      deployment: null
    });
  });

  it('builds a time rule without a thermometer and keeps weekday selection', () => {
    const state = {
      ...createRuleEditorState({
        intent: 'time',
        rule: null,
        plugs: [plug],
        sensors: []
      }),
      name: 'Light timer',
      days: [1, 2, 3, 4, 5] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[]
    };
    const result = buildDesiredRule({
      state,
      intent: 'time',
      existing: null,
      plugs: [plug],
      sensors: [],
      rules: [],
      newId: 'time-new',
      nowMs: 20
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'time') return;
    expect(result.value.config.schedule.windows[0]?.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects another rule owning the same physical relay', () => {
    const state = {
      ...createRuleEditorState({
        intent: 'time',
        rule: null,
        plugs: [plug],
        sensors: []
      }),
      name: 'Conflict'
    };
    expect(
      validateRuleEditorState({
        state,
        intent: 'time',
        ruleId: null,
        plugs: [plug],
        sensors: [],
        rules: [climate]
      }).plug
    ).toBe('conflict');
  });

  it('resets thresholds when the climate mode changes and preserves advanced settings on edit', () => {
    const existing = {
      ...climate,
      config: {
        ...climate.config,
        rule: { ...climate.config.rule, rssiMin: -77 }
      }
    };
    const initial = createRuleEditorState({
      intent: 'temperature',
      rule: existing,
      plugs: [plug],
      sensors: [sensor]
    });
    const changed = changeRuleEditorPreset(initial, 'cooling');
    const result = buildDesiredRule({
      state: changed,
      intent: 'temperature',
      existing,
      plugs: [plug],
      sensors: [sensor],
      rules: [existing],
      newId: 'unused',
      nowMs: 30
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'climate') return;
    expect(result.value.config.rule.mode).toBe('cooling');
    expect(result.value.config.rule.rssiMin).toBe(-77);
  });

  it('loads existing time schedule into the editor', () => {
    const state = createRuleEditorState({
      intent: 'time',
      rule: time,
      plugs: [plug],
      sensors: []
    });
    expect(state).toMatchObject({ start: '08:00', end: '20:00', scheduleEnabled: true });
  });
});

import { describe, expect, it } from 'vitest';
import { plug, sensor } from '../registry/fixtures.test-support.js';
import { createRuleDraft, defaultTimeRuleSchedule } from './draft.js';
import type { RuleSchedule } from './model.js';

describe('rule drafts', () => {
  it('creates an independent climate rule from saved device references', () => {
    const rule = createRuleDraft({
      id: 'rule-1',
      name: 'My own rule name',
      intent: 'temperature',
      plug: { ...plug, name: 'Renamed plug' },
      sensor: { ...sensor, name: 'Renamed sensor' },
      nowMs: 10
    });
    expect(rule.kind).toBe('climate');
    expect(rule.name).toBe('My own rule name');
    expect(rule.plugId).toBe(plug.id);
    expect(rule.kind === 'climate' && rule.sensorId).toBe(sensor.id);
    expect(rule.deployment).toBeNull();
  });

  it('creates a native time rule without requiring a sensor', () => {
    const rule = createRuleDraft({
      id: 'time-new',
      name: 'Lamp schedule',
      intent: 'time',
      plug,
      nowMs: 20
    });
    expect(rule.kind).toBe('time');
    expect(rule.kind === 'time' && rule.config.schedule).toEqual(defaultTimeRuleSchedule);
  });

  it('accepts climate active hours as desired rule config', () => {
    const schedule: RuleSchedule = {
      windows: [{ days: [1, 2, 3, 4, 5], start: '06:00', end: '22:00' }]
    };
    const rule = createRuleDraft({
      id: 'rule-hours',
      name: 'Day climate',
      intent: 'humidity',
      plug,
      sensor,
      schedule,
      nowMs: 30
    });
    expect(rule.kind === 'climate' && rule.schedule).toEqual(schedule);
  });
});

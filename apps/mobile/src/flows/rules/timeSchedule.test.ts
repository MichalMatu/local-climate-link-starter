import { describe, expect, it } from 'vitest';
import { time } from '../registry/fixtures.test-support.js';
import type { RuleTimeWindow } from './model.js';
import {
  createRuleScheduleJob,
  expectedTimeRulePair,
  ruleScheduleJobMatches
} from './timeSchedule.js';

describe('time rule native schedule compiler', () => {
  it('compiles weekday windows to Shelly local-time cron jobs', () => {
    const window: RuleTimeWindow = { days: [1, 3, 5], start: '08:15', end: '20:45' };
    expect(createRuleScheduleJob(window, 0, 'on')).toMatchObject({
      timespec: '0 15 8 * * MON,WED,FRI',
      calls: [{ method: 'Switch.Set', params: { id: 0, on: true } }]
    });
    expect(createRuleScheduleJob(window, 0, 'off')).toMatchObject({
      timespec: '0 45 20 * * MON,WED,FRI',
      calls: [{ method: 'Switch.Set', params: { id: 0, on: false } }]
    });
  });

  it('shifts only the OFF weekdays for a cross-midnight window', () => {
    const window: RuleTimeWindow = { days: [5, 6], start: '22:00', end: '02:00' };
    expect(createRuleScheduleJob(window, 0, 'on').timespec).toBe('0 0 22 * * FRI,SAT');
    expect(createRuleScheduleJob(window, 0, 'off').timespec).toBe('0 0 2 * * SUN,SAT');
  });

  it('derives an exact pair for each normalized rule window and detects drift', () => {
    const expected = expectedTimeRulePair(time, 0);
    const on = { id: 8, ...expected.on };
    expect(ruleScheduleJobMatches(on, expected.on)).toBe(true);
    expect(ruleScheduleJobMatches({ ...on, timespec: 'changed' }, expected.on)).toBe(
      false
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  isRuleScheduleActive,
  normalizeRuleSchedule,
  parseRuleClockMinutes,
  type RuleSchedule
} from '../schedule.js';

describe('rule schedule', () => {
  it('parses valid clock values and rejects malformed values', () => {
    expect(parseRuleClockMinutes('00:00')).toBe(0);
    expect(parseRuleClockMinutes('23:59')).toBe(1439);
    expect(parseRuleClockMinutes('24:00')).toBeNull();
    expect(parseRuleClockMinutes('8:00')).toBeNull();
  });

  it('normalizes day/window order and exact duplicates deterministically', () => {
    const schedule: RuleSchedule = {
      windows: [
        { days: [5, 1, 1, 3], start: '22:00', end: '02:00' },
        { days: [3, 5, 1], start: '22:00', end: '02:00' },
        { days: [0], start: '08:00', end: '10:00' }
      ]
    };

    expect(normalizeRuleSchedule(schedule)).toEqual({
      windows: [
        { days: [0], start: '08:00', end: '10:00' },
        { days: [1, 3, 5], start: '22:00', end: '02:00' }
      ]
    });
  });

  it('fails closed for malformed clock input and invalid windows', () => {
    expect(
      isRuleScheduleActive(
        { windows: [{ days: [1], start: '08:00', end: '10:00' }] },
        1,
        'not-a-time'
      )
    ).toBe(false);
    expect(
      isRuleScheduleActive(
        { windows: [{ days: [1], start: 'bad', end: '10:00' }] },
        1,
        '09:00'
      )
    ).toBe(false);
    expect(
      isRuleScheduleActive(
        { windows: [{ days: [1], start: '08:00', end: 'bad' }] },
        1,
        '09:00'
      )
    ).toBe(false);
    expect(
      isRuleScheduleActive(
        { windows: [{ days: [1], start: '08:00', end: '08:00' }] },
        1,
        '08:00'
      )
    ).toBe(false);
  });

  it('evaluates same-day and cross-midnight windows using the starting weekday', () => {
    const schedule: RuleSchedule = {
      windows: [
        { days: [1], start: '08:00', end: '10:00' },
        { days: [5], start: '22:00', end: '02:00' }
      ]
    };

    expect(isRuleScheduleActive(schedule, 1, '08:00')).toBe(true);
    expect(isRuleScheduleActive(schedule, 1, '10:00')).toBe(false);
    expect(isRuleScheduleActive(schedule, 5, '23:30')).toBe(true);
    expect(isRuleScheduleActive(schedule, 6, '01:30')).toBe(true);
    expect(isRuleScheduleActive(schedule, 6, '02:00')).toBe(false);
    expect(isRuleScheduleActive(schedule, 0, '01:30')).toBe(false);
  });
});

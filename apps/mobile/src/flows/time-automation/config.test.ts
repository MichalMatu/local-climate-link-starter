import { describe, expect, it } from 'vitest';
import {
  dailyScheduleTimespec,
  dailyTimeAutomationConfigSchema,
  expectedRelayOnForClockTime
} from './config.js';

describe('daily time automation config', () => {
  it('builds a Shelly six-field daily cron without leading zeroes', () => {
    expect(dailyScheduleTimespec('08:03')).toBe('0 3 8 * * SUN,MON,TUE,WED,THU,FRI,SAT');
  });

  it('evaluates same-day and overnight ON windows', () => {
    expect(
      expectedRelayOnForClockTime(
        { relayId: 0, onTime: '08:00', offTime: '20:00' },
        '12:30'
      )
    ).toBe(true);
    expect(
      expectedRelayOnForClockTime(
        { relayId: 0, onTime: '20:00', offTime: '08:00' },
        '23:15'
      )
    ).toBe(true);
    expect(
      expectedRelayOnForClockTime(
        { relayId: 0, onTime: '20:00', offTime: '08:00' },
        '12:00'
      )
    ).toBe(false);
  });

  it('rejects an ambiguous identical ON/OFF time', () => {
    expect(
      dailyTimeAutomationConfigSchema.safeParse({
        relayId: 0,
        onTime: '08:00',
        offTime: '08:00'
      }).success
    ).toBe(false);
  });
});

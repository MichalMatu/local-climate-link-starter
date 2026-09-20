import { describe, expect, it } from 'vitest';
import {
  dailyScheduleTimespec,
  expectedRelayOnForClockTime,
  parseClockMinutes
} from '../time/schedule.js';

describe('daily time automation domain', () => {
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

  it('rejects malformed clock text at the pure domain boundary', () => {
    expect(parseClockMinutes('24:00')).toBeNull();
    expect(() => dailyScheduleTimespec('bad')).toThrow('Invalid clock time');
  });

  it('rejects invalid or ambiguous clocks when evaluating relay state', () => {
    expect(() =>
      expectedRelayOnForClockTime(
        { relayId: 0, onTime: '08:00', offTime: '20:00' },
        'bad'
      )
    ).toThrow('Cannot evaluate the daily schedule clock state.');
    expect(() =>
      expectedRelayOnForClockTime(
        { relayId: 0, onTime: 'bad', offTime: '20:00' },
        '12:00'
      )
    ).toThrow('Cannot evaluate the daily schedule clock state.');
    expect(() =>
      expectedRelayOnForClockTime(
        { relayId: 0, onTime: '08:00', offTime: 'bad' },
        '12:00'
      )
    ).toThrow('Cannot evaluate the daily schedule clock state.');
    expect(() =>
      expectedRelayOnForClockTime(
        { relayId: 0, onTime: '08:00', offTime: '08:00' },
        '12:00'
      )
    ).toThrow('Cannot evaluate the daily schedule clock state.');
  });

  it('keeps overnight schedules ON before the morning OFF boundary', () => {
    expect(
      expectedRelayOnForClockTime(
        { relayId: 0, onTime: '20:00', offTime: '08:00' },
        '06:30'
      )
    ).toBe(true);
    expect(
      expectedRelayOnForClockTime(
        { relayId: 0, onTime: '08:00', offTime: '20:00' },
        '07:30'
      )
    ).toBe(false);
    expect(
      expectedRelayOnForClockTime(
        { relayId: 0, onTime: '08:00', offTime: '20:00' },
        '21:00'
      )
    ).toBe(false);
  });
});

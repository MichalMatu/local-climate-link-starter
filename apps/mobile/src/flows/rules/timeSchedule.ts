import { parseRuleClockMinutes, type Weekday } from '@lcl/automation-core';
import type { ShellyScheduleJob, ShellyScheduleJobConfig } from '@lcl/shelly-client';
import type { RuleTimeWindow, TimeRule } from './model.js';

const weekdayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

type RuleScheduleJobConfig = ShellyScheduleJobConfig & { enable: boolean };

const shiftWeekdays = (days: readonly Weekday[], offset: number): Weekday[] =>
  days
    .map((day) => ((day + offset + 7) % 7) as Weekday)
    .sort((left, right) => left - right);

const windowDaysForEdge = (window: RuleTimeWindow, edge: 'on' | 'off'): Weekday[] => {
  const start = parseRuleClockMinutes(window.start);
  const end = parseRuleClockMinutes(window.end);
  if (start === null || end === null || start === end) {
    throw new Error('Validated rule schedule contains an invalid time window.');
  }
  return edge === 'off' && start > end ? shiftWeekdays(window.days, 1) : [...window.days];
};

const ruleWindowTimespec = (window: RuleTimeWindow, edge: 'on' | 'off'): string => {
  const time = edge === 'on' ? window.start : window.end;
  const minutes = parseRuleClockMinutes(time);
  if (minutes === null) throw new Error(`Invalid rule clock time: ${time}.`);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const days = windowDaysForEdge(window, edge)
    .map((day) => weekdayNames[day])
    .join(',');
  return `0 ${minute} ${hour} * * ${days}`;
};

const switchScheduleCall = (relayId: number, on: boolean) => ({
  method: 'Switch.Set',
  params: { id: relayId, on }
});

export const createRuleScheduleJob = (
  window: RuleTimeWindow,
  relayId: number,
  edge: 'on' | 'off',
  enable = true
): RuleScheduleJobConfig => ({
  enable,
  timespec: ruleWindowTimespec(window, edge),
  calls: [switchScheduleCall(relayId, edge === 'on')]
});

export const ruleScheduleJobMatches = (
  job: ShellyScheduleJob | null,
  expected: ShellyScheduleJobConfig
): boolean => {
  if (!job || job.timespec !== expected.timespec || job.calls.length !== 1) return false;
  const actualCall = job.calls[0];
  const expectedCall = expected.calls[0];
  return Boolean(
    actualCall &&
    expectedCall &&
    actualCall.method === expectedCall.method &&
    JSON.stringify(actualCall.params ?? {}) === JSON.stringify(expectedCall.params ?? {})
  );
};

export const expectedTimeRulePair = (
  rule: TimeRule,
  windowIndex: number
): { on: RuleScheduleJobConfig; off: RuleScheduleJobConfig } => {
  const window = rule.config.schedule.windows[windowIndex];
  if (!window) throw new Error(`Missing time-rule window ${windowIndex}.`);
  return {
    on: createRuleScheduleJob(window, rule.relayId, 'on'),
    off: createRuleScheduleJob(window, rule.relayId, 'off')
  };
};

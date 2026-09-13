export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RuleTimeWindow = {
  days: Weekday[];
  start: string;
  end: string;
};

export type RuleSchedule = {
  windows: RuleTimeWindow[];
};

const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const parseRuleClockMinutes = (time: string): number | null => {
  const match = CLOCK_TIME_PATTERN.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const windowKey = (window: RuleTimeWindow): string =>
  `${window.days.join(',')}|${window.start}|${window.end}`;

export const normalizeRuleSchedule = (schedule: RuleSchedule): RuleSchedule => {
  const windows = schedule.windows
    .map((window) => ({
      days: [...new Set(window.days)].sort((left, right) => left - right) as Weekday[],
      start: window.start,
      end: window.end
    }))
    .sort((left, right) => windowKey(left).localeCompare(windowKey(right)));

  return {
    windows: windows.filter(
      (window, index) =>
        index === 0 || windowKey(window) !== windowKey(windows[index - 1]!)
    )
  };
};

export const isRuleScheduleActive = (
  schedule: RuleSchedule,
  weekday: Weekday,
  clockTime: string
): boolean => {
  const current = parseRuleClockMinutes(clockTime);
  if (current === null) return false;

  return schedule.windows.some((window) => {
    const start = parseRuleClockMinutes(window.start);
    const end = parseRuleClockMinutes(window.end);
    if (start === null || end === null || start === end) return false;

    if (start < end) {
      return window.days.includes(weekday) && current >= start && current < end;
    }

    const previousWeekday = ((weekday + 6) % 7) as Weekday;
    return (
      (window.days.includes(weekday) && current >= start) ||
      (window.days.includes(previousWeekday) && current < end)
    );
  });
};

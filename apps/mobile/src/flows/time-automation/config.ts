import { z } from 'zod';

const DAILY_TIMESPEC_DAYS = 'SUN,MON,TUE,WED,THU,FRI,SAT';
const clockTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const dailyTimeAutomationConfigSchema = z
  .object({
    relayId: z.number().int().nonnegative().default(0),
    onTime: z.string().regex(clockTimePattern),
    offTime: z.string().regex(clockTimePattern)
  })
  .refine((value) => value.onTime !== value.offTime, {
    message: 'ON and OFF times must be different.',
    path: ['offTime']
  });

export type DailyTimeAutomationConfig = z.infer<typeof dailyTimeAutomationConfigSchema>;

export const parseClockMinutes = (time: string): number | null => {
  const match = clockTimePattern.exec(time);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
};

export const dailyScheduleTimespec = (time: string): string => {
  const minutes = parseClockMinutes(time);
  if (minutes === null) {
    throw new Error(`Invalid clock time: ${time}.`);
  }
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `0 ${minute} ${hour} * * ${DAILY_TIMESPEC_DAYS}`;
};

export const expectedRelayOnForClockTime = (
  config: DailyTimeAutomationConfig,
  localTime: string
): boolean => {
  const current = parseClockMinutes(localTime.slice(0, 5));
  const on = parseClockMinutes(config.onTime);
  const off = parseClockMinutes(config.offTime);
  if (current === null || on === null || off === null || on === off) {
    throw new Error('Cannot evaluate the daily schedule clock state.');
  }

  return on < off ? current >= on && current < off : current >= on || current < off;
};

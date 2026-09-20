import {
  dailyScheduleTimespec,
  expectedRelayOnForClockTime,
  parseClockMinutes,
  type DailyTimeAutomationConfig
} from '@lcl/automation-core';
import { z } from 'zod';

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

export {
  dailyScheduleTimespec,
  expectedRelayOnForClockTime,
  parseClockMinutes,
  type DailyTimeAutomationConfig
};

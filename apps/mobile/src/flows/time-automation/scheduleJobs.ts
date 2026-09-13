import type { ShellyScheduleJob, ShellyScheduleJobConfig } from '@lcl/shelly-client';
import { dailyScheduleTimespec, type DailyTimeAutomationConfig } from './config.js';

const switchScheduleCall = (relayId: number, on: boolean) => ({
  method: 'Switch.Set',
  params: { id: relayId, on }
});

export const createDailyScheduleJob = (
  config: DailyTimeAutomationConfig,
  on: boolean,
  enable = true
): ShellyScheduleJobConfig & { enable: boolean } => ({
  enable,
  timespec: dailyScheduleTimespec(on ? config.onTime : config.offTime),
  calls: [switchScheduleCall(config.relayId, on)]
});

export const jobMatches = (
  job: ShellyScheduleJob | null,
  expected: ShellyScheduleJobConfig
): boolean => {
  if (!job || job.timespec !== expected.timespec || job.calls.length !== 1) {
    return false;
  }
  const actualCall = job.calls[0];
  const expectedCall = expected.calls[0];
  if (!actualCall || !expectedCall || actualCall.method !== expectedCall.method) {
    return false;
  }
  return (
    JSON.stringify(actualCall.params ?? {}) === JSON.stringify(expectedCall.params ?? {})
  );
};

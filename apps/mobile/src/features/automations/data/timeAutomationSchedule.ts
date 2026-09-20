import {
  dailyScheduleTimespec,
  type DailyTimeAutomationConfig
} from '@lcl/automation-core';
import type { ShellyScheduleJob, ShellyScheduleJobConfig } from '@lcl/shelly-client';

export type TimeAutomationScheduleState = 'running' | 'paused' | 'attention';

export type TimeAutomationSchedulePairState = {
  scheduleState: TimeAutomationScheduleState;
  onJob: ShellyScheduleJob | null;
  offJob: ShellyScheduleJob | null;
};

export type TimeAutomationScheduleInstallation = {
  schedule: { onJobId: number; offJobId: number };
  config: DailyTimeAutomationConfig;
};

const switchScheduleCall = (relayId: number, on: boolean) => ({
  method: 'Switch.Set',
  params: { id: relayId, on }
});

export const createDailyScheduleJob = (
  config: DailyTimeAutomationConfig,
  on: boolean,
  enable = true
): ShellyScheduleJobConfig => ({
  enable,
  timespec: dailyScheduleTimespec(on ? config.onTime : config.offTime),
  calls: [switchScheduleCall(config.relayId, on)]
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const scheduleJobControlsRelay = (
  job: ShellyScheduleJob,
  relayId: number
): boolean =>
  job.calls.some((call) => {
    if (call.method !== 'Switch.Set' || !isRecord(call.params)) {
      return false;
    }
    return call.params.id === relayId;
  });

export const findScheduleRelayConflict = (
  jobs: readonly ShellyScheduleJob[],
  relayId: number,
  ignoredJobIds: readonly number[] = []
): ShellyScheduleJob | null =>
  jobs.find(
    (job) => !ignoredJobIds.includes(job.id) && scheduleJobControlsRelay(job, relayId)
  ) ?? null;

const jobMatches = (
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

export const schedulePairState = (
  installation: TimeAutomationScheduleInstallation,
  jobs: readonly ShellyScheduleJob[]
): TimeAutomationSchedulePairState => {
  const onJob = jobs.find((job) => job.id === installation.schedule.onJobId) ?? null;
  const offJob = jobs.find((job) => job.id === installation.schedule.offJobId) ?? null;
  if (
    !jobMatches(onJob, createDailyScheduleJob(installation.config, true)) ||
    !jobMatches(offJob, createDailyScheduleJob(installation.config, false))
  ) {
    return { scheduleState: 'attention', onJob, offJob };
  }
  if (onJob?.enable && offJob?.enable) {
    return { scheduleState: 'running', onJob, offJob };
  }
  if (onJob && offJob && !onJob.enable && !offJob.enable) {
    return { scheduleState: 'paused', onJob, offJob };
  }
  return { scheduleState: 'attention', onJob, offJob };
};

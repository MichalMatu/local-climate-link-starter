import type { ShellyScheduleJob } from '@lcl/shelly-client';

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

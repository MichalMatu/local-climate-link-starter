import type { DailyTimeAutomationConfig } from '@lcl/automation-core';
import type { ShellyScheduleJob, ShellyStatus } from '@lcl/shelly-client';
import { unwrapShellyResult } from '../../../platform/shellyResult.js';
import { createTimeAutomationClients } from './timeAutomationClients.js';
import {
  schedulePairState,
  type TimeAutomationScheduleState
} from './timeAutomationSchedule.js';

export type TimeAutomationRuntimeInstallation = {
  shelly: { baseUrl: string };
  schedule: { onJobId: number; offJobId: number };
  config: DailyTimeAutomationConfig;
};

export type TimeAutomationRuntimeSnapshot = {
  relayOn: boolean;
  clock: ShellyStatus['clock'];
  scheduleState: TimeAutomationScheduleState;
  onJob: ShellyScheduleJob | null;
  offJob: ShellyScheduleJob | null;
};

export const readTimeAutomationRuntime = async (
  installation: TimeAutomationRuntimeInstallation,
  clients = createTimeAutomationClients(installation.shelly.baseUrl)
): Promise<TimeAutomationRuntimeSnapshot> => {
  const [statusResult, schedulesResult] = await Promise.all([
    clients.device.getStatus(),
    clients.schedules.list()
  ]);
  const status = unwrapShellyResult(statusResult);
  const scheduleList = unwrapShellyResult(schedulesResult);
  return {
    relayOn: status.relayOn,
    clock: status.clock,
    ...schedulePairState(installation, scheduleList.jobs)
  };
};

import { createDailyScheduleJob, jobMatches } from './scheduleJobs.js';
import { findScheduleRelayConflict } from './scheduleOwnership.js';
import {
  RpcShellyClient,
  RpcShellyScheduleClient,
  type ShellyScheduleJob,
  type ShellyScheduleJobConfig,
  type ShellyStatus
} from '@lcl/shelly-client';
import {
  createShellyTransport,
  unwrapShellyResult
} from '../hardware-setup/shellyRequests.js';
import type { TimeInstalledAutomation } from '../installations/model.js';
import { expectedRelayOnForClockTime, type DailyTimeAutomationConfig } from './config.js';

export type TimeAutomationScheduleState = 'running' | 'paused' | 'attention';

export type TimeAutomationRuntimeErrorCode =
  | 'clock-unsynced'
  | 'schedule-slots'
  | 'native-schedule-conflict'
  | 'relay-state-unconfirmed'
  | 'schedule-pair-unconfirmed'
  | 'schedule-state-attention'
  | 'pause-unconfirmed'
  | 'resume-unconfirmed'
  | 'update-unconfirmed'
  | 'delete-unconfirmed';

export class TimeAutomationRuntimeError extends Error {
  constructor(
    readonly code: TimeAutomationRuntimeErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'TimeAutomationRuntimeError';
  }
}

const runtimeError = (
  code: TimeAutomationRuntimeErrorCode,
  message: string
): TimeAutomationRuntimeError => new TimeAutomationRuntimeError(code, message);

export type TimeAutomationRuntimeSnapshot = {
  relayOn: boolean;
  clock: ShellyStatus['clock'];
  scheduleState: TimeAutomationScheduleState;
  onJob: ShellyScheduleJob | null;
  offJob: ShellyScheduleJob | null;
};

export type TimeAutomationClients = {
  device: Pick<RpcShellyClient, 'getStatus' | 'setRelayOn' | 'setRelayOff'>;
  schedules: Pick<RpcShellyScheduleClient, 'list' | 'create' | 'update' | 'delete'>;
};

export const createTimeAutomationClients = (baseUrl: string): TimeAutomationClients => {
  const transport = createShellyTransport(baseUrl);
  return {
    device: new RpcShellyClient(transport),
    schedules: new RpcShellyScheduleClient(transport)
  };
};

const schedulePairState = (
  installation: Pick<TimeInstalledAutomation, 'schedule' | 'config'>,
  jobs: readonly ShellyScheduleJob[]
): Pick<TimeAutomationRuntimeSnapshot, 'scheduleState' | 'onJob' | 'offJob'> => {
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

const requireSyncedClock = (status: ShellyStatus): string => {
  if (!status.clock.timeSynced || !status.clock.localTime) {
    throw runtimeError('clock-unsynced', 'Shelly clock is not synchronized.');
  }
  return status.clock.localTime;
};

const setRelayStateAndConfirm = async (
  clients: TimeAutomationClients,
  relayId: number,
  on: boolean
): Promise<ShellyStatus> => {
  unwrapShellyResult(
    on
      ? await clients.device.setRelayOn({ relayId })
      : await clients.device.setRelayOff({ relayId })
  );
  const status = unwrapShellyResult(await clients.device.getStatus());
  if (status.relayOn !== on) {
    throw runtimeError(
      'relay-state-unconfirmed',
      `Shelly relay did not confirm ${on ? 'ON' : 'OFF'}.`
    );
  }
  return status;
};

const deleteIfPresent = async (
  clients: TimeAutomationClients,
  jobId: number
): Promise<void> => {
  const list = unwrapShellyResult(await clients.schedules.list());
  if (list.jobs.some((job) => job.id === jobId)) {
    unwrapShellyResult(await clients.schedules.delete(jobId));
  }
};

export const readTimeAutomationRuntime = async (
  installation: TimeInstalledAutomation,
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

export const installDailyTimeAutomation = async ({
  clients,
  config
}: {
  clients: TimeAutomationClients;
  config: DailyTimeAutomationConfig;
}): Promise<{ onJobId: number; offJobId: number }> => {
  const initialStatus = unwrapShellyResult(await clients.device.getStatus());
  const localTime = requireSyncedClock(initialStatus);
  const scheduleList = unwrapShellyResult(await clients.schedules.list());
  if (scheduleList.jobs.length > 18) {
    throw runtimeError('schedule-slots', 'Shelly does not have two free schedule slots.');
  }
  if (findScheduleRelayConflict(scheduleList.jobs, config.relayId)) {
    throw runtimeError(
      'native-schedule-conflict',
      'A native Shelly schedule already controls this relay.'
    );
  }

  const onCreate = unwrapShellyResult(
    await clients.schedules.create(createDailyScheduleJob(config, true))
  );
  let offJobId: number | null = null;
  try {
    const offCreate = unwrapShellyResult(
      await clients.schedules.create(createDailyScheduleJob(config, false))
    );
    offJobId = offCreate.id;
    const expectedOn = expectedRelayOnForClockTime(config, localTime);
    await setRelayStateAndConfirm(clients, config.relayId, expectedOn);

    const installedJobs = unwrapShellyResult(await clients.schedules.list()).jobs;
    const pair = schedulePairState(
      { schedule: { onJobId: onCreate.id, offJobId: offCreate.id }, config },
      installedJobs
    );
    if (pair.scheduleState !== 'running') {
      throw runtimeError(
        'schedule-pair-unconfirmed',
        'Shelly did not confirm both schedule jobs.'
      );
    }
    return { onJobId: onCreate.id, offJobId: offCreate.id };
  } catch (error) {
    await deleteIfPresent(clients, onCreate.id).catch(() => undefined);
    if (offJobId !== null) {
      await deleteIfPresent(clients, offJobId).catch(() => undefined);
    }
    await setRelayStateAndConfirm(clients, config.relayId, false).catch(() => undefined);
    throw error;
  }
};

const updatePairEnabled = async (
  installation: TimeInstalledAutomation,
  clients: TimeAutomationClients,
  enable: boolean
): Promise<void> => {
  const { onJobId, offJobId } = installation.schedule;
  unwrapShellyResult(await clients.schedules.update(onJobId, { enable }));
  try {
    unwrapShellyResult(await clients.schedules.update(offJobId, { enable }));
  } catch (error) {
    await clients.schedules.update(onJobId, { enable: !enable }).catch(() => undefined);
    throw error;
  }
};

export const pauseTimeAutomation = async (
  installation: TimeInstalledAutomation,
  clients = createTimeAutomationClients(installation.shelly.baseUrl)
): Promise<TimeAutomationRuntimeSnapshot> => {
  await setRelayStateAndConfirm(clients, installation.config.relayId, false);
  await updatePairEnabled(installation, clients, false);
  await setRelayStateAndConfirm(clients, installation.config.relayId, false);
  const runtime = await readTimeAutomationRuntime(installation, clients);
  if (runtime.scheduleState !== 'paused' || runtime.relayOn) {
    throw runtimeError(
      'pause-unconfirmed',
      'Shelly did not confirm a safely paused time automation.'
    );
  }
  return runtime;
};

export const resumeTimeAutomation = async (
  installation: TimeInstalledAutomation,
  clients = createTimeAutomationClients(installation.shelly.baseUrl)
): Promise<TimeAutomationRuntimeSnapshot> => {
  const status = await setRelayStateAndConfirm(
    clients,
    installation.config.relayId,
    false
  );
  const localTime = requireSyncedClock(status);
  await updatePairEnabled(installation, clients, true);
  const expectedOn = expectedRelayOnForClockTime(installation.config, localTime);
  await setRelayStateAndConfirm(clients, installation.config.relayId, expectedOn);
  const runtime = await readTimeAutomationRuntime(installation, clients);
  if (runtime.scheduleState !== 'running') {
    throw runtimeError(
      'resume-unconfirmed',
      'Shelly did not confirm a running time automation.'
    );
  }
  return runtime;
};

export const updateDailyTimeAutomation = async ({
  installation,
  config,
  clients = createTimeAutomationClients(installation.shelly.baseUrl)
}: {
  installation: TimeInstalledAutomation;
  config: DailyTimeAutomationConfig;
  clients?: TimeAutomationClients;
}): Promise<TimeAutomationRuntimeSnapshot> => {
  const status = unwrapShellyResult(await clients.device.getStatus());
  const localTime = requireSyncedClock(status);
  const scheduleList = unwrapShellyResult(await clients.schedules.list());
  if (
    findScheduleRelayConflict(scheduleList.jobs, config.relayId, [
      installation.schedule.onJobId,
      installation.schedule.offJobId
    ])
  ) {
    throw runtimeError(
      'native-schedule-conflict',
      'Another native Shelly schedule already controls this relay.'
    );
  }

  const currentPair = schedulePairState(installation, scheduleList.jobs);
  if (
    currentPair.scheduleState === 'attention' ||
    !currentPair.onJob ||
    !currentPair.offJob
  ) {
    throw runtimeError(
      'schedule-state-attention',
      'Stored schedule jobs do not match the Shelly runtime state.'
    );
  }
  const previousOnJob: ShellyScheduleJobConfig = {
    enable: currentPair.onJob.enable,
    timespec: currentPair.onJob.timespec,
    calls: currentPair.onJob.calls
  };
  const previousOffJob: ShellyScheduleJobConfig = {
    enable: currentPair.offJob.enable,
    timespec: currentPair.offJob.timespec,
    calls: currentPair.offJob.calls
  };
  const wasRunning = currentPair.scheduleState === 'running';

  await setRelayStateAndConfirm(clients, installation.config.relayId, false);
  await updatePairEnabled(installation, clients, false);

  try {
    unwrapShellyResult(
      await clients.schedules.update(
        installation.schedule.onJobId,
        createDailyScheduleJob(config, true, false)
      )
    );
    unwrapShellyResult(
      await clients.schedules.update(
        installation.schedule.offJobId,
        createDailyScheduleJob(config, false, false)
      )
    );

    const updatedInstallation: TimeInstalledAutomation = {
      ...installation,
      config
    };
    if (wasRunning) {
      await updatePairEnabled(updatedInstallation, clients, true);
      const expectedOn = expectedRelayOnForClockTime(config, localTime);
      await setRelayStateAndConfirm(clients, config.relayId, expectedOn);
    } else {
      await setRelayStateAndConfirm(clients, config.relayId, false);
    }

    const runtime = await readTimeAutomationRuntime(updatedInstallation, clients);
    const expectedState: TimeAutomationScheduleState = wasRunning ? 'running' : 'paused';
    if (runtime.scheduleState !== expectedState || (!wasRunning && runtime.relayOn)) {
      throw runtimeError(
        'update-unconfirmed',
        'Shelly did not confirm the updated time automation.'
      );
    }
    return runtime;
  } catch (error) {
    await setRelayStateAndConfirm(clients, installation.config.relayId, false).catch(
      () => undefined
    );
    const restoreResults = await Promise.allSettled([
      clients.schedules.update(installation.schedule.onJobId, previousOnJob),
      clients.schedules.update(installation.schedule.offJobId, previousOffJob)
    ]);
    const restored = restoreResults.every(
      (result) => result.status === 'fulfilled' && result.value.ok
    );
    if (restored && wasRunning) {
      const previousExpectedOn = expectedRelayOnForClockTime(
        installation.config,
        localTime
      );
      await setRelayStateAndConfirm(
        clients,
        installation.config.relayId,
        previousExpectedOn
      ).catch(() => undefined);
    }
    throw error;
  }
};

export const deleteTimeAutomation = async (
  installation: TimeInstalledAutomation,
  clients = createTimeAutomationClients(installation.shelly.baseUrl)
): Promise<void> => {
  await setRelayStateAndConfirm(clients, installation.config.relayId, false);
  const list = unwrapShellyResult(await clients.schedules.list());
  const ids = new Set(list.jobs.map((job) => job.id));
  if (ids.has(installation.schedule.onJobId)) {
    unwrapShellyResult(await clients.schedules.delete(installation.schedule.onJobId));
  }
  if (ids.has(installation.schedule.offJobId)) {
    unwrapShellyResult(await clients.schedules.delete(installation.schedule.offJobId));
  }
  await setRelayStateAndConfirm(clients, installation.config.relayId, false);
  const remaining = unwrapShellyResult(await clients.schedules.list()).jobs;
  if (
    remaining.some(
      (job) =>
        job.id === installation.schedule.onJobId ||
        job.id === installation.schedule.offJobId
    )
  ) {
    throw runtimeError(
      'delete-unconfirmed',
      'Shelly did not delete the time automation schedules.'
    );
  }
};

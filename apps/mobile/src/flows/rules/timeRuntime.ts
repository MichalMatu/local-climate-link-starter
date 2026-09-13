import {
  isRuleScheduleActive,
  parseRuleClockMinutes,
  type Weekday
} from '@lcl/automation-core';
import {
  RpcShellyClient,
  RpcShellyScheduleClient,
  type ShellyScheduleJob,
  type ShellyStatus
} from '@lcl/shelly-client';
import type { SavedPlug } from '../devices/plugs/model.js';
import {
  createShellyTransport,
  unwrapShellyResult
} from '../hardware-setup/shellyRequests.js';
import type { AutomationRule, TimeRule } from './model.js';
import { requireRuleRelayOwnership } from './runtimeOwnership.js';
import { ruleRuntimeError } from './runtimeError.js';
import { expectedTimeRulePair, ruleScheduleJobMatches } from './timeSchedule.js';

export type TimeRuleScheduleState = 'running' | 'paused' | 'attention' | 'undeployed';
export type TimeRuleRuntimeSnapshot = {
  relayOn: boolean;
  clock: ShellyStatus['clock'];
  scheduleState: TimeRuleScheduleState;
};

type TimeDeviceClient = Pick<RpcShellyClient, 'getStatus' | 'setRelayOn' | 'setRelayOff'>;
type TimeScheduleClient = Pick<
  RpcShellyScheduleClient,
  'list' | 'create' | 'update' | 'delete'
>;
export type TimeRuleRuntimeClients = {
  device: TimeDeviceClient;
  schedules: TimeScheduleClient;
};
export type TimeRuntimeDependencies = {
  requireOwnership: typeof requireRuleRelayOwnership;
  createClients(baseUrl: string): TimeRuleRuntimeClients;
};

const defaultDependencies: TimeRuntimeDependencies = {
  requireOwnership: requireRuleRelayOwnership,
  createClients: (baseUrl) => {
    const transport = createShellyTransport(baseUrl);
    return {
      device: new RpcShellyClient(transport),
      schedules: new RpcShellyScheduleClient(transport)
    };
  }
};

const setRelayAndConfirm = async (
  clients: TimeRuleRuntimeClients,
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
    throw ruleRuntimeError(
      'verification-failed',
      `Relay did not confirm ${on ? 'ON' : 'OFF'}.`
    );
  }
  return status;
};

const localWeekday = (status: ShellyStatus): Weekday => {
  const { localTime, timeSynced, unixTimeSec } = status.clock;
  const localMinutes = localTime ? parseRuleClockMinutes(localTime) : null;
  if (!timeSynced || localMinutes === null || typeof unixTimeSec !== 'number') {
    throw ruleRuntimeError('clock-unsynced', 'Shelly clock is not synchronized.');
  }
  const utc = new Date(unixTimeSec * 1000);
  const utcMinutes = utc.getUTCHours() * 60 + utc.getUTCMinutes();
  let offsetMinutes = localMinutes - utcMinutes;
  if (offsetMinutes < -720) offsetMinutes += 1440;
  if (offsetMinutes > 840) offsetMinutes -= 1440;
  return new Date((unixTimeSec + offsetMinutes * 60) * 1000).getUTCDay() as Weekday;
};

const expectedRelayState = (rule: TimeRule, status: ShellyStatus): boolean => {
  const time = status.clock.localTime;
  if (!time)
    throw ruleRuntimeError('clock-unsynced', 'Shelly clock is not synchronized.');
  return isRuleScheduleActive(rule.config.schedule, localWeekday(status), time);
};

const deploymentState = (
  rule: TimeRule,
  jobs: readonly ShellyScheduleJob[]
): TimeRuleScheduleState => {
  if (!rule.deployment) return 'undeployed';
  let allEnabled = true;
  let allDisabled = true;
  for (const pair of rule.deployment.pairs) {
    const expected = expectedTimeRulePair(rule, pair.windowIndex);
    const onJob = jobs.find((job) => job.id === pair.onJobId) ?? null;
    const offJob = jobs.find((job) => job.id === pair.offJobId) ?? null;
    if (
      !ruleScheduleJobMatches(onJob, expected.on) ||
      !ruleScheduleJobMatches(offJob, expected.off)
    ) {
      return 'attention';
    }
    allEnabled &&= Boolean(onJob?.enable && offJob?.enable);
    allDisabled &&= Boolean(onJob && offJob && !onJob.enable && !offJob.enable);
  }
  return allEnabled ? 'running' : allDisabled ? 'paused' : 'attention';
};

export const readTimeRuleRuntime = async (
  rule: TimeRule,
  plug: SavedPlug,
  deps: TimeRuntimeDependencies = defaultDependencies
): Promise<TimeRuleRuntimeSnapshot> => {
  const clients = deps.createClients(plug.baseUrl);
  const [statusResult, listResult] = await Promise.all([
    clients.device.getStatus(),
    clients.schedules.list()
  ]);
  const status = unwrapShellyResult(statusResult);
  const jobs = unwrapShellyResult(listResult).jobs;
  return {
    relayOn: status.relayOn,
    clock: status.clock,
    scheduleState: deploymentState(rule, jobs)
  };
};

const updateAllPairs = async (
  rule: TimeRule,
  clients: TimeRuleRuntimeClients,
  enable: boolean
): Promise<void> => {
  if (!rule.deployment)
    throw ruleRuntimeError('runtime-mismatch', 'Rule is not deployed.');
  const updated: number[] = [];
  try {
    for (const pair of rule.deployment.pairs) {
      for (const id of [pair.onJobId, pair.offJobId]) {
        unwrapShellyResult(await clients.schedules.update(id, { enable }));
        updated.push(id);
      }
    }
  } catch (error) {
    for (const id of updated.reverse()) {
      await clients.schedules.update(id, { enable: !enable }).catch(() => undefined);
    }
    throw error;
  }
};

const verifyExactDeployment = async (
  rule: TimeRule,
  clients: TimeRuleRuntimeClients,
  expected: 'running' | 'paused'
): Promise<void> => {
  const jobs = unwrapShellyResult(await clients.schedules.list()).jobs;
  if (deploymentState(rule, jobs) !== expected) {
    throw ruleRuntimeError('verification-failed', `Time deployment is not ${expected}.`);
  }
};

export const deployTimeRule = async ({
  rule,
  plug,
  rules,
  deps = defaultDependencies
}: {
  rule: TimeRule;
  plug: SavedPlug;
  rules: readonly AutomationRule[];
  deps?: TimeRuntimeDependencies;
}): Promise<NonNullable<TimeRule['deployment']>> => {
  await deps.requireOwnership({ rule, plug, rules });
  const clients = deps.createClients(plug.baseUrl);
  const status = unwrapShellyResult(await clients.device.getStatus());
  localWeekday(status);
  const existing = unwrapShellyResult(await clients.schedules.list()).jobs;
  const requiredSlots = rule.config.schedule.windows.length * 2;
  if (existing.length + requiredSlots > 20) {
    throw ruleRuntimeError(
      'schedule-slots',
      'Shelly does not have enough schedule slots.'
    );
  }
  const created: { windowIndex: number; onJobId: number; offJobId: number }[] = [];
  const createdIds: number[] = [];
  try {
    for (
      let windowIndex = 0;
      windowIndex < rule.config.schedule.windows.length;
      windowIndex += 1
    ) {
      const expected = expectedTimeRulePair(rule, windowIndex);
      const on = unwrapShellyResult(
        await clients.schedules.create({ ...expected.on, enable: false })
      );
      createdIds.push(on.id);
      const off = unwrapShellyResult(
        await clients.schedules.create({ ...expected.off, enable: false })
      );
      createdIds.push(off.id);
      created.push({ windowIndex, onJobId: on.id, offJobId: off.id });
    }
    await setRelayAndConfirm(clients, rule.relayId, false);
    const deployedRule: TimeRule = { ...rule, deployment: { pairs: created } };
    await updateAllPairs(deployedRule, clients, true);
    await setRelayAndConfirm(clients, rule.relayId, expectedRelayState(rule, status));
    await verifyExactDeployment(deployedRule, clients, 'running');
    return { pairs: created };
  } catch (error) {
    await setRelayAndConfirm(clients, rule.relayId, false).catch(() => undefined);
    for (const id of createdIds.reverse()) {
      await clients.schedules.delete(id).catch(() => undefined);
    }
    await setRelayAndConfirm(clients, rule.relayId, false).catch(() => undefined);
    throw error;
  }
};

export const pauseTimeRule = async (
  rule: TimeRule,
  plug: SavedPlug,
  deps: TimeRuntimeDependencies = defaultDependencies
): Promise<TimeRuleRuntimeSnapshot> => {
  if (!rule.deployment)
    throw ruleRuntimeError('runtime-mismatch', 'Rule is not deployed.');
  const clients = deps.createClients(plug.baseUrl);
  const before = unwrapShellyResult(await clients.schedules.list()).jobs;
  if (deploymentState(rule, before) === 'attention') {
    throw ruleRuntimeError('runtime-mismatch', 'Time deployment does not match Shelly.');
  }
  await setRelayAndConfirm(clients, rule.relayId, false);
  await updateAllPairs(rule, clients, false);
  await setRelayAndConfirm(clients, rule.relayId, false);
  await verifyExactDeployment(rule, clients, 'paused');
  return readTimeRuleRuntime(rule, plug, deps);
};

export const resumeTimeRule = async (
  rule: TimeRule,
  plug: SavedPlug,
  deps: TimeRuntimeDependencies = defaultDependencies
): Promise<TimeRuleRuntimeSnapshot> => {
  if (!rule.deployment)
    throw ruleRuntimeError('runtime-mismatch', 'Rule is not deployed.');
  const clients = deps.createClients(plug.baseUrl);
  const status = await setRelayAndConfirm(clients, rule.relayId, false);
  localWeekday(status);
  const before = unwrapShellyResult(await clients.schedules.list()).jobs;
  if (deploymentState(rule, before) !== 'paused') {
    throw ruleRuntimeError(
      'runtime-mismatch',
      'Time deployment must be paused before resume.'
    );
  }
  await updateAllPairs(rule, clients, true);
  await setRelayAndConfirm(clients, rule.relayId, expectedRelayState(rule, status));
  await verifyExactDeployment(rule, clients, 'running');
  return readTimeRuleRuntime(rule, plug, deps);
};

export const deleteTimeRuleDeployment = async (
  rule: TimeRule,
  plug: SavedPlug,
  deps: TimeRuntimeDependencies = defaultDependencies
): Promise<void> => {
  if (!rule.deployment) return;
  const clients = deps.createClients(plug.baseUrl);
  await setRelayAndConfirm(clients, rule.relayId, false);
  const jobs = unwrapShellyResult(await clients.schedules.list()).jobs;
  const presentIds = new Set(jobs.map((job) => job.id));
  for (const pair of rule.deployment.pairs) {
    const expected = expectedTimeRulePair(rule, pair.windowIndex);
    const onJob = jobs.find((job) => job.id === pair.onJobId) ?? null;
    const offJob = jobs.find((job) => job.id === pair.offJobId) ?? null;
    if (onJob && !ruleScheduleJobMatches(onJob, expected.on)) {
      throw ruleRuntimeError(
        'runtime-mismatch',
        `Schedule ${pair.onJobId} changed identity.`
      );
    }
    if (offJob && !ruleScheduleJobMatches(offJob, expected.off)) {
      throw ruleRuntimeError(
        'runtime-mismatch',
        `Schedule ${pair.offJobId} changed identity.`
      );
    }
  }
  for (const pair of rule.deployment.pairs) {
    for (const id of [pair.onJobId, pair.offJobId]) {
      if (presentIds.has(id)) unwrapShellyResult(await clients.schedules.delete(id));
    }
  }
  await setRelayAndConfirm(clients, rule.relayId, false);
  const remaining = unwrapShellyResult(await clients.schedules.list()).jobs;
  const deploymentIds = new Set(
    rule.deployment.pairs.flatMap((pair) => [pair.onJobId, pair.offJobId])
  );
  if (remaining.some((job) => deploymentIds.has(job.id))) {
    throw ruleRuntimeError(
      'verification-failed',
      'Shelly did not delete all time schedules.'
    );
  }
};

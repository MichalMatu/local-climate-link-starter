#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_PARENT='fbbde9abb37fe9fcdbce5c7cdc8f3bdd98e3d895'
git fetch origin "$BRANCH" agent-control
BASE="$(git rev-parse "origin/$BRANCH")"
MESSAGE="$(git log -1 --pretty=%s "$BASE")"
PARENT="$(git rev-parse "$BASE^")"
if [ "$MESSAGE" != 'Fail closed on unknown climate runtime mode' ] || [ "$PARENT" != "$EXPECTED_PARENT" ]; then
  echo "Expected fail-closed checkpoint, got $BASE '$MESSAGE' parent $PARENT" >&2
  exit 1
fi
git reset --hard "$BASE"
git checkout -B "$BRANCH" "$BASE"
mkdir -p apps/mobile/src/flows/runtime apps/mobile/src/flows/rules
cat > apps/mobile/src/flows/runtime/relaySafety.ts <<'EOF'
import type { RpcShellyClient } from '@lcl/shelly-client';
import { unwrapShellyResult } from '../hardware-setup/shellyRequests.js';

export type RelaySafetyClient = Pick<RpcShellyClient, 'getStatus' | 'setRelayOff'>;

export const forceRelayOffAndConfirm = async (
  client: RelaySafetyClient,
  relayId: number
): Promise<void> => {
  unwrapShellyResult(await client.setRelayOff({ relayId }));
  const status = unwrapShellyResult(await client.getStatus());
  if (status.relayOn) {
    throw new Error('Shelly relay did not confirm OFF.');
  }
};
EOF
cat > apps/mobile/src/flows/installations/relaySafety.ts <<'EOF'
export { forceRelayOffAndConfirm } from '../runtime/relaySafety.js';
EOF
cat > apps/mobile/src/flows/rules/runtimeError.ts <<'EOF'
export type RuleRuntimeErrorCode =
  | 'inventory-unavailable'
  | 'ownership-conflict'
  | 'runtime-mismatch'
  | 'runtime-unsupported'
  | 'clock-unsynced'
  | 'schedule-slots'
  | 'verification-failed'
  | 'safety-test-failed';

export class RuleRuntimeError extends Error {
  constructor(
    readonly code: RuleRuntimeErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'RuleRuntimeError';
  }
}

export const ruleRuntimeError = (
  code: RuleRuntimeErrorCode,
  message: string
): RuleRuntimeError => new RuleRuntimeError(code, message);
EOF
cat > apps/mobile/src/flows/rules/runtimeOwnership.ts <<'EOF'
import type { SavedPlug } from '../devices/plugs/model.js';
import { readPlugRuntime, type PlugRuntimeSnapshot } from '../devices/plugs/inventory.js';
import type { AutomationRule } from './model.js';
import { resolveRelayOwnership } from './ownership.js';
import { ruleRuntimeError } from './runtimeError.js';

export type RuleOwnershipReader = typeof readPlugRuntime;

export const requireRuleRelayOwnership = async ({
  rule,
  plug,
  rules,
  readRuntime = readPlugRuntime
}: {
  rule: AutomationRule;
  plug: SavedPlug;
  rules: readonly AutomationRule[];
  readRuntime?: RuleOwnershipReader;
}): Promise<PlugRuntimeSnapshot> => {
  const runtime = await readRuntime(plug, rules);
  if (!runtime.ok) {
    throw ruleRuntimeError(
      'inventory-unavailable',
      `Cannot verify plug runtime inventory (${runtime.error.kind}).`
    );
  }
  const ownership = resolveRelayOwnership({
    plug,
    relayId: rule.relayId,
    rules,
    inventory: runtime.value.inventory,
    editingRuleId: rule.id
  });
  if (ownership.status !== 'no-conflict') {
    throw ruleRuntimeError(
      'ownership-conflict',
      `Relay ownership is blocked: ${ownership.conflicts.map((item) => item.kind).join(', ')}.`
    );
  }
  return { ...runtime.value, ownership };
};
EOF
cat > apps/mobile/src/flows/rules/climateRuntime.ts <<'EOF'
import { generateShellyThermostatScript } from '@lcl/script-generator';
import {
  createInstallPlan,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RpcShellyClient,
  type RelayTestResult,
  type ShellyInstallResult,
  type ShellyRpcTransport
} from '@lcl/shelly-client';
import type { SavedPlug } from '../devices/plugs/model.js';
import type { SavedSensor } from '../devices/sensors/model.js';
import {
  cleanupStaleShellyBleDiscoveryScripts,
  createShellyTransport,
  readShellyControlStatus,
  readShellySetupStatus,
  type ShellyAutomationMode,
  type ShellyControlStatus,
  unwrapShellyResult
} from '../hardware-setup/shellyRequests.js';
import { readClimateMode, writeClimateMode } from '../runtime/modeProtocol.js';
import { forceRelayOffAndConfirm } from '../runtime/relaySafety.js';
import type { AutomationRule, ClimateRule } from './model.js';
import { resolveClimateGeneratorConfig } from './selectors.js';
import { requireRuleRelayOwnership } from './runtimeOwnership.js';
import { ruleRuntimeError } from './runtimeError.js';

export type ClimateRuleScriptMatch = 'undeployed' | 'matched' | 'missing' | 'mismatch';
export type ClimateRuleRuntimeSnapshot = {
  relayOn: boolean;
  mode: ShellyAutomationMode;
  modeSupported: boolean;
  scriptMatch: ClimateRuleScriptMatch;
  scriptId: number | null;
  telemetry: ShellyControlStatus['telemetry'];
  clock: ShellyControlStatus['clock'];
};

type ClimateDeviceClient = Pick<
  RpcShellyClient,
  | 'getStatus'
  | 'installScript'
  | 'stopScript'
  | 'deleteScript'
  | 'setRelayOn'
  | 'setRelayOff'
  | 'safeRelayTest'
>;

export type ClimateRuntimeDependencies = {
  requireOwnership: typeof requireRuleRelayOwnership;
  cleanupBle(baseUrl: string): Promise<number>;
  createTransport(baseUrl: string): ShellyRpcTransport;
  createClient(baseUrl: string): ClimateDeviceClient;
  readControlStatus(baseUrl: string): Promise<ShellyControlStatus>;
  readSetupStatus: typeof readShellySetupStatus;
};

const defaultDependencies: ClimateRuntimeDependencies = {
  requireOwnership: requireRuleRelayOwnership,
  cleanupBle: cleanupStaleShellyBleDiscoveryScripts,
  createTransport: createShellyTransport,
  createClient: (baseUrl) => new RpcShellyClient(createShellyTransport(baseUrl)),
  readControlStatus: readShellyControlStatus,
  readSetupStatus: readShellySetupStatus
};

const scriptMatch = (
  rule: ClimateRule,
  status: Pick<ShellyControlStatus, 'automationScriptId'>
): ClimateRuleScriptMatch => {
  if (!rule.deployment) return 'undeployed';
  if (status.automationScriptId === null) return 'missing';
  return status.automationScriptId === rule.deployment.scriptId ? 'matched' : 'mismatch';
};

export const readClimateRuleRuntime = async (
  rule: ClimateRule,
  plug: SavedPlug,
  deps: ClimateRuntimeDependencies = defaultDependencies
): Promise<ClimateRuleRuntimeSnapshot> => {
  const status = await deps.readControlStatus(plug.baseUrl);
  return {
    relayOn: status.relayOn,
    mode: status.automationMode,
    modeSupported: status.automationMode === 'auto' || status.automationMode === 'manual',
    scriptMatch: scriptMatch(rule, status),
    scriptId: status.automationScriptId,
    telemetry: status.telemetry,
    clock: status.clock
  };
};

const requireExactRuntime = async (
  rule: ClimateRule,
  plug: SavedPlug,
  deps: ClimateRuntimeDependencies
): Promise<ClimateRuleRuntimeSnapshot> => {
  if (!rule.deployment) {
    throw ruleRuntimeError('runtime-mismatch', 'Rule has no climate deployment.');
  }
  const runtime = await readClimateRuleRuntime(rule, plug, deps);
  if (runtime.scriptMatch !== 'matched') {
    throw ruleRuntimeError('runtime-mismatch', 'Stored climate script does not match Shelly.');
  }
  return runtime;
};

const verifyMode = async (
  rule: ClimateRule,
  plug: SavedPlug,
  mode: 'auto' | 'manual',
  deps: ClimateRuntimeDependencies
): Promise<ClimateRuleRuntimeSnapshot> => {
  const runtime = await requireExactRuntime(rule, plug, deps);
  if (!runtime.modeSupported || runtime.mode !== mode) {
    throw ruleRuntimeError(
      'runtime-unsupported',
      `Shelly did not confirm ${mode.toUpperCase()} runtime mode.`
    );
  }
  return runtime;
};

const bestEffortStopAfterFailedDeploy = async (
  client: ClimateDeviceClient,
  scriptId: number,
  relayId: number,
  remove: boolean
): Promise<void> => {
  await client.stopScript(scriptId).catch(() => undefined);
  await forceRelayOffAndConfirm(client, relayId).catch(() => undefined);
  if (remove) await client.deleteScript(scriptId).catch(() => undefined);
};

export const deployClimateRule = async ({
  rule,
  plug,
  sensor,
  rules,
  deps = defaultDependencies
}: {
  rule: ClimateRule;
  plug: SavedPlug;
  sensor: SavedSensor;
  rules: readonly AutomationRule[];
  deps?: ClimateRuntimeDependencies;
}): Promise<NonNullable<ClimateRule['deployment']>> => {
  await deps.requireOwnership({ rule, plug, rules });
  const config = resolveClimateGeneratorConfig(rule, { plugs: [plug], sensors: [sensor] });
  if (!config.ok) {
    throw ruleRuntimeError('verification-failed', 'Climate rule devices or config are invalid.');
  }
  await deps.cleanupBle(plug.baseUrl);
  const transport = deps.createTransport(plug.baseUrl);
  const client = deps.createClient(plug.baseUrl);
  const install = unwrapShellyResult(
    await client.installScript(createInstallPlan(generateShellyThermostatScript(config.value)))
  ) as ShellyInstallResult;
  try {
    await writeClimateMode(transport, install.scriptId, 'manual');
    await forceRelayOffAndConfirm(client, rule.relayId);
    await forceRelayOffAndConfirm(client, rule.relayId);
    const status = await deps.readControlStatus(plug.baseUrl);
    if (status.automationScriptId !== install.scriptId || status.automationMode !== 'manual') {
      throw ruleRuntimeError(
        'verification-failed',
        'Shelly did not confirm the newly deployed climate runtime in MANUAL.'
      );
    }
  } catch (error) {
    await bestEffortStopAfterFailedDeploy(
      client,
      install.scriptId,
      rule.relayId,
      rule.deployment === null
    );
    throw error;
  }
  return {
    scriptId: install.scriptId,
    scriptHash: install.scriptHash,
    safetyTest: { status: 'pending' }
  };
};

export const runClimateRuleSafetyTest = async (
  rule: ClimateRule,
  plug: SavedPlug,
  nowMs = Date.now(),
  deps: ClimateRuntimeDependencies = defaultDependencies
): Promise<{ deployment: NonNullable<ClimateRule['deployment']>; relayTest: RelayTestResult }> => {
  if (!rule.deployment) {
    throw ruleRuntimeError('runtime-mismatch', 'Rule has no climate deployment.');
  }
  const transport = deps.createTransport(plug.baseUrl);
  const client = deps.createClient(plug.baseUrl);
  try {
    await requireExactRuntime(rule, plug, deps);
    await writeClimateMode(transport, rule.deployment.scriptId, 'manual');
    await forceRelayOffAndConfirm(client, rule.relayId);
    await forceRelayOffAndConfirm(client, rule.relayId);
    await verifyMode(rule, plug, 'manual', deps);
    const relayTest = unwrapShellyResult(await client.safeRelayTest());
    if (relayTest.finalRelayOn) {
      throw ruleRuntimeError('safety-test-failed', 'Safe relay test did not finish OFF.');
    }
    await writeClimateMode(transport, rule.deployment.scriptId, 'auto');
    await verifyMode(rule, plug, 'auto', deps);
    return {
      deployment: {
        ...rule.deployment,
        safetyTest: { status: 'verified', verifiedAtMs: nowMs }
      },
      relayTest
    };
  } catch (error) {
    await writeClimateMode(transport, rule.deployment.scriptId, 'manual').catch(
      () => undefined
    );
    await forceRelayOffAndConfirm(client, rule.relayId).catch(() => undefined);
    throw error;
  }
};

export const pauseClimateRule = async (
  rule: ClimateRule,
  plug: SavedPlug,
  deps: ClimateRuntimeDependencies = defaultDependencies
): Promise<ClimateRuleRuntimeSnapshot> => {
  const runtime = await requireExactRuntime(rule, plug, deps);
  if (!runtime.modeSupported) {
    throw ruleRuntimeError('runtime-unsupported', 'Climate runtime mode is not supported.');
  }
  const transport = deps.createTransport(plug.baseUrl);
  const client = deps.createClient(plug.baseUrl);
  await writeClimateMode(transport, rule.deployment!.scriptId, 'manual');
  await forceRelayOffAndConfirm(client, rule.relayId);
  await forceRelayOffAndConfirm(client, rule.relayId);
  const verified = await verifyMode(rule, plug, 'manual', deps);
  if (verified.relayOn) {
    throw ruleRuntimeError('verification-failed', 'Relay is not OFF in MANUAL mode.');
  }
  return verified;
};

export const resumeClimateRule = async (
  rule: ClimateRule,
  plug: SavedPlug,
  deps: ClimateRuntimeDependencies = defaultDependencies
): Promise<ClimateRuleRuntimeSnapshot> => {
  const runtime = await requireExactRuntime(rule, plug, deps);
  if (runtime.mode !== 'manual' || !runtime.modeSupported) {
    throw ruleRuntimeError('runtime-unsupported', 'AUTO requires verified MANUAL mode.');
  }
  const transport = deps.createTransport(plug.baseUrl);
  const client = deps.createClient(plug.baseUrl);
  await forceRelayOffAndConfirm(client, rule.relayId);
  await writeClimateMode(transport, rule.deployment!.scriptId, 'auto');
  return verifyMode(rule, plug, 'auto', deps);
};

export const setClimateRuleRelay = async (
  rule: ClimateRule,
  plug: SavedPlug,
  on: boolean,
  deps: ClimateRuntimeDependencies = defaultDependencies
): Promise<ClimateRuleRuntimeSnapshot> => {
  const runtime = await requireExactRuntime(rule, plug, deps);
  if (runtime.mode !== 'manual' || !runtime.modeSupported) {
    throw ruleRuntimeError('runtime-unsupported', 'Manual relay control requires MANUAL.');
  }
  const client = deps.createClient(plug.baseUrl);
  unwrapShellyResult(
    on ? await client.setRelayOn({ relayId: rule.relayId }) : await client.setRelayOff({ relayId: rule.relayId })
  );
  const verified = await requireExactRuntime(rule, plug, deps);
  if (verified.mode !== 'manual' || !verified.modeSupported || verified.relayOn !== on) {
    throw ruleRuntimeError('verification-failed', `Shelly did not confirm relay ${on ? 'ON' : 'OFF'}.`);
  }
  return verified;
};

export const deleteClimateRuleDeployment = async (
  rule: ClimateRule,
  plug: SavedPlug,
  deps: ClimateRuntimeDependencies = defaultDependencies
): Promise<void> => {
  if (!rule.deployment) return;
  const client = deps.createClient(plug.baseUrl);
  const setup = await deps.readSetupStatus(plug.baseUrl);
  const target = setup.scripts.find((script) => script.id === rule.deployment!.scriptId);
  const otherManaged = setup.scripts.find(
    (script) =>
      script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME && script.id !== rule.deployment!.scriptId
  );
  if (target && target.name !== LOCAL_CLIMATE_LINK_SCRIPT_NAME) {
    throw ruleRuntimeError('runtime-mismatch', 'Stored script id belongs to another script.');
  }
  if (otherManaged) {
    throw ruleRuntimeError('ownership-conflict', 'Another managed climate script exists.');
  }
  await forceRelayOffAndConfirm(client, rule.relayId);
  if (target?.running) {
    unwrapShellyResult(await client.stopScript(target.id));
    await forceRelayOffAndConfirm(client, rule.relayId);
  }
  if (target) unwrapShellyResult(await client.deleteScript(target.id));
  await forceRelayOffAndConfirm(client, rule.relayId);
  const verified = await deps.readSetupStatus(plug.baseUrl);
  if (
    verified.status.relayOn ||
    verified.scripts.some((script) => script.id === rule.deployment!.scriptId)
  ) {
    throw ruleRuntimeError('verification-failed', 'Shelly did not confirm climate deletion.');
  }
};

export const readExactClimateMode = async (
  rule: ClimateRule,
  plug: SavedPlug,
  deps: ClimateRuntimeDependencies = defaultDependencies
) => {
  if (!rule.deployment) return null;
  return readClimateMode(deps.createTransport(plug.baseUrl), rule.deployment.scriptId);
};
EOF
cat > apps/mobile/src/flows/rules/timeRuntime.ts <<'EOF'
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
import { createShellyTransport, unwrapShellyResult } from '../hardware-setup/shellyRequests.js';
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
    throw ruleRuntimeError('verification-failed', `Relay did not confirm ${on ? 'ON' : 'OFF'}.`);
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
  if (!time) throw ruleRuntimeError('clock-unsynced', 'Shelly clock is not synchronized.');
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
    if (!ruleScheduleJobMatches(onJob, expected.on) || !ruleScheduleJobMatches(offJob, expected.off)) {
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
  if (!rule.deployment) throw ruleRuntimeError('runtime-mismatch', 'Rule is not deployed.');
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
    throw ruleRuntimeError('schedule-slots', 'Shelly does not have enough schedule slots.');
  }
  const created: { windowIndex: number; onJobId: number; offJobId: number }[] = [];
  const createdIds: number[] = [];
  try {
    for (let windowIndex = 0; windowIndex < rule.config.schedule.windows.length; windowIndex += 1) {
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
  if (!rule.deployment) throw ruleRuntimeError('runtime-mismatch', 'Rule is not deployed.');
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
  if (!rule.deployment) throw ruleRuntimeError('runtime-mismatch', 'Rule is not deployed.');
  const clients = deps.createClients(plug.baseUrl);
  const status = await setRelayAndConfirm(clients, rule.relayId, false);
  localWeekday(status);
  const before = unwrapShellyResult(await clients.schedules.list()).jobs;
  if (deploymentState(rule, before) !== 'paused') {
    throw ruleRuntimeError('runtime-mismatch', 'Time deployment must be paused before resume.');
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
      throw ruleRuntimeError('runtime-mismatch', `Schedule ${pair.onJobId} changed identity.`);
    }
    if (offJob && !ruleScheduleJobMatches(offJob, expected.off)) {
      throw ruleRuntimeError('runtime-mismatch', `Schedule ${pair.offJobId} changed identity.`);
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
    throw ruleRuntimeError('verification-failed', 'Shelly did not delete all time schedules.');
  }
};
EOF
cat > apps/mobile/src/flows/rules/runtimeOwnership.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import { climate, plug } from '../registry/fixtures.test-support.js';
import { requireRuleRelayOwnership } from './runtimeOwnership.js';

const verified = {
  relayOn: false,
  inventory: {
    status: 'verified' as const,
    plugId: plug.id,
    baseUrl: plug.baseUrl,
    scripts: [],
    schedules: []
  },
  ownership: { status: 'blocked' as const, conflicts: [], attention: [] },
  managedScripts: []
};

describe('rule runtime ownership guard', () => {
  it('allows the rule being edited to own its own saved relay', async () => {
    const value = await requireRuleRelayOwnership({
      rule: climate,
      plug,
      rules: [climate],
      readRuntime: async () => ({ ok: true, value: verified })
    });
    expect(value.ownership.status).toBe('no-conflict');
  });

  it('fails closed when inventory cannot be verified', async () => {
    await expect(
      requireRuleRelayOwnership({
        rule: climate,
        plug,
        rules: [climate],
        readRuntime: async () => ({ ok: false, error: { kind: 'offline' } }) as never
      })
    ).rejects.toMatchObject({ code: 'inventory-unavailable' });
  });
});
EOF
cat > apps/mobile/src/flows/rules/timeRuntime.test.ts <<'EOF'
import type { ShellyScheduleJob, ShellyStatus } from '@lcl/shelly-client';
import { describe, expect, it } from 'vitest';
import { plug, time } from '../registry/fixtures.test-support.js';
import type { TimeRule } from './model.js';
import { deployTimeRule, deleteTimeRuleDeployment, type TimeRuleRuntimeClients } from './timeRuntime.js';

class FakeTimeRuntime {
  relayOn = false;
  jobs: ShellyScheduleJob[] = [];
  nextId = 1;
  status(): ShellyStatus {
    return {
      matterEnabled: false,
      scripts: 'enabled',
      bluetooth: 'enabled',
      relayOn: this.relayOn,
      telemetry: {},
      clock: { timeSynced: true, localTime: '09:00', unixTimeSec: 1789282800 }
    };
  }
  clients(): TimeRuleRuntimeClients {
    return {
      device: {
        getStatus: async () => ({ ok: true, value: this.status() }),
        setRelayOn: async () => {
          this.relayOn = true;
          return { ok: true, value: null };
        },
        setRelayOff: async () => {
          this.relayOn = false;
          return { ok: true, value: null };
        }
      },
      schedules: {
        list: async () => ({ ok: true, value: { jobs: this.jobs } }),
        create: async (config) => {
          const job = { id: this.nextId++, ...config } as ShellyScheduleJob;
          this.jobs = [...this.jobs, job];
          return { ok: true, value: { id: job.id } };
        },
        update: async (id, patch) => {
          this.jobs = this.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job));
          return { ok: true, value: null };
        },
        delete: async (id) => {
          this.jobs = this.jobs.filter((job) => job.id !== id);
          return { ok: true, value: null };
        }
      }
    };
  }
}

const ownership = async () => ({}) as never;

describe('time rule runtime', () => {
  it('installs one exact native pair per configured window and can delete it safely', async () => {
    const fake = new FakeTimeRuntime();
    const deployment = await deployTimeRule({
      rule: time,
      plug,
      rules: [time],
      deps: { requireOwnership: ownership, createClients: () => fake.clients() }
    });
    expect(deployment.pairs).toHaveLength(1);
    expect(fake.jobs).toHaveLength(2);
    expect(fake.jobs.every((job) => job.enable)).toBe(true);

    const deployed = { ...time, deployment } as TimeRule;
    await deleteTimeRuleDeployment(deployed, plug, {
      requireOwnership: ownership,
      createClients: () => fake.clients()
    });
    expect(fake.jobs).toEqual([]);
    expect(fake.relayOn).toBe(false);
  });

  it('supports multiple future-facing schedule windows without changing the runtime contract', async () => {
    const fake = new FakeTimeRuntime();
    const multi = {
      ...time,
      config: {
        schedule: {
          windows: [
            { days: [1, 2, 3, 4, 5] as const, start: '06:00', end: '08:00' },
            { days: [1, 2, 3, 4, 5] as const, start: '18:00', end: '22:00' }
          ]
        }
      }
    } as unknown as TimeRule;
    const deployment = await deployTimeRule({
      rule: multi,
      plug,
      rules: [multi],
      deps: { requireOwnership: ownership, createClients: () => fake.clients() }
    });
    expect(deployment.pairs).toHaveLength(2);
    expect(fake.jobs).toHaveLength(4);
  });
});
EOF
cat > apps/mobile/src/flows/rules/climateRuntime.test.ts <<'EOF'
import { describe, expect, it, vi } from 'vitest';
import { climate, plug, sensor } from '../registry/fixtures.test-support.js';
import type { ClimateRuntimeDependencies } from './climateRuntime.js';
import { readClimateRuleRuntime } from './climateRuntime.js';

const deps = (mode: 'auto' | 'manual' | 'unknown'): ClimateRuntimeDependencies => ({
  requireOwnership: vi.fn(async () => ({} as never)),
  cleanupBle: vi.fn(async () => 0),
  createTransport: vi.fn(() => ({ call: vi.fn() })),
  createClient: vi.fn(() => ({} as never)),
  readControlStatus: vi.fn(async () => ({
    relayOn: false,
    automationMode: mode,
    automationScriptId: 7,
    firmwareId: '1.0.0',
    telemetry: {},
    clock: { timeSynced: true }
  })),
  readSetupStatus: vi.fn(async () => ({} as never))
});

describe('climate rule runtime', () => {
  it('keeps an unknown in-process mode explicitly unsupported', async () => {
    const deployed = {
      ...climate,
      deployment: {
        scriptId: 7,
        scriptHash: 'hash',
        safetyTest: { status: 'verified' as const, verifiedAtMs: 10 }
      }
    };
    const runtime = await readClimateRuleRuntime(deployed, plug, deps('unknown'));
    expect(runtime.mode).toBe('unknown');
    expect(runtime.modeSupported).toBe(false);
    expect(runtime.scriptMatch).toBe('matched');
  });

  it('does not infer deployment ownership from device or sensor names', async () => {
    const renamedPlug = { ...plug, name: 'Renamed plug' };
    const renamedSensor = { ...sensor, name: 'Renamed sensor' };
    expect(renamedPlug.id).toBe(climate.plugId);
    expect(renamedSensor.id).toBe(climate.sensorId);
    const runtime = await readClimateRuleRuntime(climate, renamedPlug, deps('auto'));
    expect(runtime.scriptMatch).toBe('undeployed');
  });
});
EOF
pnpm exec prettier --write apps/mobile/src/flows/runtime/relaySafety.ts apps/mobile/src/flows/installations/relaySafety.ts apps/mobile/src/flows/rules/runtimeError.ts apps/mobile/src/flows/rules/runtimeOwnership.ts apps/mobile/src/flows/rules/climateRuntime.ts apps/mobile/src/flows/rules/timeRuntime.ts apps/mobile/src/flows/rules/runtimeOwnership.test.ts apps/mobile/src/flows/rules/timeRuntime.test.ts apps/mobile/src/flows/rules/climateRuntime.test.ts
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile test -- src/flows/rules/runtimeOwnership.test.ts src/flows/rules/climateRuntime.test.ts src/flows/rules/timeRuntime.test.ts src/flows/rules/ownership.test.ts src/flows/rules/timeSchedule.test.ts src/flows/installations/runtimeControl.test.ts
pnpm quality:repo
pnpm quality:ux
git status --short
git diff --stat
git add apps/mobile/src/flows/runtime/relaySafety.ts apps/mobile/src/flows/installations/relaySafety.ts apps/mobile/src/flows/rules/runtimeError.ts apps/mobile/src/flows/rules/runtimeOwnership.ts apps/mobile/src/flows/rules/climateRuntime.ts apps/mobile/src/flows/rules/timeRuntime.ts apps/mobile/src/flows/rules/runtimeOwnership.test.ts apps/mobile/src/flows/rules/timeRuntime.test.ts apps/mobile/src/flows/rules/climateRuntime.test.ts
git commit -m 'Add rule-centric runtime services'
FINAL_HEAD="$(git rev-parse HEAD)"
git fetch origin "$BRANCH"
[ "$(git rev-parse "origin/$BRANCH")" = "$BASE" ] || { echo 'Remote branch changed during runtime task' >&2; exit 1; }
git push origin "$FINAL_HEAD:refs/heads/$BRANCH"
echo "BASE_HEAD=$BASE"
echo "FINAL_HEAD=$FINAL_HEAD"

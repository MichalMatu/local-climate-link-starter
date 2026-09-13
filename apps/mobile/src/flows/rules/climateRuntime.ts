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
    throw ruleRuntimeError(
      'runtime-mismatch',
      'Stored climate script does not match Shelly.'
    );
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
  const config = resolveClimateGeneratorConfig(rule, {
    plugs: [plug],
    sensors: [sensor]
  });
  if (!config.ok) {
    throw ruleRuntimeError(
      'verification-failed',
      'Climate rule devices or config are invalid.'
    );
  }
  await deps.cleanupBle(plug.baseUrl);
  const transport = deps.createTransport(plug.baseUrl);
  const client = deps.createClient(plug.baseUrl);
  const install = unwrapShellyResult(
    await client.installScript(
      createInstallPlan(generateShellyThermostatScript(config.value))
    )
  ) as ShellyInstallResult;
  try {
    await writeClimateMode(transport, install.scriptId, 'manual');
    await forceRelayOffAndConfirm(client, rule.relayId);
    await forceRelayOffAndConfirm(client, rule.relayId);
    const status = await deps.readControlStatus(plug.baseUrl);
    if (
      status.automationScriptId !== install.scriptId ||
      status.automationMode !== 'manual'
    ) {
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
): Promise<{
  deployment: NonNullable<ClimateRule['deployment']>;
  relayTest: RelayTestResult;
}> => {
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
    throw ruleRuntimeError(
      'runtime-unsupported',
      'Climate runtime mode is not supported.'
    );
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
    throw ruleRuntimeError(
      'runtime-unsupported',
      'Manual relay control requires MANUAL.'
    );
  }
  const client = deps.createClient(plug.baseUrl);
  unwrapShellyResult(
    on
      ? await client.setRelayOn({ relayId: rule.relayId })
      : await client.setRelayOff({ relayId: rule.relayId })
  );
  const verified = await requireExactRuntime(rule, plug, deps);
  if (verified.mode !== 'manual' || !verified.modeSupported || verified.relayOn !== on) {
    throw ruleRuntimeError(
      'verification-failed',
      `Shelly did not confirm relay ${on ? 'ON' : 'OFF'}.`
    );
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
      script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME &&
      script.id !== rule.deployment!.scriptId
  );
  if (target && target.name !== LOCAL_CLIMATE_LINK_SCRIPT_NAME) {
    throw ruleRuntimeError(
      'runtime-mismatch',
      'Stored script id belongs to another script.'
    );
  }
  if (otherManaged) {
    throw ruleRuntimeError(
      'ownership-conflict',
      'Another managed climate script exists.'
    );
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
    throw ruleRuntimeError(
      'verification-failed',
      'Shelly did not confirm climate deletion.'
    );
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

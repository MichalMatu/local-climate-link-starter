import type { SavedPlug } from '../devices/plugs/model.js';
import { runPlugOperation } from '../devices/plugs/operations.js';
import type { SavedSensor } from '../devices/sensors/model.js';
import {
  usePlugStore,
  useRuleStore,
  useSensorStore
} from '../registry/devicesAndRules.js';
import type { RegistryResult } from '../registry/result.js';
import {
  deleteClimateRuleDeployment,
  deployClimateRule,
  pauseClimateRule,
  readClimateRuleRuntime,
  resumeClimateRule,
  runClimateRuleSafetyTest,
  setClimateRuleRelay,
  type ClimateRuleRuntimeSnapshot
} from './climateRuntime.js';
import { ruleLifecycleError } from './lifecycleError.js';
import { automationRuleSchema, type AutomationRule, type ClimateRule } from './model.js';
import { requireRuleRelayOwnership } from './runtimeOwnership.js';
import {
  deleteTimeRuleDeployment,
  deployTimeRule,
  pauseTimeRule,
  readTimeRuleRuntime,
  resumeTimeRule,
  type TimeRuleRuntimeSnapshot
} from './timeRuntime.js';

export type RuleRuntimeSnapshot = ClimateRuleRuntimeSnapshot | TimeRuleRuntimeSnapshot;

type LifecycleStores = {
  getRules(): readonly AutomationRule[];
  getPlugs(): readonly SavedPlug[];
  getSensors(): readonly SavedSensor[];
  upsertRule(input: unknown): RegistryResult<AutomationRule>;
  removeRule(id: string): RegistryResult<null>;
};

type LifecycleRuntime = {
  deployClimate: typeof deployClimateRule;
  verifyClimate: typeof runClimateRuleSafetyTest;
  pauseClimate: typeof pauseClimateRule;
  resumeClimate: typeof resumeClimateRule;
  setClimateRelay: typeof setClimateRuleRelay;
  readClimate: typeof readClimateRuleRuntime;
  deleteClimate: typeof deleteClimateRuleDeployment;
  deployTime: typeof deployTimeRule;
  pauseTime: typeof pauseTimeRule;
  resumeTime: typeof resumeTimeRule;
  readTime: typeof readTimeRuleRuntime;
  deleteTime: typeof deleteTimeRuleDeployment;
  requireOwnership: typeof requireRuleRelayOwnership;
};

export type RuleLifecycleDependencies = {
  stores: LifecycleStores;
  runtime: LifecycleRuntime;
  runPlugOperation: typeof runPlugOperation;
  now(): number;
};

const defaultDependencies: RuleLifecycleDependencies = {
  stores: {
    getRules: () => useRuleStore.getState().items,
    getPlugs: () => usePlugStore.getState().items,
    getSensors: () => useSensorStore.getState().items,
    upsertRule: (input) => useRuleStore.getState().upsert(input),
    removeRule: (id) => useRuleStore.getState().remove(id)
  },
  runtime: {
    deployClimate: deployClimateRule,
    verifyClimate: runClimateRuleSafetyTest,
    pauseClimate: pauseClimateRule,
    resumeClimate: resumeClimateRule,
    setClimateRelay: setClimateRuleRelay,
    readClimate: readClimateRuleRuntime,
    deleteClimate: deleteClimateRuleDeployment,
    deployTime: deployTimeRule,
    pauseTime: pauseTimeRule,
    resumeTime: resumeTimeRule,
    readTime: readTimeRuleRuntime,
    deleteTime: deleteTimeRuleDeployment,
    requireOwnership: requireRuleRelayOwnership
  },
  runPlugOperation,
  now: Date.now
};

const unwrapRegistry = <T>(result: RegistryResult<T>): T => {
  if (!result.ok) {
    throw ruleLifecycleError(
      'registry-rejected',
      `Rule registry rejected operation (${result.error.kind}).`,
      result.error
    );
  }
  return result.value;
};

const requireRule = (id: string, deps: RuleLifecycleDependencies): AutomationRule => {
  const rule = deps.stores.getRules().find((candidate) => candidate.id === id);
  if (!rule) throw ruleLifecycleError('rule-missing', `Rule ${id} does not exist.`);
  return rule;
};

const requireDevices = (
  rule: AutomationRule,
  deps: RuleLifecycleDependencies
): { plug: SavedPlug; sensor?: SavedSensor } => {
  const plug = deps.stores.getPlugs().find((candidate) => candidate.id === rule.plugId);
  if (!plug)
    throw ruleLifecycleError('device-missing', `Plug ${rule.plugId} is missing.`);
  if (rule.kind === 'time') return { plug };
  const sensor = deps.stores
    .getSensors()
    .find((candidate) => candidate.id === rule.sensorId);
  if (!sensor)
    throw ruleLifecycleError('device-missing', `Sensor ${rule.sensorId} is missing.`);
  return { plug, sensor };
};

const parseDesiredRule = (input: unknown): AutomationRule => {
  const parsed = automationRuleSchema.safeParse(input);
  if (!parsed.success || parsed.data.deployment !== null) {
    throw ruleLifecycleError(
      'invalid-draft',
      'Desired rule must be valid and undeployed.'
    );
  }
  return parsed.data;
};

const preflightDesiredRule = (
  desired: AutomationRule,
  deps: RuleLifecycleDependencies
): void => {
  requireDevices(desired, deps);
  const conflict = deps.stores
    .getRules()
    .find(
      (candidate) =>
        candidate.id !== desired.id &&
        candidate.plugId === desired.plugId &&
        candidate.relayId === desired.relayId
    );
  if (conflict) {
    throw ruleLifecycleError(
      'registry-rejected',
      `Relay is already owned by rule ${conflict.id}.`,
      { kind: 'rule-relay-conflict', ruleIds: [conflict.id] }
    );
  }
};

const deployRemote = async (
  rule: AutomationRule,
  deps: RuleLifecycleDependencies
): Promise<AutomationRule> => {
  const { plug, sensor } = requireDevices(rule, deps);
  const rules = deps.stores.getRules();
  if (rule.kind === 'climate') {
    if (!sensor) throw ruleLifecycleError('device-missing', 'Climate sensor is missing.');
    const deployment = await deps.runtime.deployClimate({ rule, plug, sensor, rules });
    return { ...rule, deployment };
  }
  const deployment = await deps.runtime.deployTime({ rule, plug, rules });
  return { ...rule, deployment };
};

const deleteRemote = async (
  rule: AutomationRule,
  deps: RuleLifecycleDependencies
): Promise<void> => {
  if (!rule.deployment) return;
  const { plug } = requireDevices(rule, deps);
  if (rule.kind === 'climate') await deps.runtime.deleteClimate(rule, plug);
  else await deps.runtime.deleteTime(rule, plug);
};

const persistDesiredUndeployed = (
  desired: AutomationRule,
  deps: RuleLifecycleDependencies
): AutomationRule =>
  unwrapRegistry(
    deps.stores.upsertRule({ ...desired, deployment: null, updatedAtMs: deps.now() })
  );

const persistRemoteDeployment = async (
  desired: AutomationRule,
  deployed: AutomationRule,
  deps: RuleLifecycleDependencies
): Promise<AutomationRule> => {
  const attached = { ...deployed, updatedAtMs: deps.now() } as AutomationRule;
  try {
    return unwrapRegistry(deps.stores.upsertRule(attached));
  } catch (error) {
    await deleteRemote(attached, deps).catch(() => undefined);
    deps.stores.upsertRule({
      ...desired,
      deployment: null,
      updatedAtMs: deps.now()
    });
    throw error;
  }
};

export const saveRuleDraft = (
  input: unknown,
  deps: RuleLifecycleDependencies = defaultDependencies
): AutomationRule => {
  const desired = parseDesiredRule(input);
  preflightDesiredRule(desired, deps);
  const existing = deps.stores.getRules().find((rule) => rule.id === desired.id);
  if (existing?.deployment) {
    throw ruleLifecycleError(
      'rule-already-deployed',
      'Deployed rules must be changed through redeployRule.'
    );
  }
  return unwrapRegistry(deps.stores.upsertRule(desired));
};

export const deployRule = async (
  ruleId: string,
  deps: RuleLifecycleDependencies = defaultDependencies
): Promise<AutomationRule> => {
  const snapshot = requireRule(ruleId, deps);
  return deps.runPlugOperation(snapshot.plugId, async () => {
    const rule = requireRule(ruleId, deps);
    if (rule.deployment) {
      throw ruleLifecycleError('rule-already-deployed', 'Rule is already deployed.');
    }
    const deployed = await deployRemote(rule, deps);
    try {
      return unwrapRegistry(
        deps.stores.upsertRule({ ...deployed, updatedAtMs: deps.now() })
      );
    } catch (error) {
      await deleteRemote(deployed, deps).catch(() => undefined);
      throw error;
    }
  });
};

export const verifyRule = async (
  ruleId: string,
  deps: RuleLifecycleDependencies = defaultDependencies
): Promise<AutomationRule> => {
  const snapshot = requireRule(ruleId, deps);
  return deps.runPlugOperation(snapshot.plugId, async () => {
    const rule = requireRule(ruleId, deps);
    if (!rule.deployment)
      throw ruleLifecycleError('rule-not-deployed', 'Rule is not deployed.');
    const { plug } = requireDevices(rule, deps);
    if (rule.kind === 'time') {
      const runtime = await deps.runtime.readTime(rule, plug);
      if (
        runtime.scheduleState === 'attention' ||
        runtime.scheduleState === 'undeployed'
      ) {
        throw ruleLifecycleError('runtime-attention', 'Time runtime needs recovery.');
      }
      return rule;
    }
    if (rule.deployment.safetyTest.status === 'verified') return rule;
    try {
      const verified = await deps.runtime.verifyClimate(rule, plug, deps.now());
      return unwrapRegistry(
        deps.stores.upsertRule({
          ...rule,
          deployment: verified.deployment,
          updatedAtMs: deps.now()
        })
      );
    } catch (error) {
      const failed: ClimateRule = {
        ...rule,
        deployment: {
          ...rule.deployment,
          safetyTest: { status: 'failed', failedAtMs: deps.now() }
        },
        updatedAtMs: deps.now()
      };
      deps.stores.upsertRule(failed);
      throw error;
    }
  });
};

export const pauseRule = async (
  ruleId: string,
  deps: RuleLifecycleDependencies = defaultDependencies
): Promise<RuleRuntimeSnapshot> => {
  const snapshot = requireRule(ruleId, deps);
  return deps.runPlugOperation(snapshot.plugId, async () => {
    const rule = requireRule(ruleId, deps);
    if (!rule.deployment)
      throw ruleLifecycleError('rule-not-deployed', 'Rule is not deployed.');
    const { plug } = requireDevices(rule, deps);
    return rule.kind === 'climate'
      ? deps.runtime.pauseClimate(rule, plug)
      : deps.runtime.pauseTime(rule, plug);
  });
};

export const resumeRule = async (
  ruleId: string,
  deps: RuleLifecycleDependencies = defaultDependencies
): Promise<RuleRuntimeSnapshot> => {
  const snapshot = requireRule(ruleId, deps);
  return deps.runPlugOperation(snapshot.plugId, async () => {
    const rule = requireRule(ruleId, deps);
    if (!rule.deployment)
      throw ruleLifecycleError('rule-not-deployed', 'Rule is not deployed.');
    const { plug } = requireDevices(rule, deps);
    if (rule.kind === 'climate') {
      if (rule.deployment.safetyTest.status !== 'verified') {
        throw ruleLifecycleError(
          'runtime-attention',
          'Climate rule requires a verified safety test before AUTO.'
        );
      }
      return deps.runtime.resumeClimate(rule, plug);
    }
    return deps.runtime.resumeTime(rule, plug);
  });
};

export const setRuleRelay = async (
  ruleId: string,
  on: boolean,
  deps: RuleLifecycleDependencies = defaultDependencies
): Promise<ClimateRuleRuntimeSnapshot> => {
  const snapshot = requireRule(ruleId, deps);
  return deps.runPlugOperation(snapshot.plugId, async () => {
    const rule = requireRule(ruleId, deps);
    if (rule.kind !== 'climate') {
      throw ruleLifecycleError(
        'runtime-attention',
        'Manual relay control is only available for climate rules.'
      );
    }
    if (!rule.deployment) {
      throw ruleLifecycleError('rule-not-deployed', 'Rule is not deployed.');
    }
    const { plug } = requireDevices(rule, deps);
    return deps.runtime.setClimateRelay(rule, plug, on);
  });
};

export const deleteRule = async (
  ruleId: string,
  deps: RuleLifecycleDependencies = defaultDependencies
): Promise<void> => {
  const snapshot = requireRule(ruleId, deps);
  await deps.runPlugOperation(snapshot.plugId, async () => {
    const rule = requireRule(ruleId, deps);
    if (rule.deployment) {
      await deleteRemote(rule, deps);
      unwrapRegistry(
        deps.stores.upsertRule({ ...rule, deployment: null, updatedAtMs: deps.now() })
      );
    }
    unwrapRegistry(deps.stores.removeRule(ruleId));
  });
};

export const redeployRule = async (
  input: unknown,
  deps: RuleLifecycleDependencies = defaultDependencies
): Promise<AutomationRule> => {
  const desired = parseDesiredRule(input);
  preflightDesiredRule(desired, deps);
  const previous = requireRule(desired.id, deps);
  if (!previous.deployment) {
    saveRuleDraft(desired, deps);
    return deployRule(desired.id, deps);
  }

  const remoteTransaction = async (): Promise<AutomationRule> => {
    const current = requireRule(desired.id, deps);
    await deleteRemote(current, deps);
    try {
      return await deployRemote(desired, deps);
    } catch (error) {
      persistDesiredUndeployed(desired, deps);
      throw error;
    }
  };

  let deployed: AutomationRule;
  if (previous.plugId === desired.plugId) {
    deployed = await deps.runPlugOperation(previous.plugId, remoteTransaction);
  } else {
    await deps.runPlugOperation(previous.plugId, async () =>
      deleteRemote(previous, deps)
    );
    try {
      deployed = await deps.runPlugOperation(desired.plugId, () =>
        deployRemote(desired, deps)
      );
    } catch (error) {
      persistDesiredUndeployed(desired, deps);
      throw error;
    }
  }
  return persistRemoteDeployment(desired, deployed, deps);
};

export const recoverRule = async (
  ruleId: string,
  deps: RuleLifecycleDependencies = defaultDependencies
): Promise<AutomationRule> => {
  const snapshot = requireRule(ruleId, deps);
  return deps.runPlugOperation(snapshot.plugId, async () => {
    const rule = requireRule(ruleId, deps);
    if (!rule.deployment) {
      const deployed = await deployRemote(rule, deps);
      try {
        return unwrapRegistry(
          deps.stores.upsertRule({ ...deployed, updatedAtMs: deps.now() })
        );
      } catch (error) {
        await deleteRemote(deployed, deps).catch(() => undefined);
        throw error;
      }
    }
    const { plug } = requireDevices(rule, deps);
    if (rule.kind === 'climate') {
      const runtime = await deps.runtime.readClimate(rule, plug);
      if (runtime.scriptMatch === 'matched') return rule;
      if (runtime.scriptMatch !== 'missing') {
        throw ruleLifecycleError(
          'runtime-attention',
          'Climate deployment identity mismatched.'
        );
      }
    } else {
      const runtime = await deps.runtime.readTime(rule, plug);
      if (runtime.scheduleState === 'running' || runtime.scheduleState === 'paused')
        return rule;
      if (runtime.scheduleState !== 'attention') {
        throw ruleLifecycleError(
          'runtime-attention',
          'Time deployment cannot be recovered.'
        );
      }
    }
    await deps.runtime.requireOwnership({
      rule,
      plug,
      rules: deps.stores.getRules()
    });
    const desired = { ...rule, deployment: null } as AutomationRule;
    const deployed = await deployRemote(desired, deps);
    return persistRemoteDeployment(desired, deployed, deps);
  });
};

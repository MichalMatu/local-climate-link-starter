#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=178607a65ebd7f98df3410d812d052b4ccefba8c
cd "$REPO"
git fetch origin "$BRANCH" agent-control
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }
git checkout "$BRANCH"
git reset --hard "$REMOTE"
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

cat > apps/mobile/src/flows/rules/lifecycleError.ts <<'EOF'
import type { RegistryError } from '../registry/result.js';

export type RuleLifecycleErrorCode =
  | 'rule-missing'
  | 'rule-already-deployed'
  | 'rule-not-deployed'
  | 'invalid-draft'
  | 'device-missing'
  | 'registry-rejected'
  | 'runtime-attention';

export class RuleLifecycleError extends Error {
  constructor(
    readonly code: RuleLifecycleErrorCode,
    message: string,
    readonly registryError?: RegistryError
  ) {
    super(message);
    this.name = 'RuleLifecycleError';
  }
}

export const ruleLifecycleError = (
  code: RuleLifecycleErrorCode,
  message: string,
  registryError?: RegistryError
): RuleLifecycleError => new RuleLifecycleError(code, message, registryError);
EOF

cat > apps/mobile/src/flows/rules/lifecycle.ts <<'EOF'
import type { SavedPlug } from '../devices/plugs/model.js';
import { runPlugOperation } from '../devices/plugs/operations.js';
import type { SavedSensor } from '../devices/sensors/model.js';
import { usePlugStore, useRuleStore, useSensorStore } from '../registry/devicesAndRules.js';
import type { RegistryResult } from '../registry/result.js';
import {
  deleteClimateRuleDeployment,
  deployClimateRule,
  pauseClimateRule,
  readClimateRuleRuntime,
  resumeClimateRule,
  runClimateRuleSafetyTest,
  type ClimateRuleRuntimeSnapshot
} from './climateRuntime.js';
import { ruleLifecycleError } from './lifecycleError.js';
import {
  automationRuleSchema,
  type AutomationRule,
  type ClimateRule,
  type TimeRule
} from './model.js';
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
  if (!plug) throw ruleLifecycleError('device-missing', `Plug ${rule.plugId} is missing.`);
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
    throw ruleLifecycleError('invalid-draft', 'Desired rule must be valid and undeployed.');
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

const persistDetachedThenAttached = (
  previous: AutomationRule,
  next: AutomationRule,
  deps: RuleLifecycleDependencies
): AutomationRule => {
  unwrapRegistry(
    deps.stores.upsertRule({ ...previous, deployment: null, updatedAtMs: deps.now() })
  );
  return unwrapRegistry(deps.stores.upsertRule(next));
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
      if (runtime.scheduleState === 'attention' || runtime.scheduleState === 'undeployed') {
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
      persistDetachedThenAttached(current, desired, deps);
      throw error;
    }
  };

  let deployed: AutomationRule;
  if (previous.plugId === desired.plugId) {
    deployed = await deps.runPlugOperation(previous.plugId, remoteTransaction);
  } else {
    await deps.runPlugOperation(previous.plugId, async () => deleteRemote(previous, deps));
    try {
      deployed = await deps.runPlugOperation(desired.plugId, () => deployRemote(desired, deps));
    } catch (error) {
      persistDetachedThenAttached(previous, desired, deps);
      throw error;
    }
  }
  return persistDetachedThenAttached(
    previous,
    { ...deployed, updatedAtMs: deps.now() },
    deps
  );
};

export const recoverRule = async (
  ruleId: string,
  deps: RuleLifecycleDependencies = defaultDependencies
): Promise<AutomationRule> => {
  const snapshot = requireRule(ruleId, deps);
  return deps.runPlugOperation(snapshot.plugId, async () => {
    const rule = requireRule(ruleId, deps);
    if (!rule.deployment) return deployRule(ruleId, deps);
    const { plug } = requireDevices(rule, deps);
    if (rule.kind === 'climate') {
      const runtime = await deps.runtime.readClimate(rule, plug);
      if (runtime.scriptMatch === 'matched') return rule;
      if (runtime.scriptMatch !== 'missing') {
        throw ruleLifecycleError('runtime-attention', 'Climate deployment identity mismatched.');
      }
    } else {
      const runtime = await deps.runtime.readTime(rule, plug);
      if (runtime.scheduleState === 'running' || runtime.scheduleState === 'paused') return rule;
      if (runtime.scheduleState !== 'attention') {
        throw ruleLifecycleError('runtime-attention', 'Time deployment cannot be recovered.');
      }
    }
    await deps.runtime.requireOwnership({
      rule,
      plug,
      rules: deps.stores.getRules()
    });
    const desired = { ...rule, deployment: null } as AutomationRule;
    const deployed = await deployRemote(desired, deps);
    return persistDetachedThenAttached(
      rule,
      { ...deployed, updatedAtMs: deps.now() },
      deps
    );
  });
};
EOF

cat > apps/mobile/src/flows/rules/lifecycle.test.ts <<'EOF'
import { describe, expect, it, vi } from 'vitest';
import { climate, plug, sensor, time } from '../registry/fixtures.test-support.js';
import type { RegistryResult } from '../registry/result.js';
import type { AutomationRule } from './model.js';
import {
  deleteRule,
  deployRule,
  recoverRule,
  redeployRule,
  resumeRule,
  saveRuleDraft,
  verifyRule,
  type RuleLifecycleDependencies
} from './lifecycle.js';

const pendingClimate = {
  scriptId: 7,
  scriptHash: 'hash',
  safetyTest: { status: 'pending' as const }
};

const createHarness = (initial: AutomationRule[] = []) => {
  let rules = [...initial];
  let now = 100;
  const events: string[] = [];
  const upsertRule = (input: unknown): RegistryResult<AutomationRule> => {
    const rule = input as AutomationRule;
    rules = [rule, ...rules.filter((candidate) => candidate.id !== rule.id)];
    events.push(`store:upsert:${rule.id}:${rule.deployment ? 'deployed' : 'draft'}`);
    return { ok: true, value: rule };
  };
  const runtime = {
    deployClimate: vi.fn(async () => {
      events.push('remote:deploy-climate');
      return pendingClimate;
    }),
    verifyClimate: vi.fn(async (rule: typeof climate & { deployment: typeof pendingClimate }) => {
      events.push('remote:verify-climate');
      return {
        deployment: {
          ...rule.deployment,
          safetyTest: { status: 'verified' as const, verifiedAtMs: now }
        },
        relayTest: { finalRelayOn: false }
      } as never;
    }),
    pauseClimate: vi.fn(async () => ({ mode: 'manual' }) as never),
    resumeClimate: vi.fn(async () => ({ mode: 'auto' }) as never),
    readClimate: vi.fn(async () => ({ scriptMatch: 'matched' }) as never),
    deleteClimate: vi.fn(async () => {
      events.push('remote:delete-climate');
    }),
    deployTime: vi.fn(async () => {
      events.push('remote:deploy-time');
      return { pairs: [{ windowIndex: 0, onJobId: 10, offJobId: 11 }] };
    }),
    pauseTime: vi.fn(async () => ({ scheduleState: 'paused' }) as never),
    resumeTime: vi.fn(async () => ({ scheduleState: 'running' }) as never),
    readTime: vi.fn(async () => ({ scheduleState: 'running' }) as never),
    deleteTime: vi.fn(async () => {
      events.push('remote:delete-time');
    }),
    requireOwnership: vi.fn(async () => ({}) as never)
  };
  const deps = {
    stores: {
      getRules: () => rules,
      getPlugs: () => [plug],
      getSensors: () => [sensor],
      upsertRule,
      removeRule: (id: string) => {
        rules = rules.filter((rule) => rule.id !== id);
        events.push(`store:remove:${id}`);
        return { ok: true, value: null } as const;
      }
    },
    runtime,
    runPlugOperation: async (_plugId: string, operation: () => Promise<unknown>) => {
      events.push('queue');
      return operation();
    },
    now: () => ++now
  } as unknown as RuleLifecycleDependencies;
  return { deps, runtime, events, getRules: () => rules };
};

describe('rule lifecycle', () => {
  it('persists a desired rule before deploy and attaches pending climate deployment', async () => {
    const harness = createHarness();
    saveRuleDraft(climate, harness.deps);
    const deployed = await deployRule(climate.id, harness.deps);
    expect(deployed.kind).toBe('climate');
    expect(deployed.deployment).toEqual(pendingClimate);
    expect(harness.events).toEqual([
      'store:upsert:climate-1:draft',
      'queue',
      'remote:deploy-climate',
      'store:upsert:climate-1:deployed'
    ]);
  });

  it('keeps the desired rule undeployed when remote deploy fails', async () => {
    const harness = createHarness([climate]);
    harness.runtime.deployClimate.mockRejectedValueOnce(new Error('offline'));
    await expect(deployRule(climate.id, harness.deps)).rejects.toThrow('offline');
    expect(harness.getRules()[0]?.deployment).toBeNull();
  });

  it('records a verified safety test and blocks AUTO before verification', async () => {
    const deployed = { ...climate, deployment: pendingClimate };
    const harness = createHarness([deployed]);
    await expect(resumeRule(climate.id, harness.deps)).rejects.toMatchObject({
      code: 'runtime-attention'
    });
    const verified = await verifyRule(climate.id, harness.deps);
    expect(verified.kind === 'climate' && verified.deployment?.safetyTest.status).toBe(
      'verified'
    );
  });

  it('deletes the exact remote deployment before detaching and removing the rule', async () => {
    const harness = createHarness([{ ...climate, deployment: pendingClimate }]);
    await deleteRule(climate.id, harness.deps);
    expect(harness.events).toEqual([
      'queue',
      'remote:delete-climate',
      'store:upsert:climate-1:draft',
      'store:remove:climate-1'
    ]);
    expect(harness.getRules()).toEqual([]);
  });

  it('completes remote redeploy before switching desired config and deployment metadata', async () => {
    const previous = { ...climate, deployment: pendingClimate };
    const desired = {
      ...climate,
      name: 'Independent rule name',
      config: {
        ...climate.config,
        rule: { ...climate.config.rule, minChangeMs: climate.config.rule.minChangeMs + 1000 }
      },
      updatedAtMs: 50
    };
    const harness = createHarness([previous]);
    const next = await redeployRule(desired, harness.deps);
    expect(next.name).toBe('Independent rule name');
    expect(harness.events.slice(0, 3)).toEqual([
      'queue',
      'remote:delete-climate',
      'remote:deploy-climate'
    ]);
    expect(harness.events.slice(3)).toEqual([
      'store:upsert:climate-1:draft',
      'store:upsert:climate-1:deployed'
    ]);
  });

  it('recovers only after runtime inventory confirms missing ownership', async () => {
    const deployed = {
      ...time,
      deployment: { pairs: [{ windowIndex: 0, onJobId: 10, offJobId: 11 }] }
    };
    const harness = createHarness([deployed]);
    harness.runtime.readTime.mockResolvedValueOnce({ scheduleState: 'attention' } as never);
    const recovered = await recoverRule(time.id, harness.deps);
    expect(harness.runtime.requireOwnership).toHaveBeenCalledOnce();
    expect(harness.runtime.deployTime).toHaveBeenCalledOnce();
    expect(recovered.deployment).not.toBeNull();
  });
});
EOF

pnpm exec prettier --write apps/mobile/src/flows/rules/lifecycleError.ts apps/mobile/src/flows/rules/lifecycle.ts apps/mobile/src/flows/rules/lifecycle.test.ts
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile test -- src/flows/rules/lifecycle.test.ts src/flows/rules/runtimeOwnership.test.ts src/flows/rules/climateRuntime.test.ts src/flows/rules/timeRuntime.test.ts
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add apps/mobile/src/flows/rules/lifecycleError.ts apps/mobile/src/flows/rules/lifecycle.ts apps/mobile/src/flows/rules/lifecycle.test.ts
git commit -m 'Add rule lifecycle orchestration'
HEAD=$(git rev-parse HEAD)
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$EXPECTED" ]] || { echo 'Remote moved during lifecycle task'; exit 4; }
git push origin "$HEAD:$BRANCH"
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$HEAD" ]] || { echo 'Push verification failed'; exit 5; }
echo "FINAL_HEAD=$HEAD"

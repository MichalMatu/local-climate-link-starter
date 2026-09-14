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
  setRuleRelay,
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
    verifyClimate: vi.fn(
      async (rule: typeof climate & { deployment: typeof pendingClimate }) => {
        events.push('remote:verify-climate');
        return {
          deployment: {
            ...rule.deployment,
            safetyTest: { status: 'verified' as const, verifiedAtMs: now }
          },
          relayTest: { finalRelayOn: false }
        } as never;
      }
    ),
    pauseClimate: vi.fn(async () => ({ mode: 'manual' }) as never),
    resumeClimate: vi.fn(async () => ({ mode: 'auto' }) as never),
    setClimateRelay: vi.fn(
      async (_rule, _plug, on: boolean) => ({ relayOn: on, mode: 'manual' }) as never
    ),
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

  it('serializes manual climate relay control through the plug queue', async () => {
    const deployed = {
      ...climate,
      deployment: {
        ...pendingClimate,
        safetyTest: { status: 'verified' as const, verifiedAtMs: 99 }
      }
    };
    const harness = createHarness([deployed]);
    const runtime = await setRuleRelay(climate.id, true, harness.deps);
    expect(harness.events[0]).toBe('queue');
    expect(harness.runtime.setClimateRelay).toHaveBeenCalledWith(deployed, plug, true);
    expect(runtime).toMatchObject({ relayOn: true, mode: 'manual' });
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
        rule: {
          ...climate.config.rule,
          minChangeMs: climate.config.rule.minChangeMs + 1000
        }
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
    expect(harness.events.slice(3)).toEqual(['store:upsert:climate-1:deployed']);
  });

  it('cleans a new remote deployment and leaves desired config undeployed when redeploy persistence fails', async () => {
    const previous = { ...climate, deployment: pendingClimate };
    const desired = {
      ...climate,
      name: 'Desired after failed attach',
      updatedAtMs: 50
    };
    const harness = createHarness([previous]);
    const originalUpsert = harness.deps.stores.upsertRule;
    let rejectedDeploymentAttach = false;
    harness.deps.stores.upsertRule = (input: unknown) => {
      const rule = input as AutomationRule;
      if (!rejectedDeploymentAttach && rule.deployment) {
        rejectedDeploymentAttach = true;
        harness.events.push('store:reject:deployed');
        return { ok: false, error: { kind: 'storage-unavailable' } };
      }
      return originalUpsert(input);
    };

    await expect(redeployRule(desired, harness.deps)).rejects.toMatchObject({
      code: 'registry-rejected'
    });

    expect(harness.runtime.deleteClimate).toHaveBeenCalledTimes(2);
    expect(harness.events).toEqual([
      'queue',
      'remote:delete-climate',
      'remote:deploy-climate',
      'store:reject:deployed',
      'remote:delete-climate',
      'store:upsert:climate-1:draft'
    ]);
    expect(harness.getRules()[0]).toMatchObject({
      id: climate.id,
      name: 'Desired after failed attach',
      deployment: null
    });
  });

  it('cleans a recovered remote deployment when persistence fails', async () => {
    const deployed = {
      ...time,
      deployment: { pairs: [{ windowIndex: 0, onJobId: 10, offJobId: 11 }] }
    };
    const harness = createHarness([deployed]);
    harness.runtime.readTime.mockResolvedValueOnce({
      scheduleState: 'attention'
    } as never);
    const originalUpsert = harness.deps.stores.upsertRule;
    let rejectedDeploymentAttach = false;
    harness.deps.stores.upsertRule = (input: unknown) => {
      const rule = input as AutomationRule;
      if (!rejectedDeploymentAttach && rule.deployment) {
        rejectedDeploymentAttach = true;
        harness.events.push('store:reject:deployed');
        return { ok: false, error: { kind: 'storage-unavailable' } };
      }
      return originalUpsert(input);
    };

    await expect(recoverRule(time.id, harness.deps)).rejects.toMatchObject({
      code: 'registry-rejected'
    });

    expect(harness.runtime.deleteTime).toHaveBeenCalledOnce();
    expect(harness.getRules()[0]?.deployment).toBeNull();
  });

  it('recovers an undeployed rule without re-entering the plug queue', async () => {
    const harness = createHarness([time]);
    const recovered = await recoverRule(time.id, harness.deps);
    expect(harness.events.filter((event) => event === 'queue')).toHaveLength(1);
    expect(harness.runtime.deployTime).toHaveBeenCalledOnce();
    expect(recovered.deployment).not.toBeNull();
  });

  it('recovers only after runtime inventory confirms missing ownership', async () => {
    const deployed = {
      ...time,
      deployment: { pairs: [{ windowIndex: 0, onJobId: 10, offJobId: 11 }] }
    };
    const harness = createHarness([deployed]);
    harness.runtime.readTime.mockResolvedValueOnce({
      scheduleState: 'attention'
    } as never);
    const recovered = await recoverRule(time.id, harness.deps);
    expect(harness.runtime.requireOwnership).toHaveBeenCalledOnce();
    expect(harness.runtime.deployTime).toHaveBeenCalledOnce();
    expect(recovered.deployment).not.toBeNull();
  });
});

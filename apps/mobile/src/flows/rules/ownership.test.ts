import { LOCAL_CLIMATE_LINK_SCRIPT_NAME } from '@lcl/shelly-client';
import { describe, expect, it } from 'vitest';
import { climate, plug, time } from '../registry/fixtures.test-support.js';
import { createDailyScheduleJob } from '../time-automation/scheduleJobs.js';
import type { AutomationRule } from './model.js';
import { resolveRelayOwnership, type RelayInventory } from './ownership.js';

const script = { id: 7, name: LOCAL_CLIMATE_LINK_SCRIPT_NAME, running: true };
const climateDeployed = {
  ...climate,
  deployment: {
    scriptId: 7,
    scriptHash: 'hash',
    safetyTest: { status: 'pending' as const }
  }
};
const timeDeployed = { ...time, deployment: { onJobId: 8, offJobId: 9 } };
const jobs = [
  { id: 8, ...createDailyScheduleJob({ ...time.config, relayId: 0 }, true) },
  { id: 9, ...createDailyScheduleJob({ ...time.config, relayId: 0 }, false) }
];
const inventory = (
  patch: Partial<Extract<RelayInventory, { status: 'verified' }>> = {}
): RelayInventory => ({
  status: 'verified',
  plugId: plug.id,
  baseUrl: plug.baseUrl,
  scripts: [],
  schedules: [],
  ...patch
});
const resolve = (rules: AutomationRule[], live: RelayInventory, editingRuleId?: string) =>
  resolveRelayOwnership({
    plug,
    relayId: 0,
    rules,
    inventory: live,
    ...(editingRuleId ? { editingRuleId } : {})
  });

describe('relay ownership', () => {
  it('requires complete current-device inventory even with no saved rules', () => {
    expect(resolve([], inventory()).status).toBe('no-conflict');
    for (const live of [
      { status: 'unavailable' } as const,
      inventory({ plugId: 'another' }),
      inventory({ baseUrl: 'http://192.168.0.99' })
    ]) {
      expect(resolve([], live).conflicts).toContainEqual({
        kind: 'inventory-unavailable'
      });
    }
  });

  it.each([climate, time])(
    'a saved $kind owner blocks another rule of either kind',
    (rule) => {
      expect(resolve([rule], inventory()).conflicts).toContainEqual({
        kind: 'saved-rule-owner',
        ruleId: rule.id
      });
      expect(resolve([rule], inventory(), rule.id).status).toBe('no-conflict');
      expect(resolve([{ ...rule, plugId: 'another' }], inventory()).status).toBe(
        'no-conflict'
      );
    }
  );

  it('lists every orphan exact managed id including stopped scripts, without including user/discovery scripts', () => {
    const live = inventory({
      scripts: [
        script,
        { ...script, id: 10, running: false },
        { ...script, id: 11, name: 'User script' },
        { ...script, id: 12, name: 'Local Climate Link BLE Discovery' }
      ]
    });
    expect(resolve([], live).conflicts).toEqual([
      { kind: 'orphan-managed-climate-script', scriptId: 7 },
      { kind: 'orphan-managed-climate-script', scriptId: 10 }
    ]);
  });

  it('distinguishes owned climate runtime and never turns its duplicate into owned runtime', () => {
    const live = inventory({ scripts: [script, { ...script, id: 10 }] });
    expect(resolve([climateDeployed], live).conflicts).toContainEqual({
      kind: 'owned-live-climate-script',
      ruleId: climate.id,
      scriptId: 7
    });
    expect(resolve([climateDeployed], live, climate.id).conflicts).toEqual([
      { kind: 'orphan-managed-climate-script', scriptId: 10 }
    ]);
  });

  it.each([climateDeployed, timeDeployed])(
    'only verified absence releases stale $kind metadata',
    (rule) => {
      expect(resolve([rule], { status: 'unavailable' }).status).toBe('blocked');
      expect(resolve([rule], inventory())).toEqual({
        status: 'no-conflict',
        conflicts: [],
        attention: [
          { kind: 'stale-deployment-metadata', ruleId: rule.id, remote: 'missing' }
        ]
      });
    }
  );

  it('keeps renamed/reused script ids blocked, including when editing the original rule', () => {
    expect(
      resolve(
        [climateDeployed],
        inventory({ scripts: [{ ...script, name: 'User script' }] }),
        climate.id
      ).conflicts
    ).toContainEqual({
      kind: 'stale-deployment-metadata',
      ruleId: climate.id,
      remote: 'mismatch'
    });
  });

  it('protects native schedules even when disabled and ignores schedules for other relays', () => {
    expect(
      resolve([], inventory({ schedules: [{ ...jobs[0]!, enable: false }] })).conflicts
    ).toEqual([{ kind: 'unmanaged-native-schedule', jobId: 8 }]);
    expect(
      resolve(
        [],
        inventory({
          schedules: [
            { id: 1, ...createDailyScheduleJob({ ...time.config, relayId: 1 }, true) }
          ]
        })
      ).status
    ).toBe('no-conflict');
  });

  it('allows only the exact schedule pair when editing its rule', () => {
    expect(resolve([timeDeployed], inventory({ schedules: jobs }), time.id).status).toBe(
      'no-conflict'
    );
    expect(
      resolve([timeDeployed], inventory({ schedules: jobs })).conflicts
    ).toContainEqual({ kind: 'saved-rule-owner', ruleId: time.id });
    expect(
      resolve([timeDeployed], inventory({ schedules: [jobs[0]!] }), time.id).conflicts
    ).toContainEqual({
      kind: 'stale-deployment-metadata',
      ruleId: time.id,
      remote: 'partial'
    });
    expect(
      resolve(
        [timeDeployed],
        inventory({ schedules: jobs.map((job) => ({ ...job, timespec: 'changed' })) }),
        time.id
      ).conflicts
    ).toContainEqual({
      kind: 'stale-deployment-metadata',
      ruleId: time.id,
      remote: 'mismatch'
    });
  });

  it('does not let missing metadata hide new orphan scripts or unmanaged schedules', () => {
    const result = resolve(
      [climateDeployed],
      inventory({ scripts: [{ ...script, id: 20 }], schedules: jobs })
    );
    expect(result.status).toBe('blocked');
    expect(result.attention).toContainEqual({
      kind: 'stale-deployment-metadata',
      ruleId: climate.id,
      remote: 'missing'
    });
    expect(result.conflicts).toHaveLength(3);
  });
});

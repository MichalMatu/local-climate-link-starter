import {
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  type ShellyScheduleJob
} from '@lcl/shelly-client';
import { normalizePlugId, type SavedPlug } from '../devices/plugs/model.js';
import { scheduleJobControlsRelay } from './scheduleOwnership.js';
import type { AutomationRule } from './model.js';
import { expectedTimeRulePair, ruleScheduleJobMatches } from './timeSchedule.js';

export type LiveScript = { id: number; name: string; running: boolean };
export type RelayInventory =
  | { status: 'unavailable' }
  | {
      status: 'verified';
      plugId: string;
      baseUrl: string;
      scripts: readonly LiveScript[];
      schedules: readonly ShellyScheduleJob[];
    };

export type RelayConflict =
  | { kind: 'inventory-unavailable' }
  | { kind: 'saved-rule-owner'; ruleId: string }
  | { kind: 'owned-live-climate-script'; ruleId: string; scriptId: number }
  | { kind: 'orphan-managed-climate-script'; scriptId: number }
  | { kind: 'unmanaged-native-schedule'; jobId: number }
  | {
      kind: 'stale-deployment-metadata';
      ruleId: string;
      remote: 'missing' | 'mismatch' | 'partial';
    };

export type RelayOwnership = {
  status: 'no-conflict' | 'blocked';
  conflicts: RelayConflict[];
  attention: Extract<RelayConflict, { kind: 'stale-deployment-metadata' }>[];
};

export const resolveRelayOwnership = ({
  plug,
  relayId,
  rules,
  inventory,
  editingRuleId
}: {
  plug: SavedPlug;
  relayId: number;
  rules: readonly AutomationRule[];
  inventory: RelayInventory;
  editingRuleId?: string;
}): RelayOwnership => {
  const conflicts: RelayConflict[] = [];
  const attention: RelayOwnership['attention'] = [];
  const owners = rules.filter(
    (rule) => rule.plugId === plug.id && rule.relayId === relayId
  );
  if (
    inventory.status !== 'verified' ||
    normalizePlugId(inventory.plugId) !== plug.id ||
    inventory.baseUrl !== plug.baseUrl
  ) {
    return {
      status: 'blocked',
      conflicts: [
        { kind: 'inventory-unavailable' },
        ...owners
          .filter((rule) => rule.id !== editingRuleId)
          .map((rule) => ({ kind: 'saved-rule-owner' as const, ruleId: rule.id }))
      ],
      attention
    };
  }

  const managedScripts = inventory.scripts.filter(
    (script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME
  );
  const jobs = inventory.schedules.filter((job) =>
    scheduleJobControlsRelay(job, relayId)
  );
  const ownedJobIds = new Set<number>();

  for (const rule of owners) {
    let missing = false;
    if (rule.deployment !== null) {
      if (rule.kind === 'climate') {
        const script = inventory.scripts.find(
          (item) => item.id === rule.deployment?.scriptId
        );
        missing = !script;
        if (!script || script.name !== LOCAL_CLIMATE_LINK_SCRIPT_NAME) {
          const issue = {
            kind: 'stale-deployment-metadata',
            ruleId: rule.id,
            remote: script ? 'mismatch' : 'missing'
          } as const;
          attention.push(issue);
          if (script) conflicts.push(issue);
        }
      } else {
        const pairs = rule.deployment.pairs;
        let presentCount = 0;
        let allMatch = true;
        for (const pair of pairs) {
          ownedJobIds.add(pair.onJobId);
          ownedJobIds.add(pair.offJobId);
          const onJob =
            inventory.schedules.find((job) => job.id === pair.onJobId) ?? null;
          const offJob =
            inventory.schedules.find((job) => job.id === pair.offJobId) ?? null;
          if (onJob) presentCount += 1;
          if (offJob) presentCount += 1;
          const expected = expectedTimeRulePair(rule, pair.windowIndex);
          if (
            !ruleScheduleJobMatches(onJob, expected.on) ||
            !ruleScheduleJobMatches(offJob, expected.off)
          ) {
            allMatch = false;
          }
        }
        const expectedCount = pairs.length * 2;
        missing = presentCount === 0;
        if (!allMatch) {
          const issue: Extract<RelayConflict, { kind: 'stale-deployment-metadata' }> = {
            kind: 'stale-deployment-metadata',
            ruleId: rule.id,
            remote: missing
              ? 'missing'
              : presentCount < expectedCount
                ? 'partial'
                : 'mismatch'
          };
          attention.push(issue);
          if (!missing) conflicts.push(issue);
        }
      }
    }
    if (!missing && rule.id !== editingRuleId) {
      conflicts.push({ kind: 'saved-rule-owner', ruleId: rule.id });
    }
  }

  for (const script of managedScripts) {
    const owner = rules.find(
      (rule) =>
        rule.kind === 'climate' &&
        rule.plugId === plug.id &&
        rule.deployment?.scriptId === script.id
    );
    if (!owner) {
      conflicts.push({ kind: 'orphan-managed-climate-script', scriptId: script.id });
    } else if (owner.id !== editingRuleId) {
      conflicts.push({
        kind: 'owned-live-climate-script',
        scriptId: script.id,
        ruleId: owner.id
      });
    }
  }
  for (const job of jobs) {
    if (!ownedJobIds.has(job.id)) {
      conflicts.push({ kind: 'unmanaged-native-schedule', jobId: job.id });
    }
  }
  return { status: conflicts.length ? 'blocked' : 'no-conflict', conflicts, attention };
};

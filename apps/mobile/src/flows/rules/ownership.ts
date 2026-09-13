import { createDailyScheduleJob, jobMatches } from '../time-automation/scheduleJobs.js';
import {
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  type ShellyScheduleJob
} from '@lcl/shelly-client';
import { normalizePlugId, type SavedPlug } from '../devices/plugs/model.js';
import { scheduleJobControlsRelay } from '../time-automation/scheduleOwnership.js';
import type { AutomationRule } from './model.js';

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

// Only a complete inventory for the current physical device and endpoint may
// release an owner. An offline read is never evidence of a missing deployment.
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
        const { onJobId, offJobId } = rule.deployment;
        const present = inventory.schedules.filter(
          (job) => job.id === onJobId || job.id === offJobId
        );
        missing = present.length === 0;
        const config = { ...rule.config, relayId: rule.relayId };
        const matched =
          jobMatches(
            present.find((job) => job.id === onJobId) ?? null,
            createDailyScheduleJob(config, true)
          ) &&
          jobMatches(
            present.find((job) => job.id === offJobId) ?? null,
            createDailyScheduleJob(config, false)
          );
        if (!matched) {
          const issue = {
            kind: 'stale-deployment-metadata',
            ruleId: rule.id,
            remote: missing ? 'missing' : present.length === 1 ? 'partial' : 'mismatch'
          } as const;
          attention.push(issue);
          if (!missing) conflicts.push(issue);
        }
        // These ids are still protected by their rule even when the jobs drift.
        ownedJobIds.add(onJobId);
        ownedJobIds.add(offJobId);
      }
    }
    if (!missing && rule.id !== editingRuleId)
      conflicts.push({ kind: 'saved-rule-owner', ruleId: rule.id });
  }
  for (const script of managedScripts) {
    const owner = rules.find(
      (rule) =>
        rule.kind === 'climate' &&
        rule.plugId === plug.id &&
        rule.deployment?.scriptId === script.id
    );
    if (!owner)
      conflicts.push({ kind: 'orphan-managed-climate-script', scriptId: script.id });
    else if (owner.id !== editingRuleId)
      conflicts.push({
        kind: 'owned-live-climate-script',
        scriptId: script.id,
        ruleId: owner.id
      });
  }
  for (const job of jobs) {
    if (!ownedJobIds.has(job.id))
      conflicts.push({ kind: 'unmanaged-native-schedule', jobId: job.id });
  }
  return { status: conflicts.length ? 'blocked' : 'no-conflict', conflicts, attention };
};

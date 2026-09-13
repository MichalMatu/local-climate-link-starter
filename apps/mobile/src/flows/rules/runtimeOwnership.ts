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

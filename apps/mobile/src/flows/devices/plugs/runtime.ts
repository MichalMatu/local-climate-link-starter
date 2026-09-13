import { LOCAL_CLIMATE_LINK_SCRIPT_NAME } from '@lcl/shelly-client';
import type { AutomationRule } from '../../rules/model.js';
import {
  readPlugRuntime,
  verifyPlugIdentity,
  type PlugRuntimeSnapshot
} from './inventory.js';
import type { SavedPlug } from './model.js';
import { createPlugRuntimeClients, type PlugRuntimeClients } from './runtimeClient.js';
import { fromShellyResult, type PlugRuntimeResult } from './runtimeResult.js';

const forceOff = async (
  plug: SavedPlug,
  clients: PlugRuntimeClients
): Promise<PlugRuntimeResult<null>> => {
  const identity = await verifyPlugIdentity(plug, clients);
  if (!identity.ok) return identity;
  const command = fromShellyResult(await clients.device.setRelayOff({ relayId: 0 }));
  const relay = fromShellyResult(await clients.inventory.readRelay());
  if (!command.ok || !relay.ok || relay.value.output)
    return { ok: false, error: { kind: 'relay-off-unconfirmed' } };
  return { ok: true, value: null };
};

export const setUnownedPlugRelay = async ({
  plug,
  rules,
  on,
  clients = createPlugRuntimeClients(plug.baseUrl)
}: {
  plug: SavedPlug;
  rules: readonly AutomationRule[];
  on: boolean;
  clients?: PlugRuntimeClients;
}): Promise<PlugRuntimeResult<PlugRuntimeSnapshot>> => {
  const initial = await readPlugRuntime(plug, rules, clients);
  if (!initial.ok) return initial;
  if (initial.value.ownership.status !== 'no-conflict')
    return {
      ok: false,
      error: { kind: 'relay-owned', conflicts: initial.value.ownership.conflicts }
    };
  const command = fromShellyResult(
    on
      ? await clients.device.setRelayOn({ relayId: 0 })
      : await clients.device.setRelayOff({ relayId: 0 })
  );
  const verified = await readPlugRuntime(plug, rules, clients);
  if (
    command.ok &&
    verified.ok &&
    verified.value.relayOn === on &&
    verified.value.ownership.status === 'no-conflict'
  )
    return verified;
  const off = await forceOff(plug, clients);
  if (!off.ok) return off;
  return !command.ok
    ? command
    : !verified.ok
      ? verified
      : { ok: false, error: { kind: 'relay-unconfirmed' } };
};

export const deleteOrphanClimateScript = async ({
  plug,
  rules,
  scriptId,
  clients = createPlugRuntimeClients(plug.baseUrl)
}: {
  plug: SavedPlug;
  rules: readonly AutomationRule[];
  scriptId: number;
  clients?: PlugRuntimeClients;
}): Promise<PlugRuntimeResult<PlugRuntimeSnapshot>> => {
  const identity = await verifyPlugIdentity(plug, clients);
  if (!identity.ok) return identity;
  const scripts = fromShellyResult(await clients.inventory.listScripts());
  if (!scripts.ok) return scripts;
  const target = scripts.value.scripts.find((script) => script.id === scriptId);
  if (!target || target.name !== LOCAL_CLIMATE_LINK_SCRIPT_NAME)
    return { ok: false, error: { kind: 'script-not-managed' } };
  const ruleIds = rules
    .filter(
      (rule) =>
        rule.kind === 'climate' &&
        rule.plugId === plug.id &&
        rule.deployment?.scriptId === scriptId
    )
    .map((rule) => rule.id);
  if (ruleIds.length) return { ok: false, error: { kind: 'script-owned', ruleIds } };
  const initialOff = await forceOff(plug, clients);
  if (!initialOff.ok) return initialOff;
  if (target.running) {
    const stopped = fromShellyResult(await clients.device.stopScript(scriptId));
    const off = await forceOff(plug, clients);
    if (!off.ok) return off;
    if (!stopped.ok) return stopped;
  }
  // Refresh exact identity after stopping; never delete a replaced/renamed id.
  const currentScripts = fromShellyResult(await clients.inventory.listScripts());
  if (!currentScripts.ok) return currentScripts;
  if (
    !currentScripts.value.scripts.some(
      (script) =>
        script.id === scriptId &&
        script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME &&
        !script.running
    )
  ) {
    return { ok: false, error: { kind: 'script-unconfirmed' } };
  }
  const deleted = fromShellyResult(await clients.device.deleteScript(scriptId));
  const finalOff = await forceOff(plug, clients);
  if (!finalOff.ok) return finalOff;
  if (!deleted.ok) return deleted;
  const verified = await readPlugRuntime(plug, rules, clients);
  if (
    verified.ok &&
    !verified.value.relayOn &&
    !verified.value.inventory.scripts.some((script) => script.id === scriptId)
  )
    return verified;
  const recoveryOff = await forceOff(plug, clients);
  if (!recoveryOff.ok) return recoveryOff;
  return verified.ok ? { ok: false, error: { kind: 'script-unconfirmed' } } : verified;
};

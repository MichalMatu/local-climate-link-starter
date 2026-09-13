import {
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RPC_METHODS,
  type ShellyInventoryScript
} from '@lcl/shelly-client';
import type { AutomationRule } from '../../rules/model.js';
import {
  resolveRelayOwnership,
  type RelayInventory,
  type RelayOwnership
} from '../../rules/ownership.js';
import { normalizePlugId, type SavedPlug } from './model.js';
import { createPlugRuntimeClients, type PlugRuntimeClients } from './runtimeClient.js';
import { fromShellyResult, type PlugRuntimeResult } from './runtimeResult.js';

export type ManagedPlugScript = ShellyInventoryScript & { ruleIds: string[] };
export type PlugRuntimeSnapshot = {
  relayOn: boolean;
  inventory: Extract<RelayInventory, { status: 'verified' }>;
  ownership: RelayOwnership;
  managedScripts: ManagedPlugScript[];
};

export const verifyPlugIdentity = async (
  plug: SavedPlug,
  clients: PlugRuntimeClients
): Promise<PlugRuntimeResult<null>> => {
  const info = fromShellyResult(await clients.device.getDeviceInfo());
  if (!info.ok) return info;
  return info.value.id &&
    normalizePlugId(info.value.id) === plug.id &&
    info.value.model === plug.model &&
    info.value.gen === plug.gen
    ? { ok: true, value: null }
    : { ok: false, error: { kind: 'identity-mismatch' } };
};

export const readPlugRuntime = async (
  plug: SavedPlug,
  rules: readonly AutomationRule[],
  clients = createPlugRuntimeClients(plug.baseUrl)
): Promise<PlugRuntimeResult<PlugRuntimeSnapshot>> => {
  const identity = await verifyPlugIdentity(plug, clients);
  if (!identity.ok) return identity;
  const methods = fromShellyResult(await clients.inventory.listMethods());
  if (!methods.ok) return methods;
  const scripts = methods.value.methods.includes(RPC_METHODS.ScriptList)
    ? fromShellyResult(await clients.inventory.listScripts())
    : ({ ok: true, value: { scripts: [] } } as const);
  if (!scripts.ok) return scripts;
  const schedules = methods.value.methods.includes(RPC_METHODS.ScheduleList)
    ? fromShellyResult(await clients.schedules.list())
    : ({ ok: true, value: { jobs: [] } } as const);
  if (!schedules.ok) return schedules;
  const relay = fromShellyResult(await clients.inventory.readRelay());
  if (!relay.ok) return relay;
  const inventory = {
    status: 'verified',
    plugId: plug.id,
    baseUrl: plug.baseUrl,
    scripts: scripts.value.scripts,
    schedules: schedules.value.jobs
  } as const;
  return {
    ok: true,
    value: {
      relayOn: relay.value.output,
      inventory,
      ownership: resolveRelayOwnership({ plug, relayId: 0, rules, inventory }),
      managedScripts: scripts.value.scripts
        .filter((script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME)
        .map((script) => ({
          ...script,
          ruleIds: rules
            .filter(
              (rule) =>
                rule.kind === 'climate' &&
                rule.plugId === plug.id &&
                rule.deployment?.scriptId === script.id
            )
            .map((rule) => rule.id)
        }))
    }
  };
};

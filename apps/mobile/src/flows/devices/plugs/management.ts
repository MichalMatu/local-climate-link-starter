import type { RegistryError, RegistryResult } from '../../registry/result.js';
import type { RegistryState } from '../../registry/store.js';
import type { AutomationRule } from '../../rules/model.js';
import { readPlugRuntime } from './inventory.js';
import type { SavedPlug } from './model.js';
import { runPlugOperation } from './operations.js';
import { checkPlugRegistration } from './registration.js';
import { deleteOrphanClimateScript, setUnownedPlugRelay } from './runtime.js';
import { createPlugRuntimeClients } from './runtimeClient.js';
import type { PlugRuntimeError } from './runtimeResult.js';

export type PlugManagementResult<T> =
  { ok: true; value: T } | { ok: false; error: RegistryError | PlugRuntimeError };

export const createPlugManagement = ({
  readPlugs,
  readRules,
  clients = createPlugRuntimeClients,
  serialize = runPlugOperation,
  now = Date.now
}: {
  readPlugs(): RegistryState<SavedPlug>;
  readRules(): RegistryState<AutomationRule>;
  clients?: typeof createPlugRuntimeClients;
  serialize?: typeof runPlugOperation;
  now?: () => number;
}) => {
  const resolve = (
    id: string
  ): RegistryResult<{ plug: SavedPlug; rules: AutomationRule[] }> => {
    const plugs = readPlugs();
    const rules = readRules();
    const error = plugs.loadError ?? rules.loadError;
    if (error) return { ok: false, error };
    const plug = plugs.items.find((item) => item.id === id);
    return plug
      ? { ok: true, value: { plug, rules: rules.items } }
      : {
          ok: false,
          error: { kind: 'device-missing', deviceKind: 'plug', deviceId: id }
        };
  };

  return {
    register: async (
      baseUrl: string,
      name: string
    ): Promise<PlugManagementResult<SavedPlug>> => {
      const checked = await checkPlugRegistration({
        baseUrl,
        name,
        nowMs: now(),
        clients: clients(baseUrl)
      });
      if (!checked.ok) return checked;
      return serialize(checked.value.id, async () => {
        // Recheck after waiting: an address may have been reassigned while queued.
        const current = await checkPlugRegistration({
          baseUrl,
          name,
          nowMs: now(),
          clients: clients(baseUrl)
        });
        if (!current.ok) return current;
        if (current.value.id !== checked.value.id)
          return { ok: false, error: { kind: 'identity-mismatch' } };
        return readPlugs().upsert(current.value);
      });
    },
    refresh: (id: string) =>
      serialize(id, async () => {
        const current = resolve(id);
        if (!current.ok) return current;
        const { plug, rules } = current.value;
        return readPlugRuntime(plug, rules, clients(plug.baseUrl));
      }),
    setRelay: (id: string, on: boolean) =>
      serialize(id, async () => {
        const current = resolve(id);
        if (!current.ok) return current;
        const { plug, rules } = current.value;
        return setUnownedPlugRelay({ plug, rules, on, clients: clients(plug.baseUrl) });
      }),
    deleteOrphan: (id: string, scriptId: number) =>
      serialize(id, async () => {
        const current = resolve(id);
        if (!current.ok) return current;
        const { plug, rules } = current.value;
        return deleteOrphanClimateScript({
          plug,
          rules,
          scriptId,
          clients: clients(plug.baseUrl)
        });
      }),
    rename: (id: string, name: string) =>
      serialize(id, async () => {
        const current = resolve(id);
        return current.ok
          ? readPlugs().upsert({ ...current.value.plug, name, updatedAtMs: now() })
          : current;
      }),
    remove: (id: string) => serialize(id, async () => readPlugs().remove(id))
  };
};

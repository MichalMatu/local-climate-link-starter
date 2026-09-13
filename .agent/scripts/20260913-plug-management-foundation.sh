#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='65b0f6f2c425f6e98b0ae7ad76e0563d51f0da8d'

git fetch --prune origin "$BRANCH" agent-control
if [ -n "$(git status --porcelain)" ]; then
  echo 'ERROR: working tree is not clean.' >&2
  git status --short >&2
  exit 20
fi
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts')
s = p.read_text()
s = s.replace("import type { ShellyDraftDevice } from './setupDraftStore.js';\n", "", 1)
s = s.replace(
"""export const buildUnsavedShellyScanUrls = (
  devices: ShellyDraftDevice[],
""",
"""export type SavedShellyEndpoint = { baseUrl: string };

export const buildUnsavedShellyScanUrls = (
  devices: readonly SavedShellyEndpoint[],
""",
1,
)
s = s.replace(
"export const useShellySetupScanFlow = (shellyDevices: ShellyDraftDevice[]) => {",
"export const useShellySetupScanFlow = (shellyDevices: readonly SavedShellyEndpoint[]) => {",
1,
)
p.write_text(s)
PY

cat > apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.ts <<'EOF'
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { deriveShellyInputState } from '../../hardware-setup/ruleConfigDerivation.js';
import { useShellySetupScanFlow } from '../../hardware-setup/useShellySetupScanFlow.js';
import { usePlugStore, useRuleStore } from '../../registry/devicesAndRules.js';
import type { RegistryError, RegistryResult } from '../../registry/result.js';
import { readPlugRuntime, type PlugRuntimeSnapshot } from './inventory.js';
import type { SavedPlug } from './model.js';
import { checkPlugRegistration } from './registration.js';
import { deleteOrphanClimateScript, setUnownedPlugRelay } from './runtime.js';
import type { PlugRuntimeError, PlugRuntimeResult } from './runtimeResult.js';

export type PlugManagementAction = 'refresh' | 'on' | 'off' | 'delete-script';
export type PlugManagementError = PlugRuntimeError | RegistryError;
export type PlugManagementViewState = {
  snapshot: PlugRuntimeSnapshot | null;
  pendingAction: PlugManagementAction | null;
  error: PlugManagementError | null;
  updatedAtMs: number | null;
};

const initialRuntimeState = (): PlugManagementViewState => ({
  snapshot: null,
  pendingAction: null,
  error: null,
  updatedAtMs: null
});

const registryError = <T>(result: RegistryResult<T>): PlugManagementError | null =>
  result.ok ? null : result.error;

export const usePlugManagementFlow = () => {
  const shellyDevices = usePlugStore((state) => state.items);
  const upsertPlug = usePlugStore((state) => state.upsert);
  const removePlug = usePlugStore((state) => state.remove);
  const rules = useRuleStore((state) => state.items);
  const [shellyNameInput, setShellyNameInput] = useState('Shelly Plug');
  const [shellyUrlInput, setShellyUrlInput] = useState('http://192.168.1.100/');
  const [runtimeStates, setRuntimeStates] = useState<
    Record<string, PlugManagementViewState>
  >({});

  const shellyInputState = useMemo(
    () => deriveShellyInputState({ shellyNameInput, shellyUrlInput }),
    [shellyNameInput, shellyUrlInput]
  );
  const scanFlow = useShellySetupScanFlow(shellyDevices);

  const patchRuntimeState = (
    plugId: string,
    patch: Partial<PlugManagementViewState>
  ) => {
    setRuntimeStates((current) => ({
      ...current,
      [plugId]: { ...(current[plugId] ?? initialRuntimeState()), ...patch }
    }));
  };

  const applyRuntimeResult = (
    plug: SavedPlug,
    action: PlugManagementAction,
    result: PlugRuntimeResult<PlugRuntimeSnapshot>
  ) => {
    patchRuntimeState(plug.id, {
      snapshot: result.ok ? result.value : runtimeStates[plug.id]?.snapshot ?? null,
      pendingAction: null,
      error: result.ok ? null : result.error,
      updatedAtMs: Date.now()
    });
    return { action, plug, result };
  };

  const registrationMutation = useMutation({
    mutationFn: async (): Promise<RegistryResult<SavedPlug> | PlugRuntimeResult<SavedPlug>> => {
      if (!shellyInputState.ok) {
        return { ok: false, error: { kind: 'registration-invalid' } };
      }
      const checked = await checkPlugRegistration({
        baseUrl: shellyInputState.baseUrl,
        name: shellyInputState.name,
        nowMs: Date.now()
      });
      return checked.ok ? upsertPlug(checked.value) : checked;
    }
  });

  const refreshMutation = useMutation({
    mutationFn: async (plug: SavedPlug) => ({
      plug,
      result: await readPlugRuntime(plug, rules)
    }),
    onMutate: (plug) =>
      patchRuntimeState(plug.id, {
        pendingAction: 'refresh',
        error: null
      }),
    onSuccess: ({ plug, result }) => applyRuntimeResult(plug, 'refresh', result)
  });

  const relayMutation = useMutation({
    mutationFn: async ({ plug, on }: { plug: SavedPlug; on: boolean }) => ({
      plug,
      on,
      result: await setUnownedPlugRelay({ plug, rules, on })
    }),
    onMutate: ({ plug, on }) =>
      patchRuntimeState(plug.id, {
        pendingAction: on ? 'on' : 'off',
        error: null
      }),
    onSuccess: ({ plug, on, result }) =>
      applyRuntimeResult(plug, on ? 'on' : 'off', result)
  });

  const deleteScriptMutation = useMutation({
    mutationFn: async ({ plug, scriptId }: { plug: SavedPlug; scriptId: number }) => ({
      plug,
      scriptId,
      result: await deleteOrphanClimateScript({ plug, rules, scriptId })
    }),
    onMutate: ({ plug }) =>
      patchRuntimeState(plug.id, {
        pendingAction: 'delete-script',
        error: null
      }),
    onSuccess: ({ plug, result }) => applyRuntimeResult(plug, 'delete-script', result)
  });

  const setShellyDeviceName = (id: string, name: string): RegistryResult<SavedPlug> => {
    const plug = shellyDevices.find((candidate) => candidate.id === id);
    if (!plug) {
      return {
        ok: false,
        error: { kind: 'device-missing', deviceKind: 'plug', deviceId: id }
      };
    }
    return upsertPlug({ ...plug, name, updatedAtMs: Date.now() });
  };

  const removeShellyDevice = (id: string): RegistryResult<null> => {
    const removed = removePlug(id);
    if (removed.ok) {
      setRuntimeStates((current) =>
        Object.fromEntries(Object.entries(current).filter(([plugId]) => plugId !== id))
      );
    }
    return removed;
  };

  const updatePlugEndpoint = async (
    plug: SavedPlug,
    baseUrl: string
  ): Promise<RegistryResult<SavedPlug> | PlugRuntimeResult<SavedPlug>> => {
    const checked = await checkPlugRegistration({
      baseUrl,
      name: plug.name,
      nowMs: Date.now()
    });
    if (!checked.ok) return checked;
    if (checked.value.id !== plug.id) {
      return { ok: false, error: { kind: 'identity-mismatch' } };
    }
    return upsertPlug({
      ...checked.value,
      createdAtMs: plug.createdAtMs,
      updatedAtMs: Date.now()
    });
  };

  return {
    shellyDevices,
    rules,
    shellyNameInput,
    setShellyNameInput,
    shellyUrlInput,
    setShellyUrlInput,
    shellyInputState,
    runtimeStates,
    registrationMutation,
    refreshMutation,
    relayMutation,
    deleteScriptMutation,
    refreshPlugRuntime: (plug: SavedPlug) => refreshMutation.mutate(plug),
    turnRelayOn: (plug: SavedPlug) => relayMutation.mutate({ plug, on: true }),
    turnRelayOff: (plug: SavedPlug) => relayMutation.mutate({ plug, on: false }),
    deleteOrphanScript: (plug: SavedPlug, scriptId: number) =>
      deleteScriptMutation.mutate({ plug, scriptId }),
    setShellyDeviceName,
    removeShellyDevice,
    updatePlugEndpoint,
    registrationError: registryError,
    ...scanFlow
  };
};

export type PlugManagementFlow = ReturnType<typeof usePlugManagementFlow>;
EOF

cat > apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.test.tsx <<'EOF'
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeviceRuleRegistries } from '../../registry/devicesAndRules.js';
import { createSavedPlug } from './model.js';

vi.mock('../../registry/devicesAndRules.js', async () => {
  const actual = await vi.importActual<typeof import('../../registry/devicesAndRules.js')>(
    '../../registry/devicesAndRules.js'
  );
  const registries = actual.createDeviceRuleRegistries(null);
  return {
    ...actual,
    usePlugStore: registries.plugs,
    useSensorStore: registries.sensors,
    useRuleStore: registries.rules
  };
});

import { usePlugStore } from '../../registry/devicesAndRules.js';
import { usePlugManagementFlow } from './usePlugManagementFlow.js';

const savedPlug = () => {
  const result = createSavedPlug({
    deviceInfo: { id: 'shellyplugsg3-abc', model: 'S3PL-00112EU', gen: 3 },
    name: 'Growbox plug',
    baseUrl: 'http://192.168.1.8/',
    nowMs: 1
  });
  if (!result.ok) throw new Error('fixture invalid');
  return result.value;
};

describe('usePlugManagementFlow registry behavior', () => {
  beforeEach(() => {
    usePlugStore.setState({ items: [], loadError: null });
  });

  it('renames a saved plug without changing physical identity or endpoint', () => {
    const plug = savedPlug();
    expect(usePlugStore.getState().upsert(plug).ok).toBe(true);
    const { result } = renderHook(() => usePlugManagementFlow());
    act(() => {
      expect(result.current.setShellyDeviceName(plug.id, 'Heater')).toMatchObject({
        ok: true
      });
    });
    expect(usePlugStore.getState().items[0]).toMatchObject({
      id: plug.id,
      baseUrl: plug.baseUrl,
      name: 'Heater',
      createdAtMs: plug.createdAtMs
    });
  });

  it('removes only local registry state when an unreferenced plug is removed', () => {
    const plug = savedPlug();
    expect(usePlugStore.getState().upsert(plug).ok).toBe(true);
    const { result } = renderHook(() => usePlugManagementFlow());
    act(() => {
      expect(result.current.removeShellyDevice(plug.id)).toEqual({
        ok: true,
        value: null
      });
    });
    expect(usePlugStore.getState().items).toEqual([]);
  });
});
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('docs/implementation/device-rule-decoupling-progress.md')
s = p.read_text()
marker = "## Remaining work and exact next step\n"
entry = """### Phase B3 plug-management foundation\n\nA dedicated `usePlugManagementFlow` now composes the independent plug/rule registries\nwith B1 runtime services. Registration uses stable Shelly identity plus switch\ncapability only; runtime state carries typed ownership, exact managed script ids and\nverified relay state. Direct ON/OFF and orphan-script deletion route through the\nfail-closed B1 services. Rename/remove operate on local registry state, and endpoint\nupdates re-register and require the same physical Shelly id. LAN scanning now accepts\na minimal saved-endpoint contract instead of the legacy draft-device type. Product\nUI/routing is not switched yet.\n\n"""
if entry not in s:
    s = s.replace(marker, entry + marker, 1)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts \
  apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.ts \
  apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.test.tsx \
  docs/implementation/device-rule-decoupling-progress.md

git diff --check
pnpm --dir apps/mobile exec vitest run \
  src/flows/devices/plugs/usePlugManagementFlow.test.tsx \
  src/flows/devices/plugs/runtime.test.ts \
  src/flows/registry/devicesAndRules.test.ts \
  src/flows/hardware-setup/useShellySetupScanFlow.test.ts
pnpm quality:repo
pnpm typecheck

git add \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts \
  apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.ts \
  apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.test.tsx \
  docs/implementation/device-rule-decoupling-progress.md
git commit -m 'Add independent plug management flow'
git push origin HEAD:"$BRANCH"

echo "PLUG_MANAGEMENT_HEAD=$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"

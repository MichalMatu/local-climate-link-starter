#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
BASE_HEAD='65b0f6f2c425f6e98b0ae7ad76e0563d51f0da8d'

git fetch --prune origin "$BRANCH" agent-control
test -z "$(git status --porcelain)"
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE_HEAD"

git show origin/agent-control:.agent/scripts/20260913-plug-management-foundation.sh > /tmp/lcl-plug-management-foundation-base.sh
python3 - <<'PY'
from pathlib import Path
src = Path('/tmp/lcl-plug-management-foundation-base.sh').read_text()

old = "  const registries = actual.createDeviceRuleRegistries(null);\n"
new = """  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    }
  };
  const registries = actual.createDeviceRuleRegistries(storage);
"""
if old not in src:
    raise SystemExit('registry fixture anchor missing')
src = src.replace(old, new, 1)

old = "import { act, renderHook } from '@testing-library/react';\n"
new = """import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
"""
if old not in src:
    raise SystemExit('test import anchor missing')
src = src.replace(old, new, 1)

old = "const savedPlug = () => {\n"
new = """const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const savedPlug = () => {
"""
if old not in src:
    raise SystemExit('wrapper anchor missing')
src = src.replace(old, new, 1)
src = src.replace(
    'const { result } = renderHook(() => usePlugManagementFlow());',
    'const { result } = renderHook(() => usePlugManagementFlow(), { wrapper: createWrapper() });'
)

old = """  const applyRuntimeResult = (
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
"""
new = """  const applyRuntimeResult = (
    plug: SavedPlug,
    action: PlugManagementAction,
    result: PlugRuntimeResult<PlugRuntimeSnapshot>
  ) => {
    setRuntimeStates((current) => {
      const previous = current[plug.id] ?? initialRuntimeState();
      return {
        ...current,
        [plug.id]: {
          ...previous,
          snapshot: result.ok ? result.value : previous.snapshot,
          pendingAction: null,
          error: result.ok ? null : result.error,
          updatedAtMs: Date.now()
        }
      };
    });
    return { action, plug, result };
  };
"""
if old not in src:
    raise SystemExit('runtime state anchor missing')
src = src.replace(old, new, 1)

Path('/tmp/lcl-plug-management-foundation-v3-inner.sh').write_text(src)
PY
bash /tmp/lcl-plug-management-foundation-v3-inner.sh

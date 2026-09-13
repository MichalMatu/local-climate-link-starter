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
p = Path('/tmp/lcl-plug-management-foundation-base.sh')
s = p.read_text()
s = s.replace(
"""  const registries = actual.createDeviceRuleRegistries(null);
""",
"""  const values = new Map<string, string>();
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
""",
1,
)
s = s.replace(
"import { act, renderHook } from '@testing-library/react';\\n",
"import { QueryClient, QueryClientProvider } from '@tanstack/react-query';\\nimport { act, renderHook } from '@testing-library/react';\\nimport type { PropsWithChildren } from 'react';\\n",
1,
)
s = s.replace(
"""const savedPlug = () => {
""",
"""const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const savedPlug = () => {
""",
1,
)
s = s.replace(
"const { result } = renderHook(() => usePlugManagementFlow());",
"const { result } = renderHook(() => usePlugManagementFlow(), { wrapper: createWrapper() });"
)
s = s.replace(
"""  const applyRuntimeResult = (
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
""",
"""  const applyRuntimeResult = (
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
""",
1,
)
Path('/tmp/lcl-plug-management-foundation-v2-inner.sh').write_text(s)
PY
bash /tmp/lcl-plug-management-foundation-v2-inner.sh

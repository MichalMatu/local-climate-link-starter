#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
BASE_HEAD='65b0f6f2c425f6e98b0ae7ad76e0563d51f0da8d'

git fetch --prune origin "$BRANCH" agent-control
test "$(git rev-parse HEAD)" = "$BASE_HEAD"
test "$(git rev-parse origin/$BRANCH)" = "$BASE_HEAD"

EXPECTED_STATUS=$' M apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts\n M docs/implementation/device-rule-decoupling-progress.md\n?? apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.test.tsx\n?? apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.ts'
test "$(git status --porcelain)" = "$EXPECTED_STATUS"

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.test.tsx')
s = p.read_text()
s = s.replace(
"import { act, renderHook } from '@testing-library/react';\n",
"import { QueryClient, QueryClientProvider } from '@tanstack/react-query';\nimport { act, renderHook } from '@testing-library/react';\nimport type { PropsWithChildren } from 'react';\n",
1,
)
anchor = """const savedPlug = () => {
"""
insert = """const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

"""
if anchor not in s:
    raise SystemExit('test wrapper anchor missing')
s = s.replace(anchor, insert + anchor, 1)
s = s.replace(
"const { result } = renderHook(() => usePlugManagementFlow());",
"const { result } = renderHook(() => usePlugManagementFlow(), { wrapper: createWrapper() });"
)
p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.test.tsx

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

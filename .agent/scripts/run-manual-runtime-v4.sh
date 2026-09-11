#!/bin/sh
set -e
BASE=377b7bf7a2bca37ab4371b42be82136c2b2aaf13
git fetch --prune origin
git checkout -B work/manual-runtime-mode-20260911 origin/work/manual-runtime-mode-20260911
git reset --hard "$BASE"
git clean -fd
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

git show origin/agent-control:.agent/scripts/implement-manual-runtime-mode-v2.py > /tmp/manual-v2.py
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/manual-v2.py')
s=p.read_text().replace('replace(detail, "automationMutation.isPending", "automationAction.isPending", count=6)','replace(detail, "automationMutation.isPending", "automationAction.isPending", count=5)')
p.write_text(s)
PY
python3 /tmp/manual-v2.py

git show origin/agent-control:.agent/scripts/fix-manual-runtime-v4.py > /tmp/manual-v4.py
python3 /tmp/manual-v4.py

pnpm exec prettier --write \
  packages/script-generator/src/shelly/config.ts \
  packages/script-generator/src/shelly/generate.ts \
  packages/script-generator/src/__tests__/manual-runtime.test.ts \
  apps/mobile/src/flows/hardware-setup/schemas.ts \
  apps/mobile/src/flows/installations/relaySafety.ts \
  apps/mobile/src/flows/installations/runtimeModeTransport.ts \
  apps/mobile/src/flows/installations/runtimeModeTransport.test.ts \
  apps/mobile/src/flows/installations/runtimeStatus.ts \
  apps/mobile/src/flows/installations/runtimeStatus.test.ts \
  apps/mobile/src/flows/installations/runtimeUpgrade.ts \
  apps/mobile/src/flows/installations/runtimeControl.ts \
  apps/mobile/src/flows/installations/runtimeControl.test.ts \
  apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts \
  apps/mobile/src/flows/installations/healthRecovery.ts \
  apps/mobile/src/flows/installations/healthRecovery.test.ts \
  apps/mobile/src/screens/AutomationDashboardScreen.tsx \
  apps/mobile/src/screens/InstallationDetailScreen.tsx \
  docs/architecture/runtime-control.md \
  docs/architecture/refactor-boundaries.md \
  docs/HANDOFF_NEXT_CHAT.md

git diff --check
pnpm --filter @lcl/script-generator test -- manual-runtime.test.ts runtime-matrix.test.ts
pnpm --filter @lcl/mobile test -- runtimeModeTransport.test.ts runtimeStatus.test.ts runtimeControl.test.ts healthRecovery.test.ts automation-dashboard-controls.test.tsx automation-detail.test.tsx
pnpm --filter @lcl/script-generator typecheck
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/script-generator exec vitest run -u src/__tests__/generator.test.ts
pnpm --filter @lcl/script-generator test -- generator.test.ts manual-runtime.test.ts runtime-matrix.test.ts
git diff --check

git add \
  packages/script-generator/src/shelly/config.ts \
  packages/script-generator/src/shelly/generate.ts \
  packages/script-generator/src/__tests__/manual-runtime.test.ts \
  packages/script-generator/src/__tests__/__snapshots__/generator.test.ts.snap \
  apps/mobile/src/flows/hardware-setup/schemas.ts \
  apps/mobile/src/flows/installations/relaySafety.ts \
  apps/mobile/src/flows/installations/runtimeModeTransport.ts \
  apps/mobile/src/flows/installations/runtimeModeTransport.test.ts \
  apps/mobile/src/flows/installations/runtimeStatus.ts \
  apps/mobile/src/flows/installations/runtimeStatus.test.ts \
  apps/mobile/src/flows/installations/runtimeUpgrade.ts \
  apps/mobile/src/flows/installations/runtimeControl.ts \
  apps/mobile/src/flows/installations/runtimeControl.test.ts \
  apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts \
  apps/mobile/src/flows/installations/healthRecovery.ts \
  apps/mobile/src/flows/installations/healthRecovery.test.ts \
  apps/mobile/src/screens/AutomationDashboardScreen.tsx \
  apps/mobile/src/screens/InstallationDetailScreen.tsx \
  docs/architecture/runtime-control.md \
  docs/architecture/refactor-boundaries.md \
  docs/HANDOFF_NEXT_CHAT.md

git commit -m "feat(climate): keep telemetry live in manual mode"
git push -u origin HEAD:work/manual-runtime-mode-20260911
git fetch origin
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/work/manual-runtime-mode-20260911)"
test -z "$(git status --porcelain)"
echo MANUAL_RUNTIME_V4_SHA=$(git rev-parse HEAD)

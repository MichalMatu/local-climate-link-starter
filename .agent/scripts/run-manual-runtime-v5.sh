#!/bin/sh
set -eu
BASE=377b7bf7a2bca37ab4371b42be82136c2b2aaf13
BRANCH=work/manual-runtime-mode-20260911

git fetch --prune origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "$BASE"
git clean -fd
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

# Build the candidate deterministically from the clean final baseline.
git show origin/agent-control:.agent/scripts/implement-manual-runtime-mode-v2.py \
  | sed 's/replace(detail, "automationMutation.isPending", "automationAction.isPending", count=6)/replace(detail, "automationMutation.isPending", "automationAction.isPending", count=5)/' \
  > /tmp/manual-v2.py
python3 /tmp/manual-v2.py
git show origin/agent-control:.agent/scripts/fix-manual-runtime-v4.py > /tmp/manual-v4.py
python3 /tmp/manual-v4.py
git show origin/agent-control:.agent/scripts/fix-manual-runtime-v5.py > /tmp/manual-v5.py
python3 /tmp/manual-v5.py

# Mode is no longer duplicated into diagnostics; restore the baseline telemetry schema.
git checkout "$BASE" -- apps/mobile/src/flows/hardware-setup/schemas.ts

python3 - <<'PY'
from pathlib import Path
p=Path('docs/architecture/runtime-control.md')
s=p.read_text()
s=s.replace(
    'The diagnostic payload exposes compact `md: 0 | 1`. Older runtimes omit `md`; the app treats those as upgradeable rather than inventing a manual state.',
    'Runtime mode is read with `Script.Eval` from compact runtime state `R.m`. Older runtimes do not define `R.m`; the app treats those as upgradeable rather than inventing a manual state. `/diag` stays telemetry-only.'
)
s=s.replace('`R.md = 1`', '`R.m = 1`').replace('`R.md = 0`', '`R.m = 0`')
p.write_text(s)
PY

pnpm exec prettier --write \
  packages/script-generator/src/shelly/config.ts \
  packages/script-generator/src/shelly/generate.ts \
  packages/script-generator/src/__tests__/manual-runtime.test.ts \
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

# Stabilize runtime semantics and byte budget before accepting snapshot changes.
pnpm --filter @lcl/script-generator test -- manual-runtime.test.ts runtime-matrix.test.ts
pnpm --filter @lcl/script-generator exec vitest run generator.test.ts -u

pnpm --filter @lcl/mobile test -- \
  runtimeModeTransport.test.ts \
  runtimeStatus.test.ts \
  runtimeControl.test.ts \
  healthRecovery.test.ts \
  runtimeDiagnostics.test.ts \
  automation-dashboard-controls.test.tsx \
  automation-detail.test.tsx

pnpm --filter @lcl/script-generator typecheck
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile lint
pnpm quality:repo
pnpm quality:ux

git diff --check
git status --short
git add -A
git commit -m "feat(climate): keep telemetry live in manual mode"
git push -u origin HEAD:"$BRANCH"
echo MANUAL_RUNTIME_V5_SHA=$(git rev-parse HEAD)

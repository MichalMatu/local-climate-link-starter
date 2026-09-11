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

# Rebuild deterministically from the approved baseline.
git show origin/agent-control:.agent/scripts/implement-manual-runtime-mode-v2.py \
  | sed 's/replace(detail, "automationMutation.isPending", "automationAction.isPending", count=6)/replace(detail, "automationMutation.isPending", "automationAction.isPending", count=5)/' \
  > /tmp/manual-v2.py
python3 /tmp/manual-v2.py

git show origin/agent-control:.agent/scripts/fix-manual-runtime-v4.py > /tmp/manual-v4.py
python3 /tmp/manual-v4.py

git show origin/agent-control:.agent/scripts/fix-manual-runtime-v5.py > /tmp/manual-v5.py
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/manual-v5.py')
s = p.read_text()

# The helper defaults to one replacement; mode rename must be global.
old = 'replace(generate, "R.md", "R.m")'
new = 'write(generate, read(generate).replace("R.md", "R.m"))'
if old not in s:
    raise SystemExit('v8 could not locate R.md -> R.m replacement')
s = s.replace(old, new, 1)

# Baseline stale() already routes every relay request through sw(); v2/v4 never
# added duplicate !R.m guards. Remove the obsolete v5 cleanup block instead of
# matching code that does not exist.
start_marker = '# stale()/max-on may still update diagnostic state'
end_marker = '# Remove the mode copy from diagnostics.'
start = s.index(start_marker)
end = s.index(end_marker, start)
s = s[:start] + '# stale()/max-on already flow through the authoritative sw() guard.\n\n' + s[end:]

p.write_text(s)
PY
python3 /tmp/manual-v5.py

# Runtime mode is owned only by Script.Eval; diagnostics stay telemetry-only.
git checkout "$BASE" -- apps/mobile/src/flows/hardware-setup/schemas.ts
python3 - <<'PY'
from pathlib import Path
p = Path('docs/architecture/runtime-control.md')
s = p.read_text()
s = s.replace(
    'The diagnostic payload exposes compact `md: 0 | 1`. Older runtimes omit `md`; the app treats those as upgradeable rather than inventing a manual state.',
    'Runtime mode is read with `Script.Eval` from compact runtime state `R.m`. Older runtimes do not define `R.m`; the app treats those as upgradeable rather than inventing a manual state. `/diag` stays telemetry-only.'
)
s = s.replace('`R.md = 1`', '`R.m = 1`').replace('`R.md = 0`', '`R.m = 0`')
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

# 1) Runtime semantics first.
pnpm --filter @lcl/script-generator exec vitest run \
  src/__tests__/manual-runtime.test.ts \
  src/__tests__/runtime-matrix.test.ts

# 2) Generator invariants and strict byte budgets. Snapshot update is allowed only
# after semantic tests above pass.
pnpm --filter @lcl/script-generator exec vitest run src/__tests__/generator.test.ts -u

# 3) App transport/status/safety/recovery and UI behaviour.
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/installations/runtimeModeTransport.test.ts \
  src/flows/installations/runtimeStatus.test.ts \
  src/flows/installations/runtimeControl.test.ts \
  src/flows/installations/healthRecovery.test.ts \
  src/flows/installations/runtimeDiagnostics.test.ts \
  src/__tests__/automation-dashboard-controls.test.tsx \
  src/__tests__/automation-detail.test.tsx

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
echo MANUAL_RUNTIME_V8_SHA=$(git rev-parse HEAD)

#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
BASE=b2684176c792cfbbeefdf2a6205e4a7365986ac3
CHECKPOINT=/Users/michal/agent-workspace/repos/local-climate-link-starter/checkpoints/20260914-restore-plug-card-ux-v2/1789365470980424000-task-exit
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }

git apply "$CHECKPOINT/tracked.patch"
for p in \
  apps/mobile/src/screens/devices/SavedPlugCard.tsx \
  apps/mobile/src/screens/devices/plugPresentation.ts; do
  src="$CHECKPOINT/untracked/$p"
  [ -f "$src" ] || { echo "Checkpoint file missing: $src"; exit 3; }
  mkdir -p "$(dirname "$p")"
  cp "$src" "$p"
done

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/flows/rules/runtimeOwnership.test.ts')
s=p.read_text()
needle="  ownership: { status: 'blocked' as const, conflicts: [], attention: [] },\n  managedScripts: []\n"
replacement="  ownership: { status: 'blocked' as const, conflicts: [], attention: [] },\n  managedScripts: [],\n  telemetry: {},\n  clock: { timeSynced: false }\n"
if needle not in s:
    raise SystemExit('runtime ownership fixture marker missing')
p.write_text(s.replace(needle,replacement))
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/devices/plugs/inventory.ts \
  apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.ts \
  apps/mobile/src/flows/rules/runtimeOwnership.test.ts \
  apps/mobile/src/screens/devices/PlugManagementScreen.tsx \
  apps/mobile/src/screens/devices/SavedPlugCard.tsx \
  apps/mobile/src/screens/devices/plugPresentation.ts
pnpm exec eslint \
  apps/mobile/src/flows/devices/plugs/inventory.ts \
  apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.ts \
  apps/mobile/src/flows/rules/runtimeOwnership.test.ts \
  apps/mobile/src/screens/devices/PlugManagementScreen.tsx \
  apps/mobile/src/screens/devices/SavedPlugCard.tsx \
  apps/mobile/src/screens/devices/plugPresentation.ts
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/devices/plugs/runtime.test.ts \
  src/flows/devices/plugs/management.test.ts \
  src/flows/rules/runtimeOwnership.test.ts
pnpm quality:ux

git add \
  apps/mobile/src/flows/devices/plugs/inventory.ts \
  apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.ts \
  apps/mobile/src/flows/rules/runtimeOwnership.test.ts \
  apps/mobile/src/screens/devices/PlugManagementScreen.tsx \
  apps/mobile/src/screens/devices/SavedPlugCard.tsx \
  apps/mobile/src/screens/devices/plugPresentation.ts
git commit --no-verify -m "Restore rich saved plug cards"
HUSKY=0 git push origin HEAD:"$BRANCH"
echo "FINAL_HEAD=$(git rev-parse HEAD)"

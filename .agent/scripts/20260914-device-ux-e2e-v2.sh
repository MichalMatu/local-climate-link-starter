#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
BASE=193d2dc134a0faafa2919a863a479e3c87182c3c
CHECKPOINT=/Users/michal/agent-workspace/repos/local-climate-link-starter/checkpoints/20260914-device-ux-e2e-v1/1789366221542207000-task-exit
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }

src="$CHECKPOINT/untracked/apps/mobile/e2e/device-ux.spec.ts"
[ -f "$src" ] || { echo "Checkpoint E2E file missing"; exit 3; }
cp "$src" apps/mobile/e2e/device-ux.spec.ts
python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/e2e/device-ux.spec.ts')
s=p.read_text()
s=s.replace("dialog.getByRole('button', { name: 'ON' })", "dialog.getByRole('button', { name: 'ON', exact: true })")
s=s.replace("dialog.getByRole('button', { name: 'OFF' })", "dialog.getByRole('button', { name: 'OFF', exact: true })")
p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/e2e/device-ux.spec.ts
pnpm --filter @lcl/mobile typecheck
pnpm exec playwright test -c apps/mobile/playwright.config.ts apps/mobile/e2e/device-ux.spec.ts --workers=1

git add apps/mobile/e2e/device-ux.spec.ts
git commit --no-verify -m "Add device UX regression E2E"
HUSKY=0 git push origin HEAD:"$BRANCH"
echo "FINAL_HEAD=$(git rev-parse HEAD)"

#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='ac1d2c900467be4330a09567f286a6c364072c9a'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

# Reuse all reviewed Stage 8A3 transformations, stopping before verification/commit.
git show origin/agent-control:.agent/scripts/stage8a3-repair-quality-baseline-20260912.sh \
  | sed '/^pnpm exec prettier --write apps\/mobile\/e2e\/responsive.spec.ts README.md$/,$d' \
  > /tmp/lcl-stage8a3-transform-only.sh
bash /tmp/lcl-stage8a3-transform-only.sh

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/e2e/responsive.spec.ts')
s = p.read_text()

# Stage 8A2 introduced a wheel-picker helper, but after correcting the installed-detail
# flow in Stage 8A3 there are intentionally no call sites. Remove the dead test helper.
start = s.index('const setWheelTime = async (')
end = s.index('const expectScriptPreviewFillsModalBody', start)
s = s[:start] + s[end:]
assert 'setWheelTime' not in s
p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/e2e/responsive.spec.ts README.md
pnpm check:full

git diff --check
CHANGED="$(git status --short | awk '{print $2}' | sort | tr '\n' ' ')"
test "$CHANGED" = "README.md apps/mobile/e2e/responsive.spec.ts "

git add apps/mobile/e2e/responsive.spec.ts README.md
git commit -m 'Repair quality baseline after UX changes'
git push origin HEAD:"$BRANCH"

echo STAGE8A4_SHA=$(git rev-parse HEAD)
echo STAGE8A4_PARENT=$(git rev-parse HEAD^)
echo STAGE8A4_CHECK_FULL=1
test -z "$(git status --porcelain)"

#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='32e318484446bc34388e247b62be4639bf18d086'
HOOK='apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts'
PAGE='apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
rm -f "$HOOK"
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

# Reapply only the deterministic transformation from Stage 8C3.
git show origin/agent-control:.agent/scripts/stage8c3-extract-sensor-feedback-20260912.sh > /tmp/lcl-stage8c3-base.sh
sed '/^pnpm exec prettier --write/,$d' /tmp/lcl-stage8c3-base.sh > /tmp/lcl-stage8c3-transform.sh
# The extracted script contains its own clean-base preamble; the workspace is clean here.
bash /tmp/lcl-stage8c3-transform.sh

# Stage 8C3 moved mutationError usage into the extracted hook, so the page import is obsolete.
python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s = p.read_text()
s = s.replace("import { mutationError } from '../helpers.js';\n", "")
p.write_text(s)
PY

pnpm exec prettier --write "$HOOK" "$PAGE"
pnpm --dir apps/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm check
LCL_E2E_PORT=5194 pnpm e2e:responsive

git diff --check
LINES=$(wc -l < "$PAGE" | tr -d ' ')
HOOK_LINES=$(wc -l < "$HOOK" | tr -d ' ')
echo SENSOR_SETUP_PAGE_LINES="$LINES"
echo SENSOR_SETUP_FEEDBACK_LINES="$HOOK_LINES"
test "$LINES" -lt 620

git add "$HOOK" "$PAGE"
git commit -m 'Extract sensor setup feedback orchestration'
git push origin HEAD:"$BRANCH"

echo STAGE8C3R_SHA=$(git rev-parse HEAD)
echo STAGE8C3R_PARENT=$(git rev-parse HEAD^)
echo STAGE8C3R_CHECK=1
echo STAGE8C3R_E2E=1
echo STAGE8C3R_PAGE_LINES="$LINES"
echo STAGE8C3R_HOOK_LINES="$HOOK_LINES"
test -z "$(git status --porcelain)"

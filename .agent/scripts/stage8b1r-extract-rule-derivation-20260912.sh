#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='4b8d309bd5db225c69931ccef0ab7ca613888993'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

# Reuse the reviewed Stage 8B1 transformation, stopping before verification/commit.
git show origin/agent-control:.agent/scripts/stage8b1-extract-rule-derivation-20260912.sh \
  | sed '/^pnpm --dir apps\/mobile exec vitest run/,$d' > /tmp/lcl-stage8b1-transform-only.sh
bash /tmp/lcl-stage8b1-transform-only.sh

# Extraction makes SensorDraftDevice unused in the orchestration hook; keep the import surface exact.
python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s = p.read_text()
old = """import {
  useHardwareSetupDraftStore,
  type SensorDraftDevice,
  type ShellyDraftDevice
} from './setupDraftStore.js';"""
new = """import {
  useHardwareSetupDraftStore,
  type ShellyDraftDevice
} from './setupDraftStore.js';"""
assert old in s
p.write_text(s.replace(old, new, 1))
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.ts \
  apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts

pnpm --dir apps/mobile exec vitest run src/flows/hardware-setup/ruleConfigDerivation.test.ts
pnpm check:full

git diff --check
LINES=$(wc -l < apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts | tr -d ' ')
echo HARDWARE_FLOW_LINES="$LINES"
test "$LINES" -lt 930

git add \
  apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.ts \
  apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
git commit -m 'Extract hardware setup rule derivation'
git push origin HEAD:"$BRANCH"

echo STAGE8B1R_SHA=$(git rev-parse HEAD)
echo STAGE8B1R_PARENT=$(git rev-parse HEAD^)
echo STAGE8B1R_CHECK_FULL=1
echo STAGE8B1R_FLOW_LINES="$LINES"
test -z "$(git status --porcelain)"

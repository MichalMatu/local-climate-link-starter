#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='cef168d769eb94e8688bd53a19bea7d2e8b81888'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

# Reapply the already-reviewed Stage 8B2 transform, but stop before its verification/commit block.
git show origin/agent-control:.agent/scripts/stage8b2-extract-shelly-scan-flow-20260912.sh \
  | sed '/^pnpm --dir apps\/mobile exec vitest run/,$d' \
  > /tmp/lcl-stage8b2-transform-only.sh
bash /tmp/lcl-stage8b2-transform-only.sh

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts

pnpm --dir apps/mobile exec vitest run src/flows/hardware-setup/useShellySetupScanFlow.test.ts
pnpm check
# The previous retry reached E2E but Playwright's webServer timed out on the default port.
# Use a fresh deterministic port to avoid a stale local Vite listener without changing app code.
LCL_E2E_PORT=5187 pnpm e2e:responsive

git diff --check
LINES=$(wc -l < apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts | tr -d ' ')
echo HARDWARE_FLOW_LINES="$LINES"
test "$LINES" -lt 830

git add \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
git commit -m 'Extract Shelly setup scan flow'
git push origin HEAD:"$BRANCH"

echo STAGE8B2R2_SHA=$(git rev-parse HEAD)
echo STAGE8B2R2_PARENT=$(git rev-parse HEAD^)
echo STAGE8B2R2_CHECK=1
echo STAGE8B2R2_E2E=1
echo STAGE8B2R2_FLOW_LINES="$LINES"
test -z "$(git status --porcelain)"

#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='0a1452c2a082deda381333645b34818210bad144'

git fetch --prune origin "$BRANCH" main agent-control

if [ -n "$(git status --porcelain)" ]; then
  echo 'ERROR: working tree is not clean; refusing to switch branches.' >&2
  git status --short >&2
  exit 20
fi

git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

echo "BASELINE_HEAD=$(git rev-parse HEAD)"
echo "MAIN_HEAD=$(git rev-parse origin/main)"
echo "MERGE_BASE=$(git merge-base origin/main HEAD)"

git diff --check origin/main...HEAD
pnpm --dir apps/mobile exec vitest run \
  src/flows/registry/devicesAndRules.test.ts \
  src/flows/rules/ownership.test.ts \
  src/flows/devices/plugs/runtime.test.ts \
  src/flows/time-automation/runtime.test.ts
pnpm --dir packages/shelly-client exec vitest run src/__tests__/inventory.test.ts
pnpm check:full

test -z "$(git status --porcelain)"
echo 'DEVICE_RULE_B1_BASELINE_OK=1'

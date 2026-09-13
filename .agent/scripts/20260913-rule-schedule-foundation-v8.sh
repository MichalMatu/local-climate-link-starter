#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='70c8fb0e989200479a05e57516ad12fbe763b8d5'
git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

git show origin/agent-control:.agent/scripts/20260913-rule-schedule-foundation-v7.sh > /tmp/lcl-rule-schedule-v7.sh
set +e
bash /tmp/lcl-rule-schedule-v7.sh
BASE_STATUS=$?
set -e
test "$BASE_STATUS" -ne 0
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/flows/rules/ownership.test.ts')
s = p.read_text()
s = s.replace('{ id: 8, enable: true, ...expectedTime.on }', '{ id: 8, ...expectedTime.on }')
s = s.replace('{ id: 9, enable: true, ...expectedTime.off }', '{ id: 9, ...expectedTime.off }')
s = s.replace('{ id: pair.onJobId, enable: true, ...expected.on }', '{ id: pair.onJobId, ...expected.on }')
s = s.replace('{ id: pair.offJobId, enable: true, ...expected.off }', '{ id: pair.offJobId, ...expected.off }')
p.write_text(s)
PY
pnpm exec prettier --write apps/mobile/src/flows/rules/ownership.test.ts

pnpm --filter @lcl/automation-core typecheck
pnpm --filter @lcl/script-generator typecheck
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/automation-core test
pnpm --filter @lcl/script-generator test
pnpm --filter @lcl/mobile test
pnpm quality:repo

git diff --check
git status --short
git diff --stat

git add \
  packages/automation-core/src/schedule.ts \
  packages/automation-core/src/__tests__/schedule.test.ts \
  packages/automation-core/src/index.ts \
  apps/mobile/src/flows/rules/model.ts \
  apps/mobile/src/flows/rules/selectors.ts \
  apps/mobile/src/flows/rules/store.ts \
  apps/mobile/src/flows/rules/timeSchedule.ts \
  apps/mobile/src/flows/rules/timeSchedule.test.ts \
  apps/mobile/src/flows/rules/ownership.ts \
  apps/mobile/src/flows/rules/ownership.test.ts \
  apps/mobile/src/flows/devices/plugs/runtime.test.ts \
  apps/mobile/src/flows/registry/fixtures.test-support.ts \
  apps/mobile/src/flows/registry/devicesAndRules.test.ts \
  packages/script-generator/src/shelly/config.ts \
  packages/script-generator/src/shelly/generate.ts \
  packages/script-generator/src/__tests__/schedule.test.ts \
  packages/script-generator/src/__tests__/__snapshots__/generator.test.ts.snap \
  docs/implementation/device-rule-decoupling-plan.md

git commit -m 'Add target rule schedule model'
printf 'FINAL_HEAD=%s\n' "$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"

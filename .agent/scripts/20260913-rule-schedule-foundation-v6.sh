#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='70c8fb0e989200479a05e57516ad12fbe763b8d5'
git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

git show origin/agent-control:.agent/scripts/20260913-rule-schedule-foundation-v5.sh > /tmp/lcl-rule-schedule-v5.sh
set +e
bash /tmp/lcl-rule-schedule-v5.sh
BASE_STATUS=$?
set -e
test "$BASE_STATUS" -ne 0
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

python3 - <<'PY'
from pathlib import Path
p = Path('packages/automation-core/src/schedule.ts')
s = p.read_text()
old = "windowKey(window) !== windowKey(windows[index - 1])"
new = "windowKey(window) !== windowKey(windows[index - 1]!)"
assert old in s
p.write_text(s.replace(old, new))
PY
pnpm exec prettier --write packages/automation-core/src/schedule.ts

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

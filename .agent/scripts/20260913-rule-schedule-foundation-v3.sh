#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='70c8fb0e989200479a05e57516ad12fbe763b8d5'

git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

git show origin/agent-control:.agent/scripts/20260913-rule-schedule-foundation-v2.sh > /tmp/lcl-rule-schedule-foundation-v2.sh
set +e
bash /tmp/lcl-rule-schedule-foundation-v2.sh
BASE_STATUS=$?
set -e
test "$BASE_STATUS" -ne 0
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

python3 - <<'PY'
from pathlib import Path

p = Path('apps/mobile/src/flows/rules/ownership.test.ts')
s = p.read_text()
old = "const timeDeployed = { ...time, deployment: { onJobId: 8, offJobId: 9 } };\nconst jobs = [\n  { id: 8, ...createDailyScheduleJob({ ...time.config, relayId: 0 }, true) },\n  { id: 9, ...createDailyScheduleJob({ ...time.config, relayId: 0 }, false) }\n];"
new = "const timeDeployed = { ...time, deployment: { onJobId: 8, offJobId: 9 } };\nconst legacyDailyConfig = { relayId: 0, onTime: '08:00', offTime: '20:00' };\nconst jobs = [\n  { id: 8, ...createDailyScheduleJob(legacyDailyConfig, true) },\n  { id: 9, ...createDailyScheduleJob(legacyDailyConfig, false) }\n];"
assert s.count(old) == 1
s = s.replace(old, new)
old = "{ id: 1, ...createDailyScheduleJob({ ...time.config, relayId: 1 }, true) }"
new = "{ id: 1, ...createDailyScheduleJob({ ...legacyDailyConfig, relayId: 1 }, true) }"
assert s.count(old) == 1
p.write_text(s.replace(old, new))

p = Path('apps/mobile/src/flows/devices/plugs/runtime.test.ts')
s = p.read_text()
old = "    setJobs([\n      { id: 11, ...createDailyScheduleJob({ ...time.config, relayId: 0 }, true) }\n    ]);"
new = "    setJobs([\n      {\n        id: 11,\n        ...createDailyScheduleJob(\n          { relayId: 0, onTime: '08:00', offTime: '20:00' },\n          true\n        )\n      }\n    ]);"
assert s.count(old) == 1
p.write_text(s.replace(old, new))
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/rules/ownership.test.ts \
  apps/mobile/src/flows/devices/plugs/runtime.test.ts

pnpm --filter @lcl/automation-core test
pnpm --filter @lcl/script-generator test
pnpm --filter @lcl/mobile test
pnpm --filter @lcl/mobile typecheck
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
  apps/mobile/src/flows/rules/ownership.test.ts \
  apps/mobile/src/flows/devices/plugs/runtime.test.ts \
  apps/mobile/src/flows/registry/fixtures.test-support.ts \
  apps/mobile/src/flows/registry/devicesAndRules.test.ts \
  packages/script-generator/src/shelly/config.ts \
  packages/script-generator/src/shelly/generate.ts \
  packages/script-generator/src/__tests__/schedule.test.ts \
  packages/script-generator/src/__tests__/__snapshots__/generator.test.ts.snap

git commit -m 'Add rule schedule foundation'
printf 'FINAL_HEAD=%s\n' "$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"

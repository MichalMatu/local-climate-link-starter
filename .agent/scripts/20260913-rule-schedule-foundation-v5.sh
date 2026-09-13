#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='70c8fb0e989200479a05e57516ad12fbe763b8d5'

git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

git show origin/agent-control:.agent/scripts/20260913-rule-schedule-foundation-v4.sh > /tmp/lcl-rule-schedule-v4.sh
set +e
bash /tmp/lcl-rule-schedule-v4.sh
BASE_STATUS=$?
set -e
test "$BASE_STATUS" -ne 0
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

cat > packages/script-generator/src/__tests__/schedule.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  shellyThermostatConfigSchema
} from '../index.js';

describe('climate rule schedule generation', () => {
  it('embeds normalized time windows into the owned climate script', () => {
    const config = createDefaultShellyThermostatConfig();
    config.schedule = {
      windows: [{ days: [5, 1, 3], start: '22:00', end: '02:00' }]
    };

    const script = generateShellyThermostatScript(config);

    expect(script).toContain('"tw":[[[1,3,5],1320,120]]');
    expect(script).toContain('function aw()');
    expect(script).toContain('W<0?"nt":"tw"');
    expect(script).not.toContain('Schedule.Create');
    expect(() => new Function(script)).not.toThrow();
  });

  it('keeps unrestricted climate rules free of runtime schedule code', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());
    expect(script).not.toContain('"tw":');
    expect(script).not.toContain('function aw()');
  });

  it('rejects empty, duplicate-day and zero-length schedule windows', () => {
    const base = createDefaultShellyThermostatConfig();
    expect(
      shellyThermostatConfigSchema.safeParse({ ...base, schedule: { windows: [] } })
        .success
    ).toBe(false);
    expect(
      shellyThermostatConfigSchema.safeParse({
        ...base,
        schedule: { windows: [{ days: [1, 1], start: '08:00', end: '09:00' }] }
      }).success
    ).toBe(false);
    expect(
      shellyThermostatConfigSchema.safeParse({
        ...base,
        schedule: { windows: [{ days: [1], start: '08:00', end: '08:00' }] }
      }).success
    ).toBe(false);
  });
});
EOF

python3 - <<'PY'
from pathlib import Path

p = Path('apps/mobile/src/flows/rules/model.ts')
s = p.read_text()
s = s.replace(
"export const automationRuleSchema = z.discriminatedUnion('kind', [\n  climateRuleSchema,\n  timeRuleSchema\n]);",
"export const automationRuleSchema = z.union([climateRuleSchema, timeRuleSchema]);"
)
p.write_text(s)

p = Path('packages/script-generator/src/shelly/config.ts')
s = p.read_text()
old = "const generatorTimeWindowSchema = z\n  .object({\n    days: z\n      .array(z.number().int().min(0).max(6))"
new = "const generatorWeekdaySchema = z.union([\n  z.literal(0),\n  z.literal(1),\n  z.literal(2),\n  z.literal(3),\n  z.literal(4),\n  z.literal(5),\n  z.literal(6)\n]);\n\nconst generatorTimeWindowSchema = z\n  .object({\n    days: z\n      .array(generatorWeekdaySchema)"
assert old in s
p.write_text(s.replace(old, new))

p = Path('apps/mobile/src/flows/rules/timeSchedule.test.ts')
s = p.read_text()
s = s.replace(
"import { time } from '../registry/fixtures.test-support.js';\nimport { createRuleScheduleJob, expectedTimeRulePair, ruleScheduleJobMatches } from './timeSchedule.js';",
"import { time } from '../registry/fixtures.test-support.js';\nimport type { RuleTimeWindow } from './model.js';\nimport { createRuleScheduleJob, expectedTimeRulePair, ruleScheduleJobMatches } from './timeSchedule.js';"
)
s = s.replace(
"    const window = { days: [1, 3, 5] as const, start: '08:15', end: '20:45' };",
"    const window: RuleTimeWindow = { days: [1, 3, 5], start: '08:15', end: '20:45' };"
)
s = s.replace(
"    const window = { days: [5, 6] as const, start: '22:00', end: '02:00' };",
"    const window: RuleTimeWindow = { days: [5, 6], start: '22:00', end: '02:00' };"
)
p.write_text(s)

p = Path('apps/mobile/src/flows/rules/ownership.test.ts')
s = p.read_text().replace(" as const, start:", ", start:")
s = s.replace("    const multi = {", "    const multi: TimeRule = {")
s = s.replace("    } satisfies TimeRule;", "    };")
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/rules/model.ts \
  apps/mobile/src/flows/rules/timeSchedule.test.ts \
  apps/mobile/src/flows/rules/ownership.test.ts \
  packages/script-generator/src/shelly/config.ts \
  packages/script-generator/src/__tests__/schedule.test.ts

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

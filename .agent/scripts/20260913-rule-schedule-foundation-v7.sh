#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='70c8fb0e989200479a05e57516ad12fbe763b8d5'
git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

git show origin/agent-control:.agent/scripts/20260913-rule-schedule-foundation-v6.sh > /tmp/lcl-rule-schedule-v6.sh
set +e
bash /tmp/lcl-rule-schedule-v6.sh
BASE_STATUS=$?
set -e
test "$BASE_STATUS" -ne 0
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

cat > apps/mobile/src/flows/rules/timeSchedule.ts <<'EOF'
import { parseRuleClockMinutes, type Weekday } from '@lcl/automation-core';
import type { ShellyScheduleJob, ShellyScheduleJobConfig } from '@lcl/shelly-client';
import type { RuleTimeWindow, TimeRule } from './model.js';

const weekdayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

type RuleScheduleJobConfig = ShellyScheduleJobConfig & { enable: boolean };

const shiftWeekdays = (days: readonly Weekday[], offset: number): Weekday[] =>
  days
    .map((day) => ((day + offset + 7) % 7) as Weekday)
    .sort((left, right) => left - right);

const windowDaysForEdge = (
  window: RuleTimeWindow,
  edge: 'on' | 'off'
): Weekday[] => {
  const start = parseRuleClockMinutes(window.start);
  const end = parseRuleClockMinutes(window.end);
  if (start === null || end === null || start === end) {
    throw new Error('Validated rule schedule contains an invalid time window.');
  }
  return edge === 'off' && start > end ? shiftWeekdays(window.days, 1) : [...window.days];
};

const ruleWindowTimespec = (window: RuleTimeWindow, edge: 'on' | 'off'): string => {
  const time = edge === 'on' ? window.start : window.end;
  const minutes = parseRuleClockMinutes(time);
  if (minutes === null) throw new Error(`Invalid rule clock time: ${time}.`);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const days = windowDaysForEdge(window, edge).map((day) => weekdayNames[day]).join(',');
  return `0 ${minute} ${hour} * * ${days}`;
};

const switchScheduleCall = (relayId: number, on: boolean) => ({
  method: 'Switch.Set',
  params: { id: relayId, on }
});

export const createRuleScheduleJob = (
  window: RuleTimeWindow,
  relayId: number,
  edge: 'on' | 'off',
  enable = true
): RuleScheduleJobConfig => ({
  enable,
  timespec: ruleWindowTimespec(window, edge),
  calls: [switchScheduleCall(relayId, edge === 'on')]
});

export const ruleScheduleJobMatches = (
  job: ShellyScheduleJob | null,
  expected: ShellyScheduleJobConfig
): boolean => {
  if (!job || job.timespec !== expected.timespec || job.calls.length !== 1) return false;
  const actualCall = job.calls[0];
  const expectedCall = expected.calls[0];
  return Boolean(
    actualCall &&
      expectedCall &&
      actualCall.method === expectedCall.method &&
      JSON.stringify(actualCall.params ?? {}) === JSON.stringify(expectedCall.params ?? {})
  );
};

export const expectedTimeRulePair = (
  rule: TimeRule,
  windowIndex: number
): { on: RuleScheduleJobConfig; off: RuleScheduleJobConfig } => {
  const window = rule.config.schedule.windows[windowIndex];
  if (!window) throw new Error(`Missing time-rule window ${windowIndex}.`);
  return {
    on: createRuleScheduleJob(window, rule.relayId, 'on'),
    off: createRuleScheduleJob(window, rule.relayId, 'off')
  };
};
EOF

cat > apps/mobile/src/flows/rules/timeSchedule.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import { time } from '../registry/fixtures.test-support.js';
import type { RuleTimeWindow } from './model.js';
import {
  createRuleScheduleJob,
  expectedTimeRulePair,
  ruleScheduleJobMatches
} from './timeSchedule.js';

describe('time rule native schedule compiler', () => {
  it('compiles weekday windows to Shelly local-time cron jobs', () => {
    const window: RuleTimeWindow = { days: [1, 3, 5], start: '08:15', end: '20:45' };
    expect(createRuleScheduleJob(window, 0, 'on')).toMatchObject({
      timespec: '0 15 8 * * MON,WED,FRI',
      calls: [{ method: 'Switch.Set', params: { id: 0, on: true } }]
    });
    expect(createRuleScheduleJob(window, 0, 'off')).toMatchObject({
      timespec: '0 45 20 * * MON,WED,FRI',
      calls: [{ method: 'Switch.Set', params: { id: 0, on: false } }]
    });
  });

  it('shifts only the OFF weekdays for a cross-midnight window', () => {
    const window: RuleTimeWindow = { days: [5, 6], start: '22:00', end: '02:00' };
    expect(createRuleScheduleJob(window, 0, 'on').timespec).toBe(
      '0 0 22 * * FRI,SAT'
    );
    expect(createRuleScheduleJob(window, 0, 'off').timespec).toBe(
      '0 0 2 * * SUN,SAT'
    );
  });

  it('derives an exact pair for each normalized rule window and detects drift', () => {
    const expected = expectedTimeRulePair(time, 0);
    const on = { id: 8, ...expected.on };
    expect(ruleScheduleJobMatches(on, expected.on)).toBe(true);
    expect(ruleScheduleJobMatches({ ...on, timespec: 'changed' }, expected.on)).toBe(false);
  });
});
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/flows/rules/ownership.ts')
s = p.read_text()
old = '''          const issue = {
            kind: 'stale-deployment-metadata',
            ruleId: rule.id,
            remote: missing
              ? ('missing' as const)
              : presentCount < expectedCount
                ? ('partial' as const)
                : ('mismatch' as const)
          };'''
new = '''          const issue: Extract<RelayConflict, { kind: 'stale-deployment-metadata' }> = {
            kind: 'stale-deployment-metadata',
            ruleId: rule.id,
            remote: missing ? 'missing' : presentCount < expectedCount ? 'partial' : 'mismatch'
          };'''
assert old in s
p.write_text(s.replace(old, new))

p = Path('apps/mobile/src/flows/rules/ownership.test.ts')
s = p.read_text()
s = s.replace('    const schedules = multi.deployment.pairs.flatMap((pair) => {', '    const schedules = multi.deployment!.pairs.flatMap((pair) => {')
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/rules/timeSchedule.ts \
  apps/mobile/src/flows/rules/timeSchedule.test.ts \
  apps/mobile/src/flows/rules/ownership.ts \
  apps/mobile/src/flows/rules/ownership.test.ts

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

#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='70c8fb0e989200479a05e57516ad12fbe763b8d5'

git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

# Reuse only the deterministic write section from the first schedule task.
git show origin/agent-control:.agent/scripts/20260913-rule-schedule-foundation.sh > /tmp/lcl-rule-schedule-v1.sh
awk '/^pnpm --filter @lcl\/automation-core test/{exit} {print}' /tmp/lcl-rule-schedule-v1.sh > /tmp/lcl-rule-schedule-write.sh
bash /tmp/lcl-rule-schedule-write.sh

cat > apps/mobile/src/flows/rules/model.ts <<'EOF'
import { normalizeRuleSchedule } from '@lcl/automation-core';
import { climateSettingsSchema } from '@lcl/script-generator';
import { z } from 'zod';
import { plugIdSchema } from '../devices/plugs/model.js';

const clockTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const weekdaySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6)
]);

export const ruleTimeWindowSchema = z
  .object({
    days: z
      .array(weekdaySchema)
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length, 'Window days must be unique.'),
    start: z.string().regex(clockTimePattern),
    end: z.string().regex(clockTimePattern)
  })
  .strict()
  .refine((window) => window.start !== window.end, {
    message: 'Window start and end times must be different.',
    path: ['end']
  });

export const ruleScheduleSchema = z
  .object({ windows: z.array(ruleTimeWindowSchema).min(1).max(16) })
  .strict()
  .transform((schedule) => normalizeRuleSchedule(schedule));

const baseRuleSchema = z.object({
  version: z.literal(1),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  plugId: plugIdSchema,
  relayId: z.literal(0),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative()
});

const safetyTestSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }).strict(),
  z
    .object({ status: z.literal('failed'), failedAtMs: z.number().int().nonnegative() })
    .strict(),
  z
    .object({
      status: z.literal('verified'),
      verifiedAtMs: z.number().int().nonnegative()
    })
    .strict()
]);

const timeDeploymentPairSchema = z
  .object({
    windowIndex: z.number().int().nonnegative(),
    onJobId: z.number().int().nonnegative(),
    offJobId: z.number().int().nonnegative()
  })
  .strict()
  .refine((pair) => pair.onJobId !== pair.offJobId, {
    message: 'ON and OFF schedule job ids must differ.'
  });

export const climateRuleSchema = baseRuleSchema
  .extend({
    kind: z.literal('climate'),
    sensorId: z.string().trim().min(1),
    config: climateSettingsSchema,
    schedule: ruleScheduleSchema.nullable(),
    deployment: z
      .object({
        scriptId: z.number().int().nonnegative(),
        scriptHash: z.string().trim().min(1),
        safetyTest: safetyTestSchema
      })
      .strict()
      .nullable()
  })
  .strict();

export const timeRuleSchema = baseRuleSchema
  .extend({
    kind: z.literal('time'),
    config: z.object({ schedule: ruleScheduleSchema }).strict(),
    deployment: z
      .object({ pairs: z.array(timeDeploymentPairSchema).min(1).max(16) })
      .strict()
      .nullable()
  })
  .strict()
  .superRefine((rule, context) => {
    if (!rule.deployment) return;
    const expectedCount = rule.config.schedule.windows.length;
    const pairs = rule.deployment.pairs;
    if (pairs.length !== expectedCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deployment', 'pairs'],
        message: 'Deployment must contain one schedule pair per rule window.'
      });
    }
    const indexes = pairs.map((pair) => pair.windowIndex);
    if (
      new Set(indexes).size !== indexes.length ||
      indexes.some((index) => index >= expectedCount) ||
      !Array.from({ length: expectedCount }, (_, index) => index).every((index) =>
        indexes.includes(index)
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deployment', 'pairs'],
        message: 'Deployment window indexes must exactly cover the configured schedule.'
      });
    }
    const jobIds = pairs.flatMap((pair) => [pair.onJobId, pair.offJobId]);
    if (new Set(jobIds).size !== jobIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deployment', 'pairs'],
        message: 'Deployment schedule job ids must be unique.'
      });
    }
  });

export const automationRuleSchema = z.discriminatedUnion('kind', [
  climateRuleSchema,
  timeRuleSchema
]);
export type RuleTimeWindow = z.input<typeof ruleTimeWindowSchema>;
export type RuleSchedule = z.output<typeof ruleScheduleSchema>;
export type ClimateRule = z.infer<typeof climateRuleSchema>;
export type TimeRule = z.infer<typeof timeRuleSchema>;
export type AutomationRule = z.infer<typeof automationRuleSchema>;
EOF

cat > apps/mobile/src/flows/rules/timeSchedule.ts <<'EOF'
import { parseRuleClockMinutes, type Weekday } from '@lcl/automation-core';
import type { ShellyScheduleJob, ShellyScheduleJobConfig } from '@lcl/shelly-client';
import type { RuleTimeWindow, TimeRule } from './model.js';

const weekdayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

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
): ShellyScheduleJobConfig & { enable: boolean } => ({
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
): { on: ShellyScheduleJobConfig; off: ShellyScheduleJobConfig } => {
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
import { createRuleScheduleJob, expectedTimeRulePair, ruleScheduleJobMatches } from './timeSchedule.js';

describe('time rule native schedule compiler', () => {
  it('compiles weekday windows to Shelly local-time cron jobs', () => {
    const window = { days: [1, 3, 5] as const, start: '08:15', end: '20:45' };
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
    const window = { days: [5, 6] as const, start: '22:00', end: '02:00' };
    expect(createRuleScheduleJob(window, 0, 'on').timespec).toBe(
      '0 0 22 * * FRI,SAT'
    );
    expect(createRuleScheduleJob(window, 0, 'off').timespec).toBe(
      '0 0 2 * * SUN,SAT'
    );
  });

  it('derives an exact pair for each normalized rule window and detects drift', () => {
    const expected = expectedTimeRulePair(time, 0);
    const on = { id: 8, enable: true, ...expected.on };
    expect(ruleScheduleJobMatches(on, expected.on)).toBe(true);
    expect(ruleScheduleJobMatches({ ...on, timespec: 'changed' }, expected.on)).toBe(false);
  });
});
EOF

cat > apps/mobile/src/flows/rules/ownership.ts <<'EOF'
import {
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  type ShellyScheduleJob
} from '@lcl/shelly-client';
import { normalizePlugId, type SavedPlug } from '../devices/plugs/model.js';
import { scheduleJobControlsRelay } from '../time-automation/scheduleOwnership.js';
import type { AutomationRule } from './model.js';
import { expectedTimeRulePair, ruleScheduleJobMatches } from './timeSchedule.js';

export type LiveScript = { id: number; name: string; running: boolean };
export type RelayInventory =
  | { status: 'unavailable' }
  | {
      status: 'verified';
      plugId: string;
      baseUrl: string;
      scripts: readonly LiveScript[];
      schedules: readonly ShellyScheduleJob[];
    };

export type RelayConflict =
  | { kind: 'inventory-unavailable' }
  | { kind: 'saved-rule-owner'; ruleId: string }
  | { kind: 'owned-live-climate-script'; ruleId: string; scriptId: number }
  | { kind: 'orphan-managed-climate-script'; scriptId: number }
  | { kind: 'unmanaged-native-schedule'; jobId: number }
  | {
      kind: 'stale-deployment-metadata';
      ruleId: string;
      remote: 'missing' | 'mismatch' | 'partial';
    };

export type RelayOwnership = {
  status: 'no-conflict' | 'blocked';
  conflicts: RelayConflict[];
  attention: Extract<RelayConflict, { kind: 'stale-deployment-metadata' }>[];
};

export const resolveRelayOwnership = ({
  plug,
  relayId,
  rules,
  inventory,
  editingRuleId
}: {
  plug: SavedPlug;
  relayId: number;
  rules: readonly AutomationRule[];
  inventory: RelayInventory;
  editingRuleId?: string;
}): RelayOwnership => {
  const conflicts: RelayConflict[] = [];
  const attention: RelayOwnership['attention'] = [];
  const owners = rules.filter(
    (rule) => rule.plugId === plug.id && rule.relayId === relayId
  );
  if (
    inventory.status !== 'verified' ||
    normalizePlugId(inventory.plugId) !== plug.id ||
    inventory.baseUrl !== plug.baseUrl
  ) {
    return {
      status: 'blocked',
      conflicts: [
        { kind: 'inventory-unavailable' },
        ...owners
          .filter((rule) => rule.id !== editingRuleId)
          .map((rule) => ({ kind: 'saved-rule-owner' as const, ruleId: rule.id }))
      ],
      attention
    };
  }

  const managedScripts = inventory.scripts.filter(
    (script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME
  );
  const jobs = inventory.schedules.filter((job) => scheduleJobControlsRelay(job, relayId));
  const ownedJobIds = new Set<number>();

  for (const rule of owners) {
    let missing = false;
    if (rule.deployment !== null) {
      if (rule.kind === 'climate') {
        const script = inventory.scripts.find((item) => item.id === rule.deployment?.scriptId);
        missing = !script;
        if (!script || script.name !== LOCAL_CLIMATE_LINK_SCRIPT_NAME) {
          const issue = {
            kind: 'stale-deployment-metadata',
            ruleId: rule.id,
            remote: script ? 'mismatch' : 'missing'
          } as const;
          attention.push(issue);
          if (script) conflicts.push(issue);
        }
      } else {
        const pairs = rule.deployment.pairs;
        let presentCount = 0;
        let allMatch = true;
        for (const pair of pairs) {
          ownedJobIds.add(pair.onJobId);
          ownedJobIds.add(pair.offJobId);
          const onJob = inventory.schedules.find((job) => job.id === pair.onJobId) ?? null;
          const offJob = inventory.schedules.find((job) => job.id === pair.offJobId) ?? null;
          if (onJob) presentCount += 1;
          if (offJob) presentCount += 1;
          const expected = expectedTimeRulePair(rule, pair.windowIndex);
          if (
            !ruleScheduleJobMatches(onJob, expected.on) ||
            !ruleScheduleJobMatches(offJob, expected.off)
          ) {
            allMatch = false;
          }
        }
        const expectedCount = pairs.length * 2;
        missing = presentCount === 0;
        if (!allMatch) {
          const issue = {
            kind: 'stale-deployment-metadata',
            ruleId: rule.id,
            remote: missing
              ? ('missing' as const)
              : presentCount < expectedCount
                ? ('partial' as const)
                : ('mismatch' as const)
          };
          attention.push(issue);
          if (!missing) conflicts.push(issue);
        }
      }
    }
    if (!missing && rule.id !== editingRuleId) {
      conflicts.push({ kind: 'saved-rule-owner', ruleId: rule.id });
    }
  }

  for (const script of managedScripts) {
    const owner = rules.find(
      (rule) =>
        rule.kind === 'climate' &&
        rule.plugId === plug.id &&
        rule.deployment?.scriptId === script.id
    );
    if (!owner) {
      conflicts.push({ kind: 'orphan-managed-climate-script', scriptId: script.id });
    } else if (owner.id !== editingRuleId) {
      conflicts.push({
        kind: 'owned-live-climate-script',
        scriptId: script.id,
        ruleId: owner.id
      });
    }
  }
  for (const job of jobs) {
    if (!ownedJobIds.has(job.id)) {
      conflicts.push({ kind: 'unmanaged-native-schedule', jobId: job.id });
    }
  }
  return { status: conflicts.length ? 'blocked' : 'no-conflict', conflicts, attention };
};
EOF

cat > apps/mobile/src/flows/rules/ownership.test.ts <<'EOF'
import { LOCAL_CLIMATE_LINK_SCRIPT_NAME } from '@lcl/shelly-client';
import { describe, expect, it } from 'vitest';
import { climate, plug, time } from '../registry/fixtures.test-support.js';
import type { AutomationRule, TimeRule } from './model.js';
import { resolveRelayOwnership, type RelayInventory } from './ownership.js';
import { createRuleScheduleJob, expectedTimeRulePair } from './timeSchedule.js';

const script = { id: 7, name: LOCAL_CLIMATE_LINK_SCRIPT_NAME, running: true };
const climateDeployed = {
  ...climate,
  deployment: {
    scriptId: 7,
    scriptHash: 'hash',
    safetyTest: { status: 'pending' as const }
  }
};
const timeDeployed: TimeRule = {
  ...time,
  deployment: { pairs: [{ windowIndex: 0, onJobId: 8, offJobId: 9 }] }
};
const expectedTime = expectedTimeRulePair(timeDeployed, 0);
const jobs = [
  { id: 8, enable: true, ...expectedTime.on },
  { id: 9, enable: true, ...expectedTime.off }
];
const inventory = (
  patch: Partial<Extract<RelayInventory, { status: 'verified' }>> = {}
): RelayInventory => ({
  status: 'verified',
  plugId: plug.id,
  baseUrl: plug.baseUrl,
  scripts: [],
  schedules: [],
  ...patch
});
const resolve = (rules: AutomationRule[], live: RelayInventory, editingRuleId?: string) =>
  resolveRelayOwnership({
    plug,
    relayId: 0,
    rules,
    inventory: live,
    ...(editingRuleId ? { editingRuleId } : {})
  });

describe('relay ownership', () => {
  it('requires complete current-device inventory even with no saved rules', () => {
    expect(resolve([], inventory()).status).toBe('no-conflict');
    for (const live of [
      { status: 'unavailable' } as const,
      inventory({ plugId: 'another' }),
      inventory({ baseUrl: 'http://192.168.0.99' })
    ]) {
      expect(resolve([], live).conflicts).toContainEqual({ kind: 'inventory-unavailable' });
    }
  });

  it.each([climate, time])('a saved $kind owner blocks another rule of either kind', (rule) => {
    expect(resolve([rule], inventory()).conflicts).toContainEqual({
      kind: 'saved-rule-owner',
      ruleId: rule.id
    });
    expect(resolve([rule], inventory(), rule.id).status).toBe('no-conflict');
    expect(resolve([{ ...rule, plugId: 'another' }], inventory()).status).toBe('no-conflict');
  });

  it('lists every orphan exact managed id including stopped scripts, without including user/discovery scripts', () => {
    const live = inventory({
      scripts: [
        script,
        { ...script, id: 10, running: false },
        { ...script, id: 11, name: 'User script' },
        { ...script, id: 12, name: 'Local Climate Link BLE Discovery' }
      ]
    });
    expect(resolve([], live).conflicts).toEqual([
      { kind: 'orphan-managed-climate-script', scriptId: 7 },
      { kind: 'orphan-managed-climate-script', scriptId: 10 }
    ]);
  });

  it('distinguishes owned climate runtime and never turns its duplicate into owned runtime', () => {
    const live = inventory({ scripts: [script, { ...script, id: 10 }] });
    expect(resolve([climateDeployed], live).conflicts).toContainEqual({
      kind: 'owned-live-climate-script',
      ruleId: climate.id,
      scriptId: 7
    });
    expect(resolve([climateDeployed], live, climate.id).conflicts).toEqual([
      { kind: 'orphan-managed-climate-script', scriptId: 10 }
    ]);
  });

  it.each([climateDeployed, timeDeployed])(
    'only verified absence releases stale $kind metadata',
    (rule) => {
      expect(resolve([rule], { status: 'unavailable' }).status).toBe('blocked');
      expect(resolve([rule], inventory())).toEqual({
        status: 'no-conflict',
        conflicts: [],
        attention: [
          { kind: 'stale-deployment-metadata', ruleId: rule.id, remote: 'missing' }
        ]
      });
    }
  );

  it('keeps renamed/reused script ids blocked, including when editing the original rule', () => {
    expect(
      resolve(
        [climateDeployed],
        inventory({ scripts: [{ ...script, name: 'User script' }] }),
        climate.id
      ).conflicts
    ).toContainEqual({
      kind: 'stale-deployment-metadata',
      ruleId: climate.id,
      remote: 'mismatch'
    });
  });

  it('protects native schedules even when disabled and ignores schedules for other relays', () => {
    expect(resolve([], inventory({ schedules: [{ ...jobs[0]!, enable: false }] })).conflicts).toEqual([
      { kind: 'unmanaged-native-schedule', jobId: 8 }
    ]);
    expect(
      resolve(
        [],
        inventory({
          schedules: [
            {
              id: 1,
              ...createRuleScheduleJob(time.config.schedule.windows[0]!, 1, 'on')
            }
          ]
        })
      ).status
    ).toBe('no-conflict');
  });

  it('allows only every exact schedule pair when editing its rule', () => {
    expect(resolve([timeDeployed], inventory({ schedules: jobs }), time.id).status).toBe(
      'no-conflict'
    );
    expect(resolve([timeDeployed], inventory({ schedules: jobs })).conflicts).toContainEqual({
      kind: 'saved-rule-owner',
      ruleId: time.id
    });
    expect(
      resolve([timeDeployed], inventory({ schedules: [jobs[0]!] }), time.id).conflicts
    ).toContainEqual({
      kind: 'stale-deployment-metadata',
      ruleId: time.id,
      remote: 'partial'
    });
    expect(
      resolve(
        [timeDeployed],
        inventory({ schedules: jobs.map((job) => ({ ...job, timespec: 'changed' })) }),
        time.id
      ).conflicts
    ).toContainEqual({
      kind: 'stale-deployment-metadata',
      ruleId: time.id,
      remote: 'mismatch'
    });
  });

  it('tracks every pair for a multi-window time deployment', () => {
    const multi = {
      ...time,
      config: {
        schedule: {
          windows: [
            { days: [1, 2, 3, 4, 5] as const, start: '08:00', end: '10:00' },
            { days: [6, 0] as const, start: '09:00', end: '11:00' }
          ]
        }
      },
      deployment: {
        pairs: [
          { windowIndex: 0, onJobId: 20, offJobId: 21 },
          { windowIndex: 1, onJobId: 22, offJobId: 23 }
        ]
      }
    } satisfies TimeRule;
    const schedules = multi.deployment.pairs.flatMap((pair) => {
      const expected = expectedTimeRulePair(multi, pair.windowIndex);
      return [
        { id: pair.onJobId, enable: true, ...expected.on },
        { id: pair.offJobId, enable: true, ...expected.off }
      ];
    });
    expect(resolve([multi], inventory({ schedules }), multi.id).status).toBe('no-conflict');
    expect(
      resolve([multi], inventory({ schedules: schedules.slice(0, -1) }), multi.id).conflicts
    ).toContainEqual({
      kind: 'stale-deployment-metadata',
      ruleId: multi.id,
      remote: 'partial'
    });
  });

  it('does not let missing metadata hide new orphan scripts or unmanaged schedules', () => {
    const result = resolve(
      [climateDeployed],
      inventory({ scripts: [{ ...script, id: 20 }], schedules: jobs })
    );
    expect(result.status).toBe('blocked');
    expect(result.attention).toContainEqual({
      kind: 'stale-deployment-metadata',
      ruleId: climate.id,
      remote: 'missing'
    });
    expect(result.conflicts).toHaveLength(3);
  });
});
EOF

# Optimize schedule code away completely for climate rules that have no time constraint.
python3 - <<'PY'
from pathlib import Path
p = Path('packages/script-generator/src/shelly/generate.ts')
s = p.read_text()
start = s.index('const createRuntimeConfig = (')
end = s.index('\n\nconst renderThresholdHelper', start)
s = s[:start] + '''const createRuntimeConfig = (config: ShellyThermostatConfig, hash: string) => {\n  const base = {\n    a: compactAddress(config.sensor.runtimeAddress),\n    fa: config.sensor.runtimeAddress,\n    n: config.sensor.displayName,\n    k: hash,\n    i: config.output.relayId,\n    r: config.rule.rssiMin,\n    on: config.rule.control.onThreshold,\n    off: config.rule.control.offThreshold,\n    d: config.rule.control.direction === 'above' ? 1 : 0,\n    m: config.rule.control.metric === 'humidity' ? 1 : 0,\n    h: config.rule.consecutiveHits,\n    c: config.rule.minChangeMs,\n    s: config.rule.staleTimeoutSec * 1000,\n    x: config.rule.maxOnMs,\n    v: config.version,\n    vp: config.rule.vpdAssist.enabled ? config.rule.vpdAssist.targetKpa : 0\n  };\n  if (!config.schedule) return base;\n  return {\n    ...base,\n    tw: config.schedule.windows.map((window) => {\n      const start = parseRuleClockMinutes(window.start);\n      const end = parseRuleClockMinutes(window.end);\n      if (start === null || end === null) {\n        throw new Error('Validated rule schedule contains an invalid clock time.');\n      }\n      return [window.days, start, end];\n    })\n  };\n};''' + s[end:]
s = s.replace("  if (!config.schedule) return 'function aw(){return 1;}';", "  if (!config.schedule) return '';")
old = '''const renderMeasurementHelper = (config: ShellyThermostatConfig): string => {\n  const commonDecision =\n    'var W=aw();if(!R.m&&W<=0){R.ds=W<0?"nt":"tw";sw(false,W<0?"nt":"tw",true);return;}R.ds="ok";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;var go=C.d?v>T.o:v<T.o,stop=C.d?v<T.f:v>T.f,gr=C.d?"ab":"bl",sr=C.d?"bl":"ab";if(go){R.nh++;R.fh=0;if(R.nh<C.h){sw(R.on,gr+"h",false);return;}sw(true,gr,false);return;}if(stop){R.fh++;R.nh=0;sw(false,sr,false);return;}R.nh=0;R.fh=0;sw(R.on,"ib",false);';'''
new = '''const renderMeasurementHelper = (config: ShellyThermostatConfig): string => {\n  const scheduleGuard = config.schedule\n    ? 'var W=aw();if(!R.m&&W<=0){R.ds=W<0?"nt":"tw";sw(false,W<0?"nt":"tw",true);return;}'\n    : '';\n  const commonDecision =\n    scheduleGuard +\n    'R.ds="ok";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;var go=C.d?v>T.o:v<T.o,stop=C.d?v<T.f:v>T.f,gr=C.d?"ab":"bl",sr=C.d?"bl":"ab";if(go){R.nh++;R.fh=0;if(R.nh<C.h){sw(R.on,gr+"h",false);return;}sw(true,gr,false);return;}if(stop){R.fh++;R.nh=0;sw(false,sr,false);return;}R.nh=0;R.fh=0;sw(R.on,"ib",false);';'''
assert old in s
s = s.replace(old, new)
old = 'function stale(){var W=aw();if(!R.m&&W<=0){R.ds=W<0?"nt":"tw";R.nh=0;R.fh=0;sw(false,W<0?"nt":"tw",true);return;}var n=nw();if(R.ls===null||n-R.ls>C.s){R.ds="st";R.nh=0;R.fh=0;sw(false,"st",true);return;}if(R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}'
new = 'function stale(){${config.schedule ? \'var W=aw();if(!R.m&&W<=0){R.ds=W<0?"nt":"tw";R.nh=0;R.fh=0;sw(false,W<0?"nt":"tw",true);return;}\' : \'\'}var n=nw();if(R.ls===null||n-R.ls>C.s){R.ds="st";R.nh=0;R.fh=0;sw(false,"st",true);return;}if(R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}'
assert old in s
s = s.replace(old, new)
p.write_text(s)

p = Path('packages/script-generator/src/__tests__/schedule.test.ts')
s = p.read_text()
s = s.replace("    expect(script).toContain('\\\"tw\\\":null');\n    expect(script).toContain('function aw(){return 1;}');", "    expect(script).not.toContain('\\\"tw\\\":');\n    expect(script).not.toContain('function aw()');")
p.write_text(s)

p = Path('apps/mobile/src/flows/registry/devicesAndRules.test.ts')
s = p.read_text()
old = "automationRuleSchema.safeParse({ ...time, deployment: { onJobId: 4, offJobId: 4 } })"
new = "automationRuleSchema.safeParse({\n        ...time,\n        deployment: { pairs: [{ windowIndex: 0, onJobId: 4, offJobId: 4 }] }\n      })"
assert old in s
s = s.replace(old, new)
needle = "    expect(\n      automationRuleSchema.safeParse({\n        ...climate,\n        schedule: { windows: [{ days: [1, 1], start: '08:00', end: '09:00' }] }\n      }).success\n    ).toBe(false);"
assert needle in s
addition = needle + "\n    expect(\n      automationRuleSchema.safeParse({\n        ...time,\n        deployment: { pairs: [{ windowIndex: 1, onJobId: 4, offJobId: 5 }] }\n      }).success\n    ).toBe(false);"
s = s.replace(needle, addition)
p.write_text(s)

p = Path('apps/mobile/src/flows/devices/plugs/runtime.test.ts')
s = p.read_text()
s = s.replace("import { createDailyScheduleJob } from '../../time-automation/scheduleJobs.js';", "import { createRuleScheduleJob } from '../../rules/timeSchedule.js';")
old = "    setJobs([\n      { id: 11, ...createDailyScheduleJob({ ...time.config, relayId: 0 }, true) }\n    ]);"
new = "    setJobs([\n      { id: 11, ...createRuleScheduleJob(time.config.schedule.windows[0]!, 0, 'on') }\n    ]);"
assert old in s
p.write_text(s.replace(old, new))

p = Path('docs/implementation/device-rule-decoupling-plan.md')
s = p.read_text()
old = '''  deployment: null | {\n    onJobId: number;\n    offJobId: number;\n  };'''
new = '''  deployment: null | {\n    pairs: Array<{\n      windowIndex: number;\n      onJobId: number;\n      offJobId: number;\n    }>;\n  };'''
assert old in s
s = s.replace(old, new, 1)
old = "For a standalone time rule, the schedule is the primary automation and should continue to compile/deploy to native Shelly schedule resources when supported. Do not create those native schedule jobs for a climate rule's time constraint."
new = old + " Each normalized time-rule window owns one exact ON/OFF native schedule pair; deployment metadata stores every pair so multi-window cleanup and drift detection remain exact."
assert old in s
p.write_text(s.replace(old, new, 1))
PY

pnpm exec prettier --write \
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
  docs/implementation/device-rule-decoupling-plan.md

pnpm --filter @lcl/script-generator exec vitest run src/__tests__/generator.test.ts -u
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

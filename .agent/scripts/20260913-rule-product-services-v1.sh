#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=7114f0ded9ca3866a5bd20ada8ac7a1d1f67220f
cd "$REPO"
git fetch origin "$BRANCH" agent-control
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }
git checkout "$BRANCH"
git reset --hard "$REMOTE"
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/flows/rules/lifecycle.ts')
s = p.read_text()
repls = [
(
"  readClimateRuleRuntime,\n  resumeClimateRule,\n  runClimateRuleSafetyTest,",
"  readClimateRuleRuntime,\n  resumeClimateRule,\n  runClimateRuleSafetyTest,\n  setClimateRuleRelay,"
),
(
"  resumeClimate: typeof resumeClimateRule;\n  readClimate: typeof readClimateRuleRuntime;",
"  resumeClimate: typeof resumeClimateRule;\n  setClimateRelay: typeof setClimateRuleRelay;\n  readClimate: typeof readClimateRuleRuntime;"
),
(
"    resumeClimate: resumeClimateRule,\n    readClimate: readClimateRuleRuntime,",
"    resumeClimate: resumeClimateRule,\n    setClimateRelay: setClimateRuleRelay,\n    readClimate: readClimateRuleRuntime,"
),
]
for old, new in repls:
    if old not in s:
        raise SystemExit(f'lifecycle patch anchor missing: {old}')
    s = s.replace(old, new, 1)
anchor = "export const deleteRule = async (\n"
if anchor not in s:
    raise SystemExit('deleteRule anchor missing')
fn = """export const setRuleRelay = async (\n  ruleId: string,\n  on: boolean,\n  deps: RuleLifecycleDependencies = defaultDependencies\n): Promise<ClimateRuleRuntimeSnapshot> => {\n  const snapshot = requireRule(ruleId, deps);\n  return deps.runPlugOperation(snapshot.plugId, async () => {\n    const rule = requireRule(ruleId, deps);\n    if (rule.kind !== 'climate') {\n      throw ruleLifecycleError(\n        'runtime-attention',\n        'Manual relay control is only available for climate rules.'\n      );\n    }\n    if (!rule.deployment) {\n      throw ruleLifecycleError('rule-not-deployed', 'Rule is not deployed.');\n    }\n    const { plug } = requireDevices(rule, deps);\n    return deps.runtime.setClimateRelay(rule, plug, on);\n  });\n};\n\n"""
s = s.replace(anchor, fn + anchor, 1)
p.write_text(s)

p = Path('apps/mobile/src/flows/rules/lifecycle.test.ts')
s = p.read_text()
old = "  saveRuleDraft,\n  verifyRule,"
new = "  saveRuleDraft,\n  setRuleRelay,\n  verifyRule,"
if old not in s:
    raise SystemExit('lifecycle test import anchor missing')
s = s.replace(old, new, 1)
old = "    resumeClimate: vi.fn(async () => ({ mode: 'auto' }) as never),\n    readClimate:"
new = "    resumeClimate: vi.fn(async () => ({ mode: 'auto' }) as never),\n    setClimateRelay: vi.fn(async (_rule, _plug, on: boolean) => ({ relayOn: on, mode: 'manual' }) as never),\n    readClimate:"
if old not in s:
    raise SystemExit('lifecycle test runtime anchor missing')
s = s.replace(old, new, 1)
anchor = "  it('deletes the exact remote deployment before detaching and removing the rule', async () => {"
if anchor not in s:
    raise SystemExit('lifecycle test case anchor missing')
case = """  it('serializes manual climate relay control through the plug queue', async () => {\n    const deployed = {\n      ...climate,\n      deployment: {\n        ...pendingClimate,\n        safetyTest: { status: 'verified' as const, verifiedAtMs: 99 }\n      }\n    };\n    const harness = createHarness([deployed]);\n    const runtime = await setRuleRelay(climate.id, true, harness.deps);\n    expect(harness.events[0]).toBe('queue');\n    expect(harness.runtime.setClimateRelay).toHaveBeenCalledWith(deployed, plug, true);\n    expect(runtime).toMatchObject({ relayOn: true, mode: 'manual' });\n  });\n\n"""
s = s.replace(anchor, case + anchor, 1)
p.write_text(s)
PY

cat > apps/mobile/src/flows/rules/draft.ts <<'EOF'
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import type { SavedPlug } from '../devices/plugs/model.js';
import type { SavedSensor } from '../devices/sensors/model.js';
import {
  defaultRulePresetForSetupIntent,
  type SetupIntent
} from '../setup-intent.js';
import {
  climateRuleSchema,
  timeRuleSchema,
  type AutomationRule,
  type RuleSchedule
} from './model.js';

export const defaultTimeRuleSchedule: RuleSchedule = {
  windows: [
    {
      days: [0, 1, 2, 3, 4, 5, 6],
      start: '08:00',
      end: '20:00'
    }
  ]
};

type CreateRuleDraftInput = {
  id: string;
  name: string;
  intent: SetupIntent;
  plug: SavedPlug;
  sensor?: SavedSensor | null;
  schedule?: RuleSchedule | null;
  nowMs?: number;
};

export const createRuleDraft = ({
  id,
  name,
  intent,
  plug,
  sensor = null,
  schedule,
  nowMs = Date.now()
}: CreateRuleDraftInput): AutomationRule => {
  if (intent === 'time') {
    return timeRuleSchema.parse({
      version: 1,
      id,
      kind: 'time',
      name,
      plugId: plug.id,
      relayId: 0,
      config: { schedule: schedule ?? defaultTimeRuleSchedule },
      deployment: null,
      createdAtMs: nowMs,
      updatedAtMs: nowMs
    });
  }

  if (!sensor) {
    throw new Error('Climate rules require a saved sensor.');
  }
  const preset = defaultRulePresetForSetupIntent(intent);
  if (!preset) throw new Error('Climate setup intent must resolve a rule preset.');
  const base = createDefaultShellyThermostatConfig(sensor.profileId, preset);
  return climateRuleSchema.parse({
    version: 1,
    id,
    kind: 'climate',
    name,
    plugId: plug.id,
    relayId: 0,
    sensorId: sensor.id,
    config: {
      rule: base.rule,
      diagnostics: base.diagnostics
    },
    schedule: schedule ?? null,
    deployment: null,
    createdAtMs: nowMs,
    updatedAtMs: nowMs
  });
};
EOF

cat > apps/mobile/src/flows/rules/useRuleRuntime.ts <<'EOF'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePlugStore, useRuleStore } from '../registry/devicesAndRules.js';
import {
  deleteRule,
  deployRule,
  pauseRule,
  recoverRule,
  resumeRule,
  setRuleRelay,
  verifyRule
} from './lifecycle.js';
import { readClimateRuleRuntime } from './climateRuntime.js';
import { readTimeRuleRuntime } from './timeRuntime.js';

export const ruleRuntimeQueryKey = (ruleId: string, baseUrl: string) =>
  ['rule-runtime', ruleId, baseUrl] as const;

export type RuleAction =
  | 'deploy'
  | 'verify'
  | 'pause'
  | 'resume'
  | 'recover'
  | 'delete'
  | 'relay-on'
  | 'relay-off';

export const useRuleRuntime = (ruleId: string) => {
  const queryClient = useQueryClient();
  const rule = useRuleStore((state) =>
    state.items.find((candidate) => candidate.id === ruleId)
  );
  const plug = usePlugStore((state) =>
    state.items.find((candidate) => candidate.id === rule?.plugId)
  );
  const queryKey = ruleRuntimeQueryKey(ruleId, plug?.baseUrl ?? 'missing');
  const runtime = useQuery({
    queryKey,
    enabled: Boolean(rule?.deployment && plug),
    retry: false,
    queryFn: async () => {
      if (!rule || !plug) throw new Error('Rule devices are unavailable.');
      return rule.kind === 'climate'
        ? readClimateRuleRuntime(rule, plug)
        : readTimeRuleRuntime(rule, plug);
    }
  });
  const action = useMutation({
    mutationFn: async (kind: RuleAction) => {
      switch (kind) {
        case 'deploy':
          return deployRule(ruleId);
        case 'verify':
          return verifyRule(ruleId);
        case 'pause':
          return pauseRule(ruleId);
        case 'resume':
          return resumeRule(ruleId);
        case 'recover':
          return recoverRule(ruleId);
        case 'delete':
          return deleteRule(ruleId);
        case 'relay-on':
          return setRuleRelay(ruleId, true);
        case 'relay-off':
          return setRuleRelay(ruleId, false);
      }
    },
    onSettled: async (_data, _error, kind) => {
      if (kind === 'delete') {
        queryClient.removeQueries({ queryKey, exact: true });
      } else {
        await queryClient.invalidateQueries({ queryKey, exact: true });
      }
      await queryClient.invalidateQueries({ queryKey: ['plug-runtime'] });
    }
  });

  return { rule, plug, runtime, action, queryKey };
};
EOF

cat > apps/mobile/src/flows/rules/draft.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import { plug, sensor } from '../registry/fixtures.test-support.js';
import { createRuleDraft, defaultTimeRuleSchedule } from './draft.js';

describe('rule drafts', () => {
  it('creates an independent climate rule from saved device references', () => {
    const rule = createRuleDraft({
      id: 'rule-1',
      name: 'My own rule name',
      intent: 'temperature',
      plug: { ...plug, name: 'Renamed plug' },
      sensor: { ...sensor, name: 'Renamed sensor' },
      nowMs: 10
    });
    expect(rule.kind).toBe('climate');
    expect(rule.name).toBe('My own rule name');
    expect(rule.plugId).toBe(plug.id);
    expect(rule.kind === 'climate' && rule.sensorId).toBe(sensor.id);
    expect(rule.deployment).toBeNull();
  });

  it('creates a native time rule without requiring a sensor', () => {
    const rule = createRuleDraft({
      id: 'time-new',
      name: 'Lamp schedule',
      intent: 'time',
      plug,
      nowMs: 20
    });
    expect(rule.kind).toBe('time');
    expect(rule.kind === 'time' && rule.config.schedule).toEqual(defaultTimeRuleSchedule);
  });

  it('accepts climate active hours as desired rule config', () => {
    const schedule = {
      windows: [{ days: [1, 2, 3, 4, 5] as const, start: '06:00', end: '22:00' }]
    };
    const rule = createRuleDraft({
      id: 'rule-hours',
      name: 'Day climate',
      intent: 'humidity',
      plug,
      sensor,
      schedule,
      nowMs: 30
    });
    expect(rule.kind === 'climate' && rule.schedule).toEqual(schedule);
  });
});
EOF

pnpm exec prettier --write \
  apps/mobile/src/flows/rules/lifecycle.ts \
  apps/mobile/src/flows/rules/lifecycle.test.ts \
  apps/mobile/src/flows/rules/draft.ts \
  apps/mobile/src/flows/rules/draft.test.ts \
  apps/mobile/src/flows/rules/useRuleRuntime.ts
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/rules/lifecycle.test.ts \
  src/flows/rules/draft.test.ts \
  src/flows/rules/runtimeOwnership.test.ts \
  src/flows/rules/climateRuntime.test.ts \
  src/flows/rules/timeRuntime.test.ts
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add \
  apps/mobile/src/flows/rules/lifecycle.ts \
  apps/mobile/src/flows/rules/lifecycle.test.ts \
  apps/mobile/src/flows/rules/draft.ts \
  apps/mobile/src/flows/rules/draft.test.ts \
  apps/mobile/src/flows/rules/useRuleRuntime.ts
git commit -m 'Add rule product runtime services'
HEAD=$(git rev-parse HEAD)
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$EXPECTED" ]] || { echo 'Remote moved during product services task'; exit 4; }
git push origin "$HEAD:$BRANCH"
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$HEAD" ]] || { echo 'Push verification failed'; exit 5; }
echo "FINAL_HEAD=$HEAD"

#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='70c8fb0e989200479a05e57516ad12fbe763b8d5'

git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

cat > packages/automation-core/src/schedule.ts <<'EOF'
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RuleTimeWindow = {
  days: Weekday[];
  start: string;
  end: string;
};

export type RuleSchedule = {
  windows: RuleTimeWindow[];
};

const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const parseRuleClockMinutes = (time: string): number | null => {
  const match = CLOCK_TIME_PATTERN.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const windowKey = (window: RuleTimeWindow): string =>
  `${window.days.join(',')}|${window.start}|${window.end}`;

export const normalizeRuleSchedule = (schedule: RuleSchedule): RuleSchedule => {
  const windows = schedule.windows
    .map((window) => ({
      days: [...new Set(window.days)].sort((left, right) => left - right) as Weekday[],
      start: window.start,
      end: window.end
    }))
    .sort((left, right) => windowKey(left).localeCompare(windowKey(right)));

  return {
    windows: windows.filter(
      (window, index) => index === 0 || windowKey(window) !== windowKey(windows[index - 1])
    )
  };
};

export const isRuleScheduleActive = (
  schedule: RuleSchedule,
  weekday: Weekday,
  clockTime: string
): boolean => {
  const current = parseRuleClockMinutes(clockTime);
  if (current === null) return false;

  return schedule.windows.some((window) => {
    const start = parseRuleClockMinutes(window.start);
    const end = parseRuleClockMinutes(window.end);
    if (start === null || end === null || start === end) return false;

    if (start < end) {
      return window.days.includes(weekday) && current >= start && current < end;
    }

    const previousWeekday = ((weekday + 6) % 7) as Weekday;
    return (
      (window.days.includes(weekday) && current >= start) ||
      (window.days.includes(previousWeekday) && current < end)
    );
  });
};
EOF

cat > packages/automation-core/src/__tests__/schedule.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import {
  isRuleScheduleActive,
  normalizeRuleSchedule,
  parseRuleClockMinutes,
  type RuleSchedule
} from '../schedule.js';

describe('rule schedule', () => {
  it('parses valid clock values and rejects malformed values', () => {
    expect(parseRuleClockMinutes('00:00')).toBe(0);
    expect(parseRuleClockMinutes('23:59')).toBe(1439);
    expect(parseRuleClockMinutes('24:00')).toBeNull();
    expect(parseRuleClockMinutes('8:00')).toBeNull();
  });

  it('normalizes day/window order and exact duplicates deterministically', () => {
    const schedule: RuleSchedule = {
      windows: [
        { days: [5, 1, 1, 3], start: '22:00', end: '02:00' },
        { days: [3, 5, 1], start: '22:00', end: '02:00' },
        { days: [0], start: '08:00', end: '10:00' }
      ]
    };

    expect(normalizeRuleSchedule(schedule)).toEqual({
      windows: [
        { days: [0], start: '08:00', end: '10:00' },
        { days: [1, 3, 5], start: '22:00', end: '02:00' }
      ]
    });
  });

  it('evaluates same-day and cross-midnight windows using the starting weekday', () => {
    const schedule: RuleSchedule = {
      windows: [
        { days: [1], start: '08:00', end: '10:00' },
        { days: [5], start: '22:00', end: '02:00' }
      ]
    };

    expect(isRuleScheduleActive(schedule, 1, '08:00')).toBe(true);
    expect(isRuleScheduleActive(schedule, 1, '10:00')).toBe(false);
    expect(isRuleScheduleActive(schedule, 5, '23:30')).toBe(true);
    expect(isRuleScheduleActive(schedule, 6, '01:30')).toBe(true);
    expect(isRuleScheduleActive(schedule, 6, '02:00')).toBe(false);
    expect(isRuleScheduleActive(schedule, 0, '01:30')).toBe(false);
  });
});
EOF

cat > packages/automation-core/src/index.ts <<'EOF'
export * from './model.js';
export * from './schedule.js';
export * from './thermostat/heating.js';
export * from './failsafe/index.js';
export * from './simulator/simulate.js';
EOF

cat > apps/mobile/src/flows/rules/model.ts <<'EOF'
import { normalizeRuleSchedule } from '@lcl/automation-core';
import { climateSettingsSchema } from '@lcl/script-generator';
import { z } from 'zod';
import { plugIdSchema } from '../devices/plugs/model.js';

const clockTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const weekdaySchema = z.number().int().min(0).max(6);

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
      .object({
        onJobId: z.number().int().nonnegative(),
        offJobId: z.number().int().nonnegative()
      })
      .strict()
      .refine((deployment) => deployment.onJobId !== deployment.offJobId)
      .nullable()
  })
  .strict();

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

cat > apps/mobile/src/flows/rules/selectors.ts <<'EOF'
import {
  shellyThermostatConfigSchema,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import type { SavedPlug } from '../devices/plugs/model.js';
import type { SavedSensor } from '../devices/sensors/model.js';
import type { RegistryResult } from '../registry/result.js';
import type { AutomationRule, ClimateRule } from './model.js';

export type DeviceRegistries = {
  plugs: readonly SavedPlug[];
  sensors: readonly SavedSensor[];
};
export type ResolvedRule =
  | { rule: ClimateRule; plug: SavedPlug; sensor: SavedSensor }
  | { rule: Extract<AutomationRule, { kind: 'time' }>; plug: SavedPlug };

export const resolveRuleDevices = (
  rule: AutomationRule,
  devices: DeviceRegistries
): RegistryResult<ResolvedRule> => {
  const plug = devices.plugs.find((candidate) => candidate.id === rule.plugId);
  if (!plug)
    return {
      ok: false,
      error: { kind: 'device-missing', deviceKind: 'plug', deviceId: rule.plugId }
    };
  if (rule.kind === 'time') return { ok: true, value: { rule, plug } };
  const sensor = devices.sensors.find((candidate) => candidate.id === rule.sensorId);
  return sensor
    ? { ok: true, value: { rule, plug, sensor } }
    : {
        ok: false,
        error: { kind: 'device-missing', deviceKind: 'sensor', deviceId: rule.sensorId }
      };
};

export const deviceReferencingRuleIds = (
  kind: 'plug' | 'sensor',
  id: string,
  rules: readonly AutomationRule[]
): string[] =>
  rules
    .filter((rule) =>
      kind === 'plug'
        ? rule.plugId === id
        : rule.kind === 'climate' && rule.sensorId === id
    )
    .map((rule) => rule.id);

export const canRemoveDevice = (
  kind: 'plug' | 'sensor',
  id: string,
  rules: readonly AutomationRule[]
): RegistryResult<null> => {
  const ruleIds = deviceReferencingRuleIds(kind, id, rules);
  return ruleIds.length
    ? { ok: false, error: { kind: 'device-referenced', ruleIds } }
    : { ok: true, value: null };
};

export const resolveClimateGeneratorConfig = (
  rule: ClimateRule,
  devices: DeviceRegistries
): RegistryResult<ShellyThermostatConfig> => {
  const resolved = resolveRuleDevices(rule, devices);
  if (!resolved.ok) return resolved;
  if (!('sensor' in resolved.value)) throw new Error('Expected a climate rule.');
  const { plug, sensor } = resolved.value;
  const parsed = shellyThermostatConfigSchema.safeParse({
    version: 1,
    ...rule.config,
    schedule: rule.schedule,
    sensor: {
      profileId: sensor.profileId,
      sensorId: sensor.id,
      runtimeAddress: sensor.runtimeAddress,
      displayName: sensor.name,
      parserValidated: true
    },
    output: { profileId: plug.profileId, relayId: rule.relayId }
  });
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: { kind: 'validation-failed' } };
};
EOF

cat > apps/mobile/src/flows/rules/store.ts <<'EOF'
import type { RegistryRepository } from '../registry/repository.js';
import type { RegistryResult } from '../registry/result.js';
import { createRegistryStore } from '../registry/store.js';
import { automationRuleSchema, type AutomationRule } from './model.js';
import { resolveRuleDevices, type DeviceRegistries } from './selectors.js';

export const createRuleStore = (
  repository: RegistryRepository<AutomationRule>,
  readDevices: () => RegistryResult<DeviceRegistries>
) =>
  createRegistryStore({
    repository,
    schema: automationRuleSchema,
    beforeUpsert: (rule, existing, rules) => {
      const competingRuleIds = rules
        .filter(
          (candidate) =>
            candidate.id !== rule.id &&
            candidate.plugId === rule.plugId &&
            candidate.relayId === rule.relayId
        )
        .map((candidate) => candidate.id);
      if (competingRuleIds.length > 0) {
        return {
          ok: false,
          error: { kind: 'rule-relay-conflict', ruleIds: competingRuleIds }
        };
      }
      if (existing?.deployment) {
        const bindingChanged =
          existing.kind !== rule.kind ||
          existing.plugId !== rule.plugId ||
          existing.relayId !== rule.relayId ||
          (existing.kind === 'climate' &&
            rule.kind === 'climate' &&
            existing.sensorId !== rule.sensorId);
        const desiredConfigChanged =
          existing.kind === rule.kind &&
          (JSON.stringify(existing.config) !== JSON.stringify(rule.config) ||
            (existing.kind === 'climate' &&
              rule.kind === 'climate' &&
              JSON.stringify(existing.schedule) !== JSON.stringify(rule.schedule)));
        if (bindingChanged || desiredConfigChanged) {
          return {
            ok: false,
            error: { kind: 'deployment-attached', ruleId: rule.id }
          };
        }
      }
      const devices = readDevices();
      if (!devices.ok) return devices;
      const resolved = resolveRuleDevices(rule, devices.value);
      return resolved.ok ? { ok: true, value: null } : resolved;
    },
    beforeRemove: (id, rules) =>
      rules.some((rule) => rule.id === id && rule.deployment !== null)
        ? { ok: false, error: { kind: 'deployment-attached', ruleId: id } }
        : { ok: true, value: null }
  });
EOF

cat > apps/mobile/src/flows/registry/fixtures.test-support.ts <<'EOF'
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { savedPlugSchema } from '../devices/plugs/model.js';
import { createSensorId, savedSensorSchema } from '../devices/sensors/model.js';
import { climateRuleSchema, timeRuleSchema } from '../rules/model.js';
import type { RegistryStorage } from './repository.js';

export const plug = savedPlugSchema.parse({
  version: 1,
  id: 'SHELLY-ABC',
  profileId: 'shelly_plug_s_gen3',
  name: 'Desk',
  baseUrl: 'http://192.168.0.20',
  model: 'S3PL-00112EU',
  gen: 3,
  createdAtMs: 1,
  updatedAtMs: 1
});
export const sensor = savedSensorSchema.parse({
  version: 1,
  id: createSensorId('xiaomi_lywsd03mmc_bthome_v2', 'AA:BB:CC:DD:EE:FF'),
  profileId: 'xiaomi_lywsd03mmc_bthome_v2',
  name: 'Room',
  runtimeAddress: 'AA:BB:CC:DD:EE:FF',
  createdAtMs: 1,
  updatedAtMs: 1
});
const config = createDefaultShellyThermostatConfig();
export const climate = climateRuleSchema.parse({
  version: 1,
  id: 'climate-1',
  kind: 'climate',
  name: 'Heating',
  plugId: plug.id,
  relayId: 0,
  sensorId: sensor.id,
  config: { rule: config.rule, diagnostics: config.diagnostics },
  schedule: null,
  deployment: null,
  createdAtMs: 2,
  updatedAtMs: 2
});
export const time = timeRuleSchema.parse({
  version: 1,
  id: 'time-1',
  kind: 'time',
  name: 'Morning',
  plugId: plug.id,
  relayId: 0,
  config: {
    schedule: {
      windows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00' }]
    }
  },
  deployment: null,
  createdAtMs: 2,
  updatedAtMs: 2
});
export const memoryStorage = (): RegistryStorage => {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    }
  };
};
EOF

cat > packages/script-generator/src/shelly/config.ts <<'EOF'
import {
  defaultRuleForPreset,
  normalizeRuleSchedule,
  type RulePresetId
} from '@lcl/automation-core';
import { outputProfileIdSchema, sensorProfileIdSchema } from '@lcl/device-profiles';
import { z } from 'zod';
import { climateSettingsSchema } from './climateSettings.js';

export const GENERATOR_VERSION = '0.3.0';

const shellyRuntimeAddressSchema = z
  .string()
  .trim()
  .regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i, 'Invalid Shelly runtime address.')
  .transform((value) => value.toUpperCase());

const clockTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const generatorTimeWindowSchema = z
  .object({
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length),
    start: z.string().regex(clockTimePattern),
    end: z.string().regex(clockTimePattern)
  })
  .strict()
  .refine((window) => window.start !== window.end, { path: ['end'] });

const generatorScheduleSchema = z
  .object({ windows: z.array(generatorTimeWindowSchema).min(1).max(16) })
  .strict()
  .transform((schedule) => normalizeRuleSchedule(schedule));

export const shellyThermostatConfigSchema = climateSettingsSchema
  .innerType()
  .extend({
    version: z.literal(1),
    schedule: generatorScheduleSchema.nullable().default(null),
    sensor: z.object({
      profileId: sensorProfileIdSchema,
      sensorId: z.string().min(1),
      runtimeAddress: shellyRuntimeAddressSchema,
      displayName: z.string().min(1),
      parserValidated: z.boolean().default(false)
    }),
    output: z.object({
      profileId: outputProfileIdSchema,
      relayId: z.number().int().min(0).default(0)
    })
  })
  .superRefine((config, context) => {
    const settings = climateSettingsSchema.safeParse({
      rule: config.rule,
      diagnostics: config.diagnostics
    });
    if (!settings.success) {
      for (const issue of settings.error.issues) context.addIssue(issue);
    }
  });

export type ShellyThermostatConfig = z.infer<typeof shellyThermostatConfigSchema>;

export const createDefaultShellyThermostatConfig = (
  sensorProfileId: ShellyThermostatConfig['sensor']['profileId'] = 'xiaomi_lywsd03mmc_bthome_v2',
  preset: RulePresetId = 'heating'
): ShellyThermostatConfig => {
  const defaultRule = defaultRuleForPreset(preset);

  return {
    version: 1,
    schedule: null,
    sensor: {
      profileId: sensorProfileId,
      sensorId:
        sensorProfileId === 'tp357_custom_v1' ? 'demo-tp357' : 'demo-xiaomi-bthome',
      runtimeAddress:
        sensorProfileId === 'tp357_custom_v1' ? '11:22:33:44:55:66' : 'AA:BB:CC:DD:EE:FF',
      displayName:
        sensorProfileId === 'tp357_custom_v1' ? 'TP357 demo' : 'Xiaomi LYWSD03MMC demo',
      parserValidated: true
    },
    output: {
      profileId: 'shelly_plug_s_gen3',
      relayId: 0
    },
    rule: {
      mode: defaultRule.mode,
      control: {
        ...defaultRule.control
      },
      vpdAssist: {
        ...defaultRule.vpdAssist
      },
      staleTimeoutSec: defaultRule.staleTimeoutSec,
      minChangeMs: defaultRule.minChangeMs,
      maxOnMs: defaultRule.maxOnMs,
      rssiMin: defaultRule.rssiMin,
      consecutiveHits: defaultRule.consecutiveHits,
      failSafe: 'off',
      bootState: 'off'
    },
    diagnostics: {
      enabled: true
    }
  };
};

export const normalizeConfig = (input: unknown): ShellyThermostatConfig =>
  shellyThermostatConfigSchema.parse(input);
EOF

python3 - <<'PY'
from pathlib import Path

p = Path('packages/script-generator/src/shelly/generate.ts')
s = p.read_text()
old = "import { GENERATOR_VERSION, normalizeConfig } from './config.js';\nimport type { ShellyThermostatConfig } from './config.js';"
new = "import { parseRuleClockMinutes } from '@lcl/automation-core';\nimport { GENERATOR_VERSION, normalizeConfig } from './config.js';\nimport type { ShellyThermostatConfig } from './config.js';"
assert s.count(old) == 1
s = s.replace(old, new)
old = "  vp: config.rule.vpdAssist.enabled ? config.rule.vpdAssist.targetKpa : 0\n});"
new = "  vp: config.rule.vpdAssist.enabled ? config.rule.vpdAssist.targetKpa : 0,\n  tw: config.schedule\n    ? config.schedule.windows.map((window) => {\n        const start = parseRuleClockMinutes(window.start);\n        const end = parseRuleClockMinutes(window.end);\n        if (start === null || end === null) {\n          throw new Error('Validated rule schedule contains an invalid clock time.');\n        }\n        return [window.days, start, end];\n      })\n    : null\n});"
assert s.count(old) == 1
s = s.replace(old, new)
marker = "const renderRuntimeState = (config: ShellyThermostatConfig): string =>\n"
assert s.count(marker) == 1
helper = '''const renderScheduleWindowHelper = (config: ShellyThermostatConfig): string => {\n  if (!config.schedule) return 'function aw(){return 1;}';\n\n  return `function aw(){var y=Shelly.getComponentStatus(\"sys\");if(!y||y.time===null||y.time===undefined||y.unixtime===null||y.unixtime===undefined)return-1;var q=String(y.time).split(\":\"),hh,mm;if(q.length<2)return-1;hh=Number(q[0]);mm=Number(q[1]);if(hh<0||hh>23||mm<0||mm>59)return-1;var lm=hh*60+mm,u=y.unixtime%86400;if(u<0)u+=86400;var um=Math.floor(u/60),z=lm-um;while(z<-720)z+=1440;while(z>840)z-=1440;var ld=Math.floor((Math.floor(y.unixtime/60)+z)/1440),d=(ld+4)%7;if(d<0)d+=7;for(var j=0;j<C.tw.length;j++){var w=C.tw[j],ds=w[0],a=w[1],b=w[2];if(a<b){if(ds.indexOf(d)>=0&&lm>=a&&lm<b)return 1;}else{var p=(d+6)%7;if((ds.indexOf(d)>=0&&lm>=a)||(ds.indexOf(p)>=0&&lm<b))return 1;}}return 0;}`;\n};\n\n'''
s = s.replace(marker, helper + marker)
old = "  const commonDecision =\n    'R.ds=\"ok\";var T=th(t,h);"
new = "  const commonDecision =\n    'var W=aw();if(!R.m&&W<=0){R.ds=W<0?\"nt\":\"tw\";sw(false,W<0?\"nt\":\"tw\",true);return;}R.ds=\"ok\";var T=th(t,h);"
assert s.count(old) == 1
s = s.replace(old, new)
old = "function nw(){return Shelly.getUptimeMs();}\nfunction na(a)"
new = "function nw(){return Shelly.getUptimeMs();}\n${renderScheduleWindowHelper(config)}\nfunction na(a)"
assert s.count(old) == 1
s = s.replace(old, new)
old = 'function stale(){var n=nw();if(R.ls===null||n-R.ls>C.s){R.ds="st";R.nh=0;R.fh=0;sw(false,"st",true);return;}if(R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}'
new = 'function stale(){var W=aw();if(!R.m&&W<=0){R.ds=W<0?"nt":"tw";R.nh=0;R.fh=0;sw(false,W<0?"nt":"tw",true);return;}var n=nw();if(R.ls===null||n-R.ls>C.s){R.ds="st";R.nh=0;R.fh=0;sw(false,"st",true);return;}if(R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}'
assert s.count(old) == 1
s = s.replace(old, new)
p.write_text(s)
PY

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
  });

  it('keeps unrestricted climate rules free of a runtime schedule requirement', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());
    expect(script).toContain('"tw":null');
    expect(script).toContain('function aw(){return 1;}');
  });

  it('rejects empty, duplicate-day and zero-length schedule windows', () => {
    const base = createDefaultShellyThermostatConfig();
    expect(
      shellyThermostatConfigSchema.safeParse({
        ...base,
        schedule: { windows: [] }
      }).success
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
p = Path('apps/mobile/src/flows/registry/devicesAndRules.test.ts')
s = p.read_text()
old = "    expect(config.ok && config.value.sensor).toMatchObject({\n      sensorId: sensor.id,\n      displayName: 'Renamed',\n      runtimeAddress: sensor.runtimeAddress\n    });"
new = "    expect(config.ok && config.value.sensor).toMatchObject({\n      sensorId: sensor.id,\n      displayName: 'Renamed',\n      runtimeAddress: sensor.runtimeAddress\n    });\n    expect(config.ok && config.value.schedule).toBeNull();"
assert s.count(old) == 1
s = s.replace(old, new)
old = "        ...time,\n        config: { onTime: '08:00', offTime: '08:00' }\n      }).success"
new = "        ...time,\n        config: {\n          schedule: { windows: [{ days: [1], start: '08:00', end: '08:00' }] }\n        }\n      }).success"
assert s.count(old) == 1
s = s.replace(old, new)
insert_after = "    expect(\n      automationRuleSchema.safeParse({ ...time, deployment: { onJobId: 4, offJobId: 4 } })\n        .success\n    ).toBe(false);"
addition = insert_after + "\n    expect(\n      automationRuleSchema.safeParse({\n        ...climate,\n        schedule: { windows: [{ days: [1, 1], start: '08:00', end: '09:00' }] }\n      }).success\n    ).toBe(false);"
assert s.count(insert_after) == 1
s = s.replace(insert_after, addition)
p.write_text(s)
PY

pnpm exec prettier --write \
  packages/automation-core/src/schedule.ts \
  packages/automation-core/src/__tests__/schedule.test.ts \
  packages/automation-core/src/index.ts \
  apps/mobile/src/flows/rules/model.ts \
  apps/mobile/src/flows/rules/selectors.ts \
  apps/mobile/src/flows/rules/store.ts \
  apps/mobile/src/flows/registry/fixtures.test-support.ts \
  apps/mobile/src/flows/registry/devicesAndRules.test.ts \
  packages/script-generator/src/shelly/config.ts \
  packages/script-generator/src/shelly/generate.ts \
  packages/script-generator/src/__tests__/schedule.test.ts

pnpm --filter @lcl/automation-core test
pnpm --filter @lcl/script-generator test
pnpm --filter @lcl/mobile test -- src/flows/registry/devicesAndRules.test.ts src/flows/rules/ownership.test.ts
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
  apps/mobile/src/flows/registry/fixtures.test-support.ts \
  apps/mobile/src/flows/registry/devicesAndRules.test.ts \
  packages/script-generator/src/shelly/config.ts \
  packages/script-generator/src/shelly/generate.ts \
  packages/script-generator/src/__tests__/schedule.test.ts

git commit -m 'Add rule schedule foundation'
printf 'FINAL_HEAD=%s\n' "$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"

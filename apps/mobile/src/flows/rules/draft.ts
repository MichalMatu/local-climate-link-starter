import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import type { SavedPlug } from '../devices/plugs/model.js';
import type { SavedSensor } from '../devices/sensors/model.js';
import { defaultRulePresetForSetupIntent, type SetupIntent } from '../setup-intent.js';
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

import { defaultRuleForPreset, type RulePresetId } from '@lcl/automation-core';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import type { SavedPlug } from '../devices/plugs/model.js';
import type { SavedSensor } from '../devices/sensors/model.js';
import {
  defaultRulePresetForSetupIntent,
  rulePresetsForSetupIntent,
  type SetupIntent
} from '../setup-intent.js';
import {
  climateRuleSchema,
  ruleScheduleSchema,
  timeRuleSchema,
  type AutomationRule,
  type RuleSchedule
} from './model.js';

type Weekday = RuleSchedule['windows'][number]['days'][number];

export const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export type RuleEditorState = {
  name: string;
  plugId: string;
  sensorId: string;
  preset: RulePresetId;
  onThresholdInput: string;
  offThresholdInput: string;
  scheduleEnabled: boolean;
  days: Weekday[];
  start: string;
  end: string;
};

export type RuleEditorErrorKey = 'name' | 'plug' | 'sensor' | 'thresholds' | 'schedule';

export type RuleEditorErrors = Partial<
  Record<RuleEditorErrorKey, 'missing' | 'conflict' | 'invalid'>
>;

export const setupIntentForRule = (rule: AutomationRule): SetupIntent => {
  if (rule.kind === 'time') return 'time';
  return rule.config.rule.control.metric === 'humidity' ? 'humidity' : 'temperature';
};

const initialWindow = (
  rule: AutomationRule | null
): RuleSchedule['windows'][number] | null => {
  if (!rule) return null;
  const schedule = rule.kind === 'time' ? rule.config.schedule : rule.schedule;
  return schedule?.windows[0] ?? null;
};

const defaultPreset = (intent: SetupIntent): RulePresetId => {
  const preset = defaultRulePresetForSetupIntent(intent);
  return preset ?? 'heating';
};

export const createRuleEditorState = ({
  intent,
  rule,
  plugs,
  sensors
}: {
  intent: SetupIntent;
  rule: AutomationRule | null;
  plugs: readonly SavedPlug[];
  sensors: readonly SavedSensor[];
}): RuleEditorState => {
  const preset = rule?.kind === 'climate' ? rule.config.rule.mode : defaultPreset(intent);
  const defaults = defaultRuleForPreset(preset);
  const window = initialWindow(rule);
  return {
    name: rule?.name ?? '',
    plugId: rule?.plugId ?? plugs[0]?.id ?? '',
    sensorId: rule?.kind === 'climate' ? rule.sensorId : (sensors[0]?.id ?? ''),
    preset,
    onThresholdInput: String(
      rule?.kind === 'climate'
        ? rule.config.rule.control.onThreshold
        : defaults.control.onThreshold
    ),
    offThresholdInput: String(
      rule?.kind === 'climate'
        ? rule.config.rule.control.offThreshold
        : defaults.control.offThreshold
    ),
    scheduleEnabled:
      rule?.kind === 'time' || Boolean(rule?.kind === 'climate' && rule.schedule),
    days: window ? [...window.days] : [...ALL_WEEKDAYS],
    start: window?.start ?? '08:00',
    end: window?.end ?? '20:00'
  };
};

export const changeRuleEditorPreset = (
  state: RuleEditorState,
  preset: RulePresetId
): RuleEditorState => {
  const defaults = defaultRuleForPreset(preset);
  return {
    ...state,
    preset,
    onThresholdInput: String(defaults.control.onThreshold),
    offThresholdInput: String(defaults.control.offThreshold)
  };
};

const scheduleFromState = (state: RuleEditorState): RuleSchedule =>
  ruleScheduleSchema.parse({
    windows: [{ days: state.days, start: state.start, end: state.end }]
  });

export const validateRuleEditorState = ({
  state,
  intent,
  ruleId,
  plugs,
  sensors,
  rules
}: {
  state: RuleEditorState;
  intent: SetupIntent;
  ruleId: string | null;
  plugs: readonly SavedPlug[];
  sensors: readonly SavedSensor[];
  rules: readonly AutomationRule[];
}): RuleEditorErrors => {
  const errors: RuleEditorErrors = {};
  if (!state.name.trim()) errors.name = 'missing';
  if (!plugs.some((plug) => plug.id === state.plugId)) errors.plug = 'missing';
  else if (
    rules.some(
      (rule) => rule.id !== ruleId && rule.plugId === state.plugId && rule.relayId === 0
    )
  ) {
    errors.plug = 'conflict';
  }

  if (intent !== 'time') {
    if (!sensors.some((sensor) => sensor.id === state.sensorId))
      errors.sensor = 'missing';
    if (!rulePresetsForSetupIntent(intent).includes(state.preset))
      errors.thresholds = 'invalid';
    const onThreshold = Number(state.onThresholdInput);
    const offThreshold = Number(state.offThresholdInput);
    const direction = defaultRuleForPreset(state.preset).control.direction;
    const thresholdsValid =
      Number.isFinite(onThreshold) &&
      Number.isFinite(offThreshold) &&
      (direction === 'below' ? onThreshold < offThreshold : onThreshold > offThreshold);
    if (!thresholdsValid) errors.thresholds = 'invalid';
  }

  if (intent === 'time' || state.scheduleEnabled) {
    try {
      scheduleFromState(state);
    } catch {
      errors.schedule = 'invalid';
    }
  }
  return errors;
};

export type BuildDesiredRuleResult =
  { ok: true; value: AutomationRule } | { ok: false; errors: RuleEditorErrors };

export const buildDesiredRule = ({
  state,
  intent,
  existing,
  plugs,
  sensors,
  rules,
  newId,
  nowMs
}: {
  state: RuleEditorState;
  intent: SetupIntent;
  existing: AutomationRule | null;
  plugs: readonly SavedPlug[];
  sensors: readonly SavedSensor[];
  rules: readonly AutomationRule[];
  newId: string;
  nowMs: number;
}): BuildDesiredRuleResult => {
  const errors = validateRuleEditorState({
    state,
    intent,
    ruleId: existing?.id ?? null,
    plugs,
    sensors,
    rules
  });
  if (Object.keys(errors).length) return { ok: false, errors };

  const id = existing?.id ?? newId;
  const createdAtMs = existing?.createdAtMs ?? nowMs;
  const common = {
    version: 1 as const,
    id,
    name: state.name.trim(),
    plugId: state.plugId,
    relayId: 0 as const,
    deployment: null,
    createdAtMs,
    updatedAtMs: nowMs
  };

  if (intent === 'time') {
    return {
      ok: true,
      value: timeRuleSchema.parse({
        ...common,
        kind: 'time',
        config: { schedule: scheduleFromState(state) }
      })
    };
  }

  const sensor = sensors.find((candidate) => candidate.id === state.sensorId);
  if (!sensor) return { ok: false, errors: { sensor: 'missing' } };
  const base =
    existing?.kind === 'climate'
      ? existing.config
      : (() => {
          const config = createDefaultShellyThermostatConfig(
            sensor.profileId,
            state.preset
          );
          return { rule: config.rule, diagnostics: config.diagnostics };
        })();
  const presetRule = defaultRuleForPreset(state.preset);
  return {
    ok: true,
    value: climateRuleSchema.parse({
      ...common,
      kind: 'climate',
      sensorId: sensor.id,
      config: {
        ...base,
        rule: {
          ...base.rule,
          mode: state.preset,
          control: {
            ...presetRule.control,
            onThreshold: Number(state.onThresholdInput),
            offThreshold: Number(state.offThresholdInput)
          }
        }
      },
      schedule: state.scheduleEnabled ? scheduleFromState(state) : null
    })
  };
};

#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=88d37a265445d9a5de235aada1508e85d2d6ea65
cd "$REPO"
git fetch origin "$BRANCH" agent-control
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }
git checkout "$BRANCH"
git reset --hard "$REMOTE"
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

mkdir -p apps/mobile/src/screens/rules/editor

cat > apps/mobile/src/flows/rules/editor.ts <<'EOF'
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

export type RuleEditorErrorKey =
  | 'name'
  | 'plug'
  | 'sensor'
  | 'thresholds'
  | 'schedule';

export type RuleEditorErrors = Partial<Record<RuleEditorErrorKey, 'missing' | 'conflict' | 'invalid'>>;

export const setupIntentForRule = (rule: AutomationRule): SetupIntent => {
  if (rule.kind === 'time') return 'time';
  return rule.config.rule.control.metric === 'humidity' ? 'humidity' : 'temperature';
};

const initialWindow = (rule: AutomationRule | null): RuleSchedule['windows'][number] | null => {
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
      rule?.kind === 'climate' ? rule.config.rule.control.onThreshold : defaults.control.onThreshold
    ),
    offThresholdInput: String(
      rule?.kind === 'climate' ? rule.config.rule.control.offThreshold : defaults.control.offThreshold
    ),
    scheduleEnabled: rule?.kind === 'time' || Boolean(rule?.kind === 'climate' && rule.schedule),
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
    if (!sensors.some((sensor) => sensor.id === state.sensorId)) errors.sensor = 'missing';
    if (!rulePresetsForSetupIntent(intent).includes(state.preset)) errors.thresholds = 'invalid';
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
  | { ok: true; value: AutomationRule }
  | { ok: false; errors: RuleEditorErrors };

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
          const config = createDefaultShellyThermostatConfig(sensor.profileId, state.preset);
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
EOF

cat > apps/mobile/src/flows/rules/useRuleEditorFlow.ts <<'EOF'
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { RulePresetId } from '@lcl/automation-core';
import { usePlugStore, useRuleStore, useSensorStore } from '../registry/devicesAndRules.js';
import type { SetupIntent } from '../setup-intent.js';
import {
  buildDesiredRule,
  changeRuleEditorPreset,
  createRuleEditorState,
  setupIntentForRule,
  validateRuleEditorState,
  type RuleEditorState
} from './editor.js';
import { deployRule, redeployRule, saveRuleDraft } from './lifecycle.js';

const createRuleId = (): string => {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  return randomUuid ? `rule-${randomUuid}` : `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const useRuleEditorFlow = ({
  intent: requestedIntent,
  ruleId
}: {
  intent?: SetupIntent;
  ruleId?: string;
}) => {
  const plugs = usePlugStore((store) => store.items);
  const sensors = useSensorStore((store) => store.items);
  const rules = useRuleStore((store) => store.items);
  const existing = ruleId ? rules.find((rule) => rule.id === ruleId) ?? null : null;
  const intent = existing ? setupIntentForRule(existing) : (requestedIntent ?? null);
  const [newId] = useState(createRuleId);
  const [state, setState] = useState<RuleEditorState>(() =>
    createRuleEditorState({
      intent: intent ?? 'temperature',
      rule: existing,
      plugs,
      sensors
    })
  );

  useEffect(() => {
    setState((current) => {
      let next = current;
      if (!current.plugId && plugs[0]) next = { ...next, plugId: plugs[0].id };
      if (intent !== 'time' && !current.sensorId && sensors[0]) {
        next = { ...next, sensorId: sensors[0].id };
      }
      return next;
    });
  }, [intent, plugs, sensors]);

  const errors = useMemo(
    () =>
      intent
        ? validateRuleEditorState({
            state,
            intent,
            ruleId: existing?.id ?? null,
            plugs,
            sensors,
            rules
          })
        : { name: 'invalid' as const },
    [existing?.id, intent, plugs, rules, sensors, state]
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!intent) throw new Error('Rule editor intent is missing.');
      const result = buildDesiredRule({
        state,
        intent,
        existing,
        plugs,
        sensors,
        rules,
        newId,
        nowMs: Date.now()
      });
      if (!result.ok) throw new Error('Rule editor state is invalid.');
      if (existing?.deployment) return redeployRule(result.value);
      saveRuleDraft(result.value);
      return deployRule(result.value.id);
    }
  });

  const update = <K extends keyof RuleEditorState>(key: K, value: RuleEditorState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  const setPreset = (preset: RulePresetId) =>
    setState((current) => changeRuleEditorPreset(current, preset));

  const toggleDay = (day: RuleEditorState['days'][number]) =>
    setState((current) => ({
      ...current,
      days: current.days.includes(day)
        ? current.days.filter((candidate) => candidate !== day)
        : [...current.days, day].sort((a, b) => a - b)
    }));

  return {
    intent,
    existing,
    plugs,
    sensors,
    state,
    errors,
    save,
    canSubmit: Boolean(intent) && Object.keys(errors).length === 0 && !save.isPending,
    update,
    setPreset,
    toggleDay
  };
};
EOF

cat > apps/mobile/src/screens/rules/editor/RuleIdentityFields.tsx <<'EOF'
import type { RulePresetId } from '@lcl/automation-core';
import { useTranslation, type TranslationKey } from '../../../app/i18n.js';
import type { SavedPlug } from '../../../flows/devices/plugs/model.js';
import type { SavedSensor } from '../../../flows/devices/sensors/model.js';
import { rulePresetsForSetupIntent, type SetupIntent } from '../../../flows/setup-intent.js';
import type { RuleEditorErrors, RuleEditorState } from '../../../flows/rules/editor.js';

const presetLabel: Record<RulePresetId, TranslationKey> = {
  heating: 'hardware.rule.preset.heating',
  cooling: 'hardware.rule.preset.cooling',
  humidifying: 'hardware.rule.preset.humidifying',
  dehumidifying: 'hardware.rule.preset.dehumidifying'
};

type RuleIdentityFieldsProps = {
  intent: SetupIntent;
  state: RuleEditorState;
  errors: RuleEditorErrors;
  plugs: readonly SavedPlug[];
  sensors: readonly SavedSensor[];
  update<K extends keyof RuleEditorState>(key: K, value: RuleEditorState[K]): void;
  setPreset(preset: RulePresetId): void;
};

export const RuleIdentityFields = ({
  intent,
  state,
  errors,
  plugs,
  sensors,
  update,
  setPreset
}: RuleIdentityFieldsProps) => {
  const { t } = useTranslation();
  return (
    <>
      <label className={errors.name ? 'field field--invalid' : 'field'}>
        {t('hardware.shelly.nameLabel')}
        <input
          value={state.name}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => update('name', event.currentTarget.value)}
        />
        {errors.name && <span className="field__error">{t('common.missing')}</span>}
      </label>

      <label className={errors.plug ? 'field field--invalid' : 'field'}>
        {t('hardware.rule.selectedShelly')}
        <span className="select-control">
          <select
            value={state.plugId}
            aria-invalid={Boolean(errors.plug)}
            onChange={(event) => update('plugId', event.currentTarget.value)}
          >
            <option value="">{t('time.noDevice')}</option>
            {plugs.map((plug) => (
              <option key={plug.id} value={plug.id}>
                {plug.name}
              </option>
            ))}
          </select>
        </span>
        {errors.plug && <span className="field__error">{t('common.operationFailed')}</span>}
      </label>

      {intent !== 'time' && (
        <>
          <label className={errors.sensor ? 'field field--invalid' : 'field'}>
            {t('hardware.rule.selectedSensor')}
            <span className="select-control">
              <select
                value={state.sensorId}
                aria-invalid={Boolean(errors.sensor)}
                onChange={(event) => update('sensorId', event.currentTarget.value)}
              >
                <option value="">{t('hardware.flow.noSelectedSensor')}</option>
                {sensors.map((sensor) => (
                  <option key={sensor.id} value={sensor.id}>
                    {sensor.name}
                  </option>
                ))}
              </select>
            </span>
            {errors.sensor && <span className="field__error">{t('common.missing')}</span>}
          </label>

          <label className="field">
            {t('hardware.rule.ruleMode')}
            <span className="select-control">
              <select
                value={state.preset}
                onChange={(event) => setPreset(event.currentTarget.value as RulePresetId)}
              >
                {rulePresetsForSetupIntent(intent).map((preset) => (
                  <option key={preset} value={preset}>
                    {t(presetLabel[preset])}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </>
      )}
    </>
  );
};
EOF

cat > apps/mobile/src/screens/rules/editor/RuleThresholdFields.tsx <<'EOF'
import type { RulePresetId } from '@lcl/automation-core';
import { useTranslation, type TranslationKey } from '../../../app/i18n.js';
import type { RuleEditorErrors, RuleEditorState } from '../../../flows/rules/editor.js';

const thresholdCopy: Record<
  RulePresetId,
  { on: TranslationKey; off: TranslationKey }
> = {
  heating: {
    on: 'hardware.rule.thresholdOnBelowC',
    off: 'hardware.rule.thresholdOffAboveC'
  },
  cooling: {
    on: 'hardware.rule.thresholdOnAboveC',
    off: 'hardware.rule.thresholdOffBelowC'
  },
  humidifying: {
    on: 'hardware.rule.thresholdOnBelowPct',
    off: 'hardware.rule.thresholdOffAbovePct'
  },
  dehumidifying: {
    on: 'hardware.rule.thresholdOnAbovePct',
    off: 'hardware.rule.thresholdOffBelowPct'
  }
};

export const RuleThresholdFields = ({
  state,
  errors,
  update
}: {
  state: RuleEditorState;
  errors: RuleEditorErrors;
  update<K extends keyof RuleEditorState>(key: K, value: RuleEditorState[K]): void;
}) => {
  const { t } = useTranslation();
  const copy = thresholdCopy[state.preset];
  return (
    <div className="field-row">
      <label className={errors.thresholds ? 'field field--invalid' : 'field'}>
        {t(copy.on)}
        <input
          type="number"
          step="0.1"
          value={state.onThresholdInput}
          aria-invalid={Boolean(errors.thresholds)}
          onChange={(event) => update('onThresholdInput', event.currentTarget.value)}
        />
      </label>
      <label className={errors.thresholds ? 'field field--invalid' : 'field'}>
        {t(copy.off)}
        <input
          type="number"
          step="0.1"
          value={state.offThresholdInput}
          aria-invalid={Boolean(errors.thresholds)}
          onChange={(event) => update('offThresholdInput', event.currentTarget.value)}
        />
        {errors.thresholds && (
          <span className="field__error">{t('hardware.rule.thresholdInvalid')}</span>
        )}
      </label>
    </div>
  );
};
EOF

cat > apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx <<'EOF'
import { useTranslation } from '../../../app/i18n.js';
import type { SetupIntent } from '../../../flows/setup-intent.js';
import { ALL_WEEKDAYS, type RuleEditorErrors, type RuleEditorState } from '../../../flows/rules/editor.js';

const weekdayLabel = (day: RuleEditorState['days'][number]): string =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(
    new Date(Date.UTC(2026, 0, 4 + day))
  );

export const RuleScheduleFields = ({
  intent,
  state,
  errors,
  update,
  toggleDay
}: {
  intent: SetupIntent;
  state: RuleEditorState;
  errors: RuleEditorErrors;
  update<K extends keyof RuleEditorState>(key: K, value: RuleEditorState[K]): void;
  toggleDay(day: RuleEditorState['days'][number]): void;
}) => {
  const { t } = useTranslation();
  const enabled = intent === 'time' || state.scheduleEnabled;
  return (
    <section className="field-stack">
      {intent !== 'time' && (
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={state.scheduleEnabled}
            onChange={(event) => update('scheduleEnabled', event.currentTarget.checked)}
          />
          <span>{t('time.scheduleSummary')}</span>
        </label>
      )}

      {enabled && (
        <>
          <div className="action-row" aria-label={t('time.scheduleSummary')}>
            {ALL_WEEKDAYS.map((day) => (
              <button
                key={day}
                className="secondary-action"
                type="button"
                aria-pressed={state.days.includes(day)}
                onClick={() => toggleDay(day)}
              >
                {weekdayLabel(day)}
              </button>
            ))}
          </div>
          <div className="field-row">
            <label className={errors.schedule ? 'field field--invalid' : 'field'}>
              {t('time.onTime')}
              <input
                type="time"
                value={state.start}
                aria-invalid={Boolean(errors.schedule)}
                onChange={(event) => update('start', event.currentTarget.value)}
              />
            </label>
            <label className={errors.schedule ? 'field field--invalid' : 'field'}>
              {t('time.offTime')}
              <input
                type="time"
                value={state.end}
                aria-invalid={Boolean(errors.schedule)}
                onChange={(event) => update('end', event.currentTarget.value)}
              />
            </label>
          </div>
          {errors.schedule && (
            <span className="field__error">{t('time.validation.invalidTimes')}</span>
          )}
        </>
      )}
    </section>
  );
};
EOF

cat > apps/mobile/src/screens/rules/RuleEditorScreen.tsx <<'EOF'
import { useTranslation } from '../../app/i18n.js';
import type { SetupIntent } from '../../flows/setup-intent.js';
import { useRuleEditorFlow } from '../../flows/rules/useRuleEditorFlow.js';
import { RuleIdentityFields } from './editor/RuleIdentityFields.js';
import { RuleScheduleFields } from './editor/RuleScheduleFields.js';
import { RuleThresholdFields } from './editor/RuleThresholdFields.js';

type RuleEditorScreenProps = {
  intent?: SetupIntent;
  ruleId?: string;
  onCancel(): void;
  onComplete(ruleId: string): void;
};

export const RuleEditorScreen = ({
  intent,
  ruleId,
  onCancel,
  onComplete
}: RuleEditorScreenProps) => {
  const { t } = useTranslation();
  const flow = useRuleEditorFlow({ intent, ruleId });

  if (!flow.intent || (ruleId && !flow.existing)) {
    return (
      <main className="demo-shell hardware-shell app-bottom-nav-shell">
        <header className="demo-header app-page-header">
          <h1>{t('detail.notFoundTitle')}</h1>
        </header>
        <button className="secondary-action" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </main>
    );
  }

  const save = async () => {
    try {
      const rule = await flow.save.mutateAsync();
      onComplete(rule.id);
    } catch {
      // Mutation state keeps the failure visible and the draft editable.
    }
  };

  return (
    <main className="demo-shell hardware-shell app-bottom-nav-shell">
      <div className="setup-context">
        <button className="setup-context__back" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <strong>{t(`intent.${flow.intent}.context`)}</strong>
      </div>

      <section className="demo-panel" aria-label={t('hardware.nav.ruleTitle')}>
        <RuleIdentityFields
          intent={flow.intent}
          state={flow.state}
          errors={flow.errors}
          plugs={flow.plugs}
          sensors={flow.sensors}
          update={flow.update}
          setPreset={flow.setPreset}
        />

        {flow.intent !== 'time' && (
          <RuleThresholdFields state={flow.state} errors={flow.errors} update={flow.update} />
        )}

        <RuleScheduleFields
          intent={flow.intent}
          state={flow.state}
          errors={flow.errors}
          update={flow.update}
          toggleDay={flow.toggleDay}
        />

        {flow.save.isError && (
          <p className="field__error">{t('common.operationFailed')}</p>
        )}

        <div className="action-row">
          <button
            className="primary-action"
            type="button"
            disabled={!flow.canSubmit}
            aria-busy={flow.save.isPending}
            onClick={() => void save()}
          >
            {flow.save.isPending
              ? t('common.sending')
              : flow.existing
                ? t('time.detail.save')
                : flow.intent === 'time'
                  ? t('time.install')
                  : t('common.send')}
          </button>
        </div>
      </section>
    </main>
  );
};
EOF

cat > apps/mobile/src/flows/rules/editor.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import { climate, plug, sensor, time } from '../registry/fixtures.test-support.js';
import {
  buildDesiredRule,
  changeRuleEditorPreset,
  createRuleEditorState,
  validateRuleEditorState
} from './editor.js';

describe('rule editor model', () => {
  it('builds a climate rule from independent saved device references', () => {
    const state = {
      ...createRuleEditorState({ intent: 'temperature', rule: null, plugs: [plug], sensors: [sensor] }),
      name: 'Greenhouse heat'
    };
    const result = buildDesiredRule({
      state,
      intent: 'temperature',
      existing: null,
      plugs: [plug],
      sensors: [sensor],
      rules: [],
      newId: 'rule-new',
      nowMs: 10
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: 'rule-new',
      kind: 'climate',
      name: 'Greenhouse heat',
      plugId: plug.id,
      sensorId: sensor.id,
      deployment: null
    });
  });

  it('builds a time rule without a thermometer and keeps weekday selection', () => {
    const state = {
      ...createRuleEditorState({ intent: 'time', rule: null, plugs: [plug], sensors: [] }),
      name: 'Light timer',
      days: [1, 2, 3, 4, 5] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[]
    };
    const result = buildDesiredRule({
      state,
      intent: 'time',
      existing: null,
      plugs: [plug],
      sensors: [],
      rules: [],
      newId: 'time-new',
      nowMs: 20
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'time') return;
    expect(result.value.config.schedule.windows[0]?.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects another rule owning the same physical relay', () => {
    const state = {
      ...createRuleEditorState({ intent: 'time', rule: null, plugs: [plug], sensors: [] }),
      name: 'Conflict'
    };
    expect(
      validateRuleEditorState({
        state,
        intent: 'time',
        ruleId: null,
        plugs: [plug],
        sensors: [],
        rules: [climate]
      }).plug
    ).toBe('conflict');
  });

  it('resets thresholds when the climate mode changes and preserves advanced settings on edit', () => {
    const existing = {
      ...climate,
      config: {
        ...climate.config,
        rule: { ...climate.config.rule, rssiMin: -77 }
      }
    };
    const initial = createRuleEditorState({
      intent: 'temperature',
      rule: existing,
      plugs: [plug],
      sensors: [sensor]
    });
    const changed = changeRuleEditorPreset(initial, 'cooling');
    const result = buildDesiredRule({
      state: changed,
      intent: 'temperature',
      existing,
      plugs: [plug],
      sensors: [sensor],
      rules: [existing],
      newId: 'unused',
      nowMs: 30
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== 'climate') return;
    expect(result.value.config.rule.mode).toBe('cooling');
    expect(result.value.config.rule.rssiMin).toBe(-77);
  });

  it('loads existing time schedule into the editor', () => {
    const state = createRuleEditorState({ intent: 'time', rule: time, plugs: [plug], sensors: [] });
    expect(state).toMatchObject({ start: '08:00', end: '20:00', scheduleEnabled: true });
  });
});
EOF

cat > apps/mobile/src/__tests__/rule-editor.test.tsx <<'EOF'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { climate, plug, sensor } from '../flows/registry/fixtures.test-support.js';
import { usePlugStore, useRuleStore, useSensorStore } from '../flows/registry/devicesAndRules.js';
import type { AutomationRule } from '../flows/rules/model.js';

const lifecycleMocks = vi.hoisted(() => ({
  saveRuleDraft: vi.fn(),
  deployRule: vi.fn(),
  redeployRule: vi.fn()
}));

vi.mock('../flows/rules/lifecycle.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../flows/rules/lifecycle.js')>();
  return {
    ...actual,
    saveRuleDraft: lifecycleMocks.saveRuleDraft,
    deployRule: lifecycleMocks.deployRule,
    redeployRule: lifecycleMocks.redeployRule
  };
});

import { RuleEditorScreen } from '../screens/rules/RuleEditorScreen.js';

const renderEditor = (props: { intent?: 'temperature' | 'humidity' | 'time'; ruleId?: string }) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onComplete = vi.fn();
  render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <RuleEditorScreen {...props} onCancel={vi.fn()} onComplete={onComplete} />
      </QueryClientProvider>
    </I18nProvider>
  );
  return { onComplete };
};

const resetStores = () => {
  usePlugStore.setState({ items: [], loadError: null });
  useSensorStore.setState({ items: [], loadError: null });
  useRuleStore.setState({ items: [], loadError: null });
};

describe('RuleEditorScreen', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    resetStores();
    lifecycleMocks.saveRuleDraft.mockReset();
    lifecycleMocks.deployRule.mockReset();
    lifecycleMocks.redeployRule.mockReset();
    lifecycleMocks.saveRuleDraft.mockImplementation((rule: AutomationRule) => rule);
    lifecycleMocks.deployRule.mockImplementation(async (id: string) =>
      useRuleStore.getState().items.find((rule) => rule.id === id)
    );
    lifecycleMocks.redeployRule.mockImplementation(async (rule: AutomationRule) => rule);
  });

  it('creates and deploys a climate rule using saved plug and thermometer registries', async () => {
    usePlugStore.setState({ items: [plug], loadError: null });
    useSensorStore.setState({ items: [sensor], loadError: null });
    lifecycleMocks.saveRuleDraft.mockImplementation((rule: AutomationRule) => {
      useRuleStore.setState({ items: [rule], loadError: null });
      return rule;
    });
    const { onComplete } = renderEditor({ intent: 'temperature' });
    fireEvent.change(screen.getByLabelText('Nazwa'), { target: { value: 'Grzanie szklarni' } });
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }));
    await waitFor(() => expect(lifecycleMocks.saveRuleDraft).toHaveBeenCalledTimes(1));
    const desired = lifecycleMocks.saveRuleDraft.mock.calls[0]?.[0] as AutomationRule;
    expect(desired).toMatchObject({
      kind: 'climate',
      name: 'Grzanie szklarni',
      plugId: plug.id,
      sensorId: sensor.id
    });
    expect(lifecycleMocks.deployRule).toHaveBeenCalledWith(desired.id);
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(desired.id));
  });

  it('creates a time rule without requiring a thermometer', async () => {
    usePlugStore.setState({ items: [plug], loadError: null });
    lifecycleMocks.saveRuleDraft.mockImplementation((rule: AutomationRule) => {
      useRuleStore.setState({ items: [rule], loadError: null });
      return rule;
    });
    renderEditor({ intent: 'time' });
    fireEvent.change(screen.getByLabelText('Nazwa'), { target: { value: 'Lampy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz harmonogram w Shelly' }));
    await waitFor(() => expect(lifecycleMocks.deployRule).toHaveBeenCalledTimes(1));
    const desired = lifecycleMocks.saveRuleDraft.mock.calls[0]?.[0] as AutomationRule;
    expect(desired.kind).toBe('time');
  });

  it('redeploys an existing deployed rule instead of creating a second rule', async () => {
    const deployed = {
      ...climate,
      deployment: {
        scriptId: 7,
        scriptHash: 'hash',
        safetyTest: { status: 'verified' as const, verifiedAtMs: 4 }
      }
    };
    usePlugStore.setState({ items: [plug], loadError: null });
    useSensorStore.setState({ items: [sensor], loadError: null });
    useRuleStore.setState({ items: [deployed], loadError: null });
    renderEditor({ ruleId: deployed.id });
    fireEvent.change(screen.getByLabelText('Nazwa'), { target: { value: 'Nowa nazwa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));
    await waitFor(() => expect(lifecycleMocks.redeployRule).toHaveBeenCalledTimes(1));
    expect(lifecycleMocks.saveRuleDraft).not.toHaveBeenCalled();
    expect(lifecycleMocks.deployRule).not.toHaveBeenCalled();
    expect(lifecycleMocks.redeployRule.mock.calls[0]?.[0]).toMatchObject({
      id: deployed.id,
      name: 'Nowa nazwa',
      deployment: null
    });
  });
});
EOF

python3 - <<'PY'
from pathlib import Path

# Route normal product setup/edit through RuleEditorScreen, not HardwareSetupScreen.
p = Path('apps/mobile/src/routes/AppRoutes.tsx')
s = p.read_text()
s = s.replace(
"import { RuleDetailScreen } from '../screens/rules/RuleDetailScreen.js';\n\nconst HardwareSetupScreen = lazy(async () => {\n  const module = await import('../screens/hardware-setup/HardwareSetupScreen.js');\n  return { default: module.HardwareSetupScreen };\n});",
"import { RuleDetailScreen } from '../screens/rules/RuleDetailScreen.js';\nimport { RuleEditorScreen } from '../screens/rules/RuleEditorScreen.js';"
)
s = s.replace("import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';", "import { Suspense, useCallback, useEffect, useRef, useState } from 'react';")
s = s.replace("  | { type: 'rule'; ruleId: string };", "  | { type: 'rule'; ruleId: string }\n  | { type: 'rule-edit'; ruleId: string };")
s = s.replace(
"    case 'setup':\n      return { type: 'intent' };\n    case 'rule':",
"    case 'setup':\n      return { type: 'intent' };\n    case 'rule-edit':\n      return { type: 'rule', ruleId: route.ruleId };\n    case 'rule':"
)
s = s.replace(
"          <RuleDetailScreen\n            ruleId={route.ruleId}\n            onBack={() => navigate({ type: 'dashboard' })}\n          />",
"          <RuleDetailScreen\n            ruleId={route.ruleId}\n            onBack={() => navigate({ type: 'dashboard' })}\n            onEdit={() => navigate({ type: 'rule-edit', ruleId: route.ruleId })}\n          />"
)
s = s.replace(
"      case 'setup':\n        return (\n          <HardwareSetupScreen\n            setupIntent={route.intent}\n            onBackToIntent={() => navigate({ type: 'intent' })}\n            onSetupComplete={() => navigate({ type: 'dashboard' })}\n          />\n        );",
"      case 'setup':\n        return (\n          <RuleEditorScreen\n            intent={route.intent}\n            onCancel={() => navigate({ type: 'intent' })}\n            onComplete={(ruleId) => navigate({ type: 'rule', ruleId })}\n          />\n        );\n      case 'rule-edit':\n        return (\n          <RuleEditorScreen\n            ruleId={route.ruleId}\n            onCancel={() => navigate({ type: 'rule', ruleId: route.ruleId })}\n            onComplete={(ruleId) => navigate({ type: 'rule', ruleId })}\n          />\n        );"
)
p.write_text(s)

# Add edit callback/action to rule detail.
p = Path('apps/mobile/src/screens/rules/RuleDetailScreen.tsx')
s = p.read_text()
s = s.replace(
"type RuleDetailScreenProps = {\n  ruleId: string;\n  onBack(): void;\n};\n\nexport const RuleDetailScreen = ({ ruleId, onBack }: RuleDetailScreenProps) => {",
"type RuleDetailScreenProps = {\n  ruleId: string;\n  onBack(): void;\n  onEdit?(): void;\n};\n\nexport const RuleDetailScreen = ({ ruleId, onBack, onEdit }: RuleDetailScreenProps) => {"
)
anchor = "        <article className=\"automation-card rule-detail-card\">\n          <button\n            className=\"secondary-action secondary-action--danger\""
replacement = "        <article className=\"automation-card rule-detail-card\">\n          {onEdit && (\n            <button className=\"secondary-action\" type=\"button\" onClick={onEdit}>\n              {t('common.edit')}\n            </button>\n          )}\n          <button\n            className=\"secondary-action secondary-action--danger\""
if anchor not in s:
    raise SystemExit('RuleDetail edit anchor missing')
s = s.replace(anchor, replacement, 1)
p.write_text(s)

# Add common.edit to every locale without changing the rest of the message schema.
translations = {
  'pl.ts': 'Edytuj',
  'en.ts': 'Edit',
  'de.ts': 'Bearbeiten',
  'es.ts': 'Editar',
  'fr.ts': 'Modifier',
  'it.ts': 'Modifica',
  'ptBr.ts': 'Editar'
}
for filename, label in translations.items():
    p = Path('apps/mobile/src/app/locales') / filename
    s = p.read_text()
    old = "    delete: '"
    idx = s.find(old, s.find('  common: {'))
    if idx == -1:
        raise SystemExit(f'common.delete anchor missing in {filename}')
    line_end = s.find('\n', idx)
    s = s[:line_end+1] + f"    edit: '{label}',\n" + s[line_end+1:]
    p.write_text(s)

# Update AppRoutes test mock to the new editor and expose edit navigation from detail.
p = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
s = p.read_text()
s = s.replace(
"  RuleDetailScreen: ({ ruleId, onBack }: { ruleId: string; onBack: () => void }) => (\n    <section>\n      <p>{`mock-rule-${ruleId}`}</p>\n      <button type=\"button\" onClick={onBack}>\n        mock-dashboard-back\n      </button>\n    </section>\n  )",
"  RuleDetailScreen: ({\n    ruleId,\n    onBack,\n    onEdit\n  }: {\n    ruleId: string;\n    onBack: () => void;\n    onEdit?: () => void;\n  }) => (\n    <section>\n      <p>{`mock-rule-${ruleId}`}</p>\n      <button type=\"button\" onClick={onBack}>\n        mock-dashboard-back\n      </button>\n      <button type=\"button\" onClick={onEdit}>\n        mock-edit-rule\n      </button>\n    </section>\n  )"
)
start = s.find("vi.mock('../screens/hardware-setup/HardwareSetupScreen.js'")
if start == -1:
    raise SystemExit('HardwareSetupScreen mock anchor missing')
end = s.find("\n\nimport { AppRoutes }", start)
if end == -1:
    raise SystemExit('HardwareSetupScreen mock end missing')
new_mock = '''vi.mock('../screens/rules/RuleEditorScreen.js', () => ({
  RuleEditorScreen: ({
    intent,
    ruleId,
    onCancel,
    onComplete
  }: {
    intent?: SetupIntent;
    ruleId?: string;
    onCancel: () => void;
    onComplete: (ruleId: string) => void;
  }) => (
    <section>
      <p>{ruleId ? `mock-edit-${ruleId}` : `mock-setup-${intent ?? 'none'}`}</p>
      <button type="button" onClick={onCancel}>
        mock-back
      </button>
      <button type="button" onClick={() => onComplete(ruleId ?? 'created-rule')}>
        mock-complete
      </button>
    </section>
  )
}));'''
s = s[:start] + new_mock + s[end:]
# Add route-level edit assertion after existing rule detail test if not present.
needle = "    expect(screen.getByText(`mock-rule-${rule.id}`)).toBeVisible();\n"
if needle in s and "mock-edit-rule" not in s[s.find("it('opens a saved rule"):]:
    s = s.replace(
        needle,
        needle + "    fireEvent.click(screen.getByRole('button', { name: 'mock-edit-rule' }));\n    expect(screen.getByText(`mock-edit-${rule.id}`)).toBeVisible();\n    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));\n    expect(screen.getByText(`mock-rule-${rule.id}`)).toBeVisible();\n",
        1
    )
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/rules/editor.ts \
  apps/mobile/src/flows/rules/editor.test.ts \
  apps/mobile/src/flows/rules/useRuleEditorFlow.ts \
  apps/mobile/src/screens/rules/editor/RuleIdentityFields.tsx \
  apps/mobile/src/screens/rules/editor/RuleThresholdFields.tsx \
  apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx \
  apps/mobile/src/screens/rules/RuleEditorScreen.tsx \
  apps/mobile/src/screens/rules/RuleDetailScreen.tsx \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/__tests__/rule-editor.test.tsx \
  apps/mobile/src/__tests__/app-routes.test.tsx \
  apps/mobile/src/app/locales/*.ts

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/rules/editor.test.ts \
  src/flows/rules/draft.test.ts \
  src/flows/rules/lifecycle.test.ts \
  src/__tests__/rule-editor.test.tsx \
  src/__tests__/rule-detail.test.tsx \
  src/__tests__/automation-dashboard.test.tsx \
  src/__tests__/app-routes.test.tsx
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add \
  apps/mobile/src/flows/rules/editor.ts \
  apps/mobile/src/flows/rules/editor.test.ts \
  apps/mobile/src/flows/rules/useRuleEditorFlow.ts \
  apps/mobile/src/screens/rules/editor/RuleIdentityFields.tsx \
  apps/mobile/src/screens/rules/editor/RuleThresholdFields.tsx \
  apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx \
  apps/mobile/src/screens/rules/RuleEditorScreen.tsx \
  apps/mobile/src/screens/rules/RuleDetailScreen.tsx \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/__tests__/rule-editor.test.tsx \
  apps/mobile/src/__tests__/app-routes.test.tsx \
  apps/mobile/src/app/locales/*.ts

git commit -m 'Cut over rule creation and editing'
HEAD=$(git rev-parse HEAD)
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$EXPECTED" ]] || { echo 'Remote moved during rule editor task'; exit 4; }
git push origin "$HEAD:$BRANCH"
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$HEAD" ]] || { echo 'Push verification failed'; exit 5; }
echo "FINAL_HEAD=$HEAD"

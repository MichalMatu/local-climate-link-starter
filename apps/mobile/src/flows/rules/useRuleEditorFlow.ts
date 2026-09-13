import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { RulePresetId } from '@lcl/automation-core';
import {
  usePlugStore,
  useRuleStore,
  useSensorStore
} from '../registry/devicesAndRules.js';
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
  return randomUuid
    ? `rule-${randomUuid}`
    : `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  const existing = ruleId ? (rules.find((rule) => rule.id === ruleId) ?? null) : null;
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

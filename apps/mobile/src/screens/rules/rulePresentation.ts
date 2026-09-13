import type { AutomationRule, RuleSchedule } from '../../flows/rules/model.js';

export const ruleContextKey = (rule: AutomationRule) => {
  if (rule.kind === 'time') return 'intent.time.context' as const;
  return rule.config.rule.control.metric === 'humidity'
    ? ('intent.humidity.context' as const)
    : ('intent.temperature.context' as const);
};

export const ruleThresholdSummary = (rule: AutomationRule): string | null => {
  if (rule.kind !== 'climate') return null;
  const unit = rule.config.rule.control.metric === 'humidity' ? '%' : '°C';
  const { onThreshold, offThreshold } = rule.config.rule.control;
  return `${onThreshold}${unit} / ${offThreshold}${unit}`;
};

export const ruleScheduleSummary = (schedule: RuleSchedule | null): string | null => {
  if (!schedule) return null;
  return schedule.windows.map((window) => `${window.start}–${window.end}`).join(', ');
};

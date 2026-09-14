import type { SensorRuleUsage } from '../../flows/devices/sensors/usage.js';

type SensorRuleUsageListProps = {
  label: string;
  usages: readonly SensorRuleUsage[];
  onOpenRule?(ruleId: string): void;
};

export const SensorRuleUsageList = ({
  label,
  usages,
  onOpenRule
}: SensorRuleUsageListProps) => {
  if (usages.length === 0) return null;
  return (
    <div className="field-stack">
      <strong>{label}</strong>
      {usages.map((usage) =>
        onOpenRule ? (
          <button
            key={usage.ruleId}
            className="secondary-action"
            type="button"
            onClick={() => onOpenRule(usage.ruleId)}
          >
            {usage.ruleName} → {usage.plugName}
          </button>
        ) : (
          <span key={usage.ruleId}>
            {usage.ruleName} → {usage.plugName}
          </span>
        )
      )}
    </div>
  );
};

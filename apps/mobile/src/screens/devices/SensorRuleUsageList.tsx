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
    <div className="sensor-rule-usage">
      <strong>{label}</strong>
      {usages.map((usage) =>
        onOpenRule ? (
          <button
            key={usage.ruleId}
            className="sensor-rule-usage__link"
            type="button"
            onClick={() => onOpenRule(usage.ruleId)}
          >
            <span>{usage.ruleName}</span>
            <small>{usage.plugName}</small>
          </button>
        ) : (
          <span key={usage.ruleId}>
            <span>{usage.ruleName}</span>
            <small>{usage.plugName}</small>
          </span>
        )
      )}
    </div>
  );
};

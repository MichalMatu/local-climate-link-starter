import type { SavedPlug } from '../plugs/model.js';
import type { AutomationRule } from '../../rules/model.js';
import type { SavedSensor } from './model.js';

export type SensorRuleUsage = {
  ruleId: string;
  ruleName: string;
  plugId: string;
  plugName: string;
};

export type SensorRuleUsageById = Record<string, SensorRuleUsage[]>;

export const buildSensorRuleUsageById = (
  sensors: readonly SavedSensor[],
  rules: readonly AutomationRule[],
  plugs: readonly SavedPlug[]
): SensorRuleUsageById => {
  const plugNames = new Map(plugs.map((plug) => [plug.id, plug.name]));
  const usageById: SensorRuleUsageById = Object.fromEntries(
    sensors.map((sensor) => [sensor.id, []])
  );

  for (const rule of rules) {
    if (rule.kind !== 'climate') continue;
    const usages = usageById[rule.sensorId];
    if (!usages) continue;
    usages.push({
      ruleId: rule.id,
      ruleName: rule.name,
      plugId: rule.plugId,
      plugName: plugNames.get(rule.plugId) ?? rule.plugId
    });
  }

  return usageById;
};

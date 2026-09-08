import type { RulePresetId } from '@lcl/automation-core';

export type SetupIntent = 'temperature' | 'humidity' | 'time' | 'manage';

const TEMPERATURE_PRESETS: readonly RulePresetId[] = ['heating', 'cooling'];
const HUMIDITY_PRESETS: readonly RulePresetId[] = ['humidifying', 'dehumidifying'];
const ALL_PRESETS: readonly RulePresetId[] = [
  ...TEMPERATURE_PRESETS,
  ...HUMIDITY_PRESETS
];

export const rulePresetsForSetupIntent = (
  intent: SetupIntent | null | undefined
): readonly RulePresetId[] => {
  switch (intent) {
    case 'temperature':
      return TEMPERATURE_PRESETS;
    case 'humidity':
      return HUMIDITY_PRESETS;
    case 'time':
    case 'manage':
    case null:
    case undefined:
      return ALL_PRESETS;
  }
};

export const defaultRulePresetForSetupIntent = (
  intent: SetupIntent
): RulePresetId | null => {
  switch (intent) {
    case 'temperature':
      return 'heating';
    case 'humidity':
      return 'humidifying';
    case 'time':
    case 'manage':
      return null;
  }
};

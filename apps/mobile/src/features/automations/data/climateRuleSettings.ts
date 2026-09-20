export type RuleAdvancedSettingsInput = {
  vpdAssistEnabled: boolean;
  vpdTargetInput: string;
  rssiMinInput: string;
  staleTimeoutMinInput: string;
  minChangeMinInput: string;
  maxOnHoursInput: string;
};

export type RuleAdvancedSettingsValidation = {
  isVpdTargetValid: boolean;
  isRssiMinValid: boolean;
  isStaleTimeoutValid: boolean;
  isMinChangeMinValid: boolean;
  isMaxOnHoursValid: boolean;
  isValid: boolean;
};

export const DEFAULT_RULE_ADVANCED_SETTINGS: RuleAdvancedSettingsInput = {
  vpdAssistEnabled: false,
  vpdTargetInput: '1.2',
  rssiMinInput: '-85',
  staleTimeoutMinInput: '2',
  minChangeMinInput: '2',
  maxOnHoursInput: '4'
};

export const RULE_ADVANCED_LIMITS = {
  vpdTargetMin: 0.1,
  vpdTargetMax: 5,
  rssiMinMin: -100,
  rssiMinMax: -20,
  staleTimeoutMinMin: 1,
  staleTimeoutMinMax: 120,
  minChangeMinMin: 0.25,
  minChangeMinMax: 60,
  maxOnHoursMin: 0.25,
  maxOnHoursMax: 24
} as const;

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

const isInRange = (value: number, min: number, max: number): boolean =>
  isFiniteNumber(value) && value >= min && value <= max;

const isIntegerInRange = (value: number, min: number, max: number): boolean =>
  Number.isInteger(value) && value >= min && value <= max;

export const validateRuleAdvancedSettings = (
  input: RuleAdvancedSettingsInput
): RuleAdvancedSettingsValidation => {
  const vpdTarget = Number(input.vpdTargetInput);
  const rssiMin = Number(input.rssiMinInput);
  const staleTimeoutMin = Number(input.staleTimeoutMinInput);
  const minChangeMin = Number(input.minChangeMinInput);
  const maxOnHours = Number(input.maxOnHoursInput);

  const isVpdTargetValid =
    !input.vpdAssistEnabled ||
    isInRange(
      vpdTarget,
      RULE_ADVANCED_LIMITS.vpdTargetMin,
      RULE_ADVANCED_LIMITS.vpdTargetMax
    );
  const isRssiMinValid = isIntegerInRange(
    rssiMin,
    RULE_ADVANCED_LIMITS.rssiMinMin,
    RULE_ADVANCED_LIMITS.rssiMinMax
  );
  const isStaleTimeoutValid = isIntegerInRange(
    staleTimeoutMin,
    RULE_ADVANCED_LIMITS.staleTimeoutMinMin,
    RULE_ADVANCED_LIMITS.staleTimeoutMinMax
  );
  const isMinChangeMinValid = isInRange(
    minChangeMin,
    RULE_ADVANCED_LIMITS.minChangeMinMin,
    RULE_ADVANCED_LIMITS.minChangeMinMax
  );
  const isMaxOnHoursValid = isInRange(
    maxOnHours,
    RULE_ADVANCED_LIMITS.maxOnHoursMin,
    RULE_ADVANCED_LIMITS.maxOnHoursMax
  );

  return {
    isVpdTargetValid,
    isRssiMinValid,
    isStaleTimeoutValid,
    isMinChangeMinValid,
    isMaxOnHoursValid,
    isValid:
      isVpdTargetValid &&
      isRssiMinValid &&
      isStaleTimeoutValid &&
      isMinChangeMinValid &&
      isMaxOnHoursValid
  };
};

export const parseRuleAdvancedSettings = (input: RuleAdvancedSettingsInput) => ({
  vpdTargetKpa: Number(input.vpdTargetInput),
  rssiMin: Math.trunc(Number(input.rssiMinInput)),
  staleTimeoutSec: Math.round(Number(input.staleTimeoutMinInput) * 60),
  minChangeMs: Math.round(Number(input.minChangeMinInput) * 60 * 1000),
  maxOnMs: Math.round(Number(input.maxOnHoursInput) * 60 * 60 * 1000)
});

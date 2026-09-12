import { defaultRuleForPreset, type RulePresetId } from '@lcl/automation-core';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import { t } from '../../app/i18n.js';
import {
  parseRuleAdvancedSettings,
  validateRuleAdvancedSettings
} from './ruleAdvancedSettings.js';
import type { SensorDraftDevice } from './setupDraftStore.js';
import {
  formatSensorId,
  normalizeRuntimeAddress,
  normalizeShellyUrl,
  toNumberOrFallback
} from './validation.js';

export type ShellyInputState =
  | { ok: true; baseUrl: string; name: string }
  | { ok: false; fieldErrors: { name?: string; url?: string } };

export type SensorInputState =
  | { ok: true; device: SensorDraftDevice }
  | { ok: false; fieldErrors: { name?: string; mac?: string } };

export type ClimateConfigState =
  | { ok: true; config: ShellyThermostatConfig; script: string }
  | { ok: false; error: string };

type AdvancedRuleInputs = {
  vpdAssistEnabled: boolean;
  vpdTargetInput: string;
  rssiMinInput: string;
  staleTimeoutMinInput: string;
  minChangeMinInput: string;
  maxOnHoursInput: string;
};

type ClimateRuleDerivationInput = AdvancedRuleInputs & {
  selectedSensor: SensorDraftDevice | null;
  rulePreset: RulePresetId;
  onThresholdInput: string;
  offThresholdInput: string;
};

export const deriveShellyInputState = ({
  shellyNameInput,
  shellyUrlInput
}: {
  shellyNameInput: string;
  shellyUrlInput: string;
}): ShellyInputState => {
  const fieldErrors: { name?: string; url?: string } = {};
  const name = shellyNameInput.trim();
  if (name.length === 0) {
    fieldErrors.name = t('hardware.validation.shellyNameRequired');
  }

  let baseUrl = '';
  try {
    baseUrl = normalizeShellyUrl(shellyUrlInput);
  } catch (error) {
    fieldErrors.url =
      error instanceof Error ? error.message : t('hardware.validation.shellyIpFormat');
  }

  return fieldErrors.name || fieldErrors.url
    ? { ok: false, fieldErrors }
    : { ok: true, baseUrl, name };
};

export const deriveSensorInputState = ({
  sensorMacInput,
  sensorNameInput,
  sensorProfileInput
}: {
  sensorMacInput: string;
  sensorNameInput: string;
  sensorProfileInput: SensorDraftDevice['profileId'];
}): SensorInputState => {
  const fieldErrors: { name?: string; mac?: string } = {};
  const name = sensorNameInput.trim();
  if (name.length === 0) {
    fieldErrors.name = t('hardware.validation.sensorNameRequired');
  }

  let runtimeAddress = '';
  if (sensorMacInput.trim().length === 0) {
    fieldErrors.mac = t('hardware.validation.sensorMacRequired');
  } else {
    try {
      runtimeAddress = normalizeRuntimeAddress(sensorMacInput);
    } catch (error) {
      fieldErrors.mac =
        error instanceof Error ? error.message : t('hardware.validation.sensorMacFormat');
    }
  }

  if (fieldErrors.name || fieldErrors.mac) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    device: {
      id: runtimeAddress,
      name,
      runtimeAddress,
      profileId: sensorProfileInput
    }
  };
};

export const deriveClimateRuleState = ({
  selectedSensor,
  rulePreset,
  onThresholdInput,
  offThresholdInput,
  vpdAssistEnabled,
  vpdTargetInput,
  rssiMinInput,
  staleTimeoutMinInput,
  minChangeMinInput,
  maxOnHoursInput
}: ClimateRuleDerivationInput) => {
  const advancedInputs: AdvancedRuleInputs = {
    vpdAssistEnabled,
    vpdTargetInput,
    rssiMinInput,
    staleTimeoutMinInput,
    minChangeMinInput,
    maxOnHoursInput
  };
  const advancedSettingsValidation = validateRuleAdvancedSettings(advancedInputs);

  let configState: ClimateConfigState;
  try {
    if (!selectedSensor) {
      throw new Error(t('hardware.flow.noSelectedSensor'));
    }
    if (!advancedSettingsValidation.isValid) {
      throw new Error(t('hardware.flow.advancedOptionsInvalid'));
    }

    const base = createDefaultShellyThermostatConfig(
      selectedSensor.profileId,
      rulePreset
    );
    const advancedSettings = parseRuleAdvancedSettings(advancedInputs);
    const config: ShellyThermostatConfig = {
      ...base,
      sensor: {
        ...base.sensor,
        sensorId: formatSensorId(selectedSensor.profileId, selectedSensor.runtimeAddress),
        runtimeAddress: selectedSensor.runtimeAddress,
        displayName: selectedSensor.name
      },
      rule: {
        ...base.rule,
        control: {
          ...base.rule.control,
          onThreshold: toNumberOrFallback(
            onThresholdInput,
            base.rule.control.onThreshold
          ),
          offThreshold: toNumberOrFallback(
            offThresholdInput,
            base.rule.control.offThreshold
          )
        },
        vpdAssist: {
          enabled: vpdAssistEnabled,
          targetKpa: advancedSettings.vpdTargetKpa
        },
        staleTimeoutSec: advancedSettings.staleTimeoutSec,
        minChangeMs: advancedSettings.minChangeMs,
        maxOnMs: advancedSettings.maxOnMs,
        rssiMin: advancedSettings.rssiMin
      }
    };

    configState = {
      ok: true,
      config,
      script: generateShellyThermostatScript(config)
    };
  } catch (error) {
    configState = {
      ok: false,
      error: error instanceof Error ? error.message : t('hardware.flow.configInvalid')
    };
  }

  const onThreshold = Number(onThresholdInput);
  const offThreshold = Number(offThresholdInput);
  const direction = defaultRuleForPreset(rulePreset).control.direction;
  const isThresholdValid =
    Number.isFinite(onThreshold) &&
    Number.isFinite(offThreshold) &&
    (direction === 'below' ? onThreshold < offThreshold : onThreshold > offThreshold);

  return {
    advancedSettingsValidation,
    configState,
    isThresholdValid,
    isVpdAssistValid: advancedSettingsValidation.isVpdTargetValid
  };
};

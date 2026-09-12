#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='4b8d309bd5db225c69931ccef0ab7ca613888993'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

cat > apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.ts <<'EOF'
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
        error instanceof Error
          ? error.message
          : t('hardware.validation.sensorMacFormat');
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

    const base = createDefaultShellyThermostatConfig(selectedSensor.profileId, rulePreset);
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
EOF

cat > apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import {
  deriveClimateRuleState,
  deriveSensorInputState,
  deriveShellyInputState
} from './ruleConfigDerivation.js';

const advancedDefaults = {
  vpdAssistEnabled: false,
  vpdTargetInput: '1.2',
  rssiMinInput: '-85',
  staleTimeoutMinInput: '2',
  minChangeMinInput: '2',
  maxOnHoursInput: '4'
};

const sensor = {
  id: 'A4:C1:38:4F:24:CD',
  name: 'Salon',
  runtimeAddress: 'A4:C1:38:4F:24:CD',
  profileId: 'xiaomi_lywsd03mmc_bthome_v2' as const
};

describe('hardware setup derivation', () => {
  it('normalizes valid Shelly and sensor draft inputs', () => {
    expect(
      deriveShellyInputState({
        shellyNameInput: '  Salon  ',
        shellyUrlInput: '192.168.1.20'
      })
    ).toEqual({ ok: true, baseUrl: 'http://192.168.1.20/', name: 'Salon' });

    expect(
      deriveSensorInputState({
        sensorMacInput: 'a4-c1-38-4f-24-cd',
        sensorNameInput: '  Termometr  ',
        sensorProfileInput: sensor.profileId
      })
    ).toEqual({
      ok: true,
      device: {
        id: 'A4:C1:38:4F:24:CD',
        name: 'Termometr',
        runtimeAddress: 'A4:C1:38:4F:24:CD',
        profileId: sensor.profileId
      }
    });
  });

  it('keeps field validation separate from flow orchestration', () => {
    const shelly = deriveShellyInputState({ shellyNameInput: '', shellyUrlInput: '' });
    const thermometer = deriveSensorInputState({
      sensorMacInput: '',
      sensorNameInput: '',
      sensorProfileInput: sensor.profileId
    });

    expect(shelly.ok).toBe(false);
    expect(thermometer.ok).toBe(false);
    if (!shelly.ok) {
      expect(shelly.fieldErrors.name).toBeTruthy();
      expect(shelly.fieldErrors.url).toBeTruthy();
    }
    if (!thermometer.ok) {
      expect(thermometer.fieldErrors.name).toBeTruthy();
      expect(thermometer.fieldErrors.mac).toBeTruthy();
    }
  });

  it('derives climate configuration and threshold direction without React state', () => {
    const heating = deriveClimateRuleState({
      selectedSensor: sensor,
      rulePreset: 'heating',
      onThresholdInput: '19',
      offThresholdInput: '20',
      ...advancedDefaults
    });
    expect(heating.isThresholdValid).toBe(true);
    expect(heating.configState.ok).toBe(true);
    if (heating.configState.ok) {
      expect(heating.configState.config.sensor.runtimeAddress).toBe(sensor.runtimeAddress);
      expect(heating.configState.config.rule.control.onThreshold).toBe(19);
      expect(heating.configState.script.length).toBeGreaterThan(0);
    }

    const cooling = deriveClimateRuleState({
      selectedSensor: sensor,
      rulePreset: 'cooling',
      onThresholdInput: '27',
      offThresholdInput: '25',
      ...advancedDefaults
    });
    expect(cooling.isThresholdValid).toBe(true);
  });

  it('blocks configuration when advanced settings are invalid', () => {
    const result = deriveClimateRuleState({
      selectedSensor: sensor,
      rulePreset: 'heating',
      onThresholdInput: '19',
      offThresholdInput: '20',
      ...advancedDefaults,
      vpdAssistEnabled: true,
      vpdTargetInput: '9'
    });

    expect(result.isVpdAssistValid).toBe(false);
    expect(result.configState.ok).toBe(false);
  });
});
EOF

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s=p.read_text()
s=s.replace("import { defaultRuleForPreset, type RulePresetId } from '@lcl/automation-core';", "import type { RulePresetId } from '@lcl/automation-core';")
s=s.replace("""import {
  createDefaultShellyThermostatConfig,
  decodeShellyThermostatScript,
  generateShellyThermostatScript,
  type DecodedShellyThermostatScript,
  type ShellyThermostatConfig
} from '@lcl/script-generator';""", """import {
  decodeShellyThermostatScript,
  type DecodedShellyThermostatScript
} from '@lcl/script-generator';""")
s=s.replace("""import {
  createIpv4RangeScanUrls,
  formatSensorId,
  normalizeRuntimeAddress,
  normalizeShellyUrl,
  toNumberOrFallback
} from './validation.js';""", """import {
  createIpv4RangeScanUrls,
  normalizeShellyUrl,
  toNumberOrFallback
} from './validation.js';""")
s=s.replace("""import {
  DEFAULT_RULE_ADVANCED_SETTINGS,
  parseRuleAdvancedSettings,
  validateRuleAdvancedSettings
} from './ruleAdvancedSettings.js';""", "import { DEFAULT_RULE_ADVANCED_SETTINGS } from './ruleAdvancedSettings.js';")
needle="import { usePhoneSensorFlow } from './usePhoneSensorFlow.js';"
insert="""import {
  deriveClimateRuleState,
  deriveSensorInputState,
  deriveShellyInputState
} from './ruleConfigDerivation.js';
"""
assert needle in s
s=s.replace(needle, insert+needle, 1)
for block in [
"""type ConfigState =
  | { ok: true; config: ShellyThermostatConfig; script: string }
  | { ok: false; error: string };

""",
"""type ShellyInputState =
  | { ok: true; baseUrl: string; name: string }
  | { ok: false; fieldErrors: { name?: string; url?: string } };

type SensorInputState =
  | { ok: true; device: SensorDraftDevice }
  | { ok: false; fieldErrors: { name?: string; mac?: string } };

"""
]:
    assert block in s
    s=s.replace(block,'',1)
start=s.index("  const shellyInputState = useMemo((): ShellyInputState => {")
end_marker="  const isVpdAssistValid = advancedSettingsValidation.isVpdTargetValid;\n"
end=s.index(end_marker,start)+len(end_marker)
replacement="""  const shellyInputState = useMemo(
    () => deriveShellyInputState({ shellyNameInput, shellyUrlInput }),
    [shellyNameInput, shellyUrlInput]
  );

  const sensorInputState = useMemo(
    () =>
      deriveSensorInputState({
        sensorMacInput,
        sensorNameInput,
        sensorProfileInput
      }),
    [sensorMacInput, sensorNameInput, sensorProfileInput]
  );

  const addSensorDraft = () => {
    if (sensorInputState.ok) {
      upsertSensorDevice(sensorInputState.device);
    }
  };

  const {
    advancedSettingsValidation,
    configState,
    isThresholdValid,
    isVpdAssistValid
  } = useMemo(
    () =>
      deriveClimateRuleState({
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
      }),
    [
      maxOnHoursInput,
      minChangeMinInput,
      offThresholdInput,
      onThresholdInput,
      rssiMinInput,
      rulePreset,
      selectedSensor,
      staleTimeoutMinInput,
      vpdAssistEnabled,
      vpdTargetInput
    ]
  );
"""
s=s[:start]+replacement+s[end:]
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.ts \
  apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts

pnpm --dir apps/mobile exec vitest run src/flows/hardware-setup/ruleConfigDerivation.test.ts
pnpm check:full

git diff --check
LINES=$(wc -l < apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts | tr -d ' ')
echo HARDWARE_FLOW_LINES="$LINES"
test "$LINES" -lt 930

git add \
  apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.ts \
  apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
git commit -m 'Extract hardware setup rule derivation'
git push origin HEAD:"$BRANCH"

echo STAGE8B1_SHA=$(git rev-parse HEAD)
echo STAGE8B1_PARENT=$(git rev-parse HEAD^)
echo STAGE8B1_CHECK_FULL=1
echo STAGE8B1_FLOW_LINES="$LINES"
test -z "$(git status --porcelain)"

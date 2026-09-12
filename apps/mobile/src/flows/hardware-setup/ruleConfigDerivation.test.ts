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
        sensorNameInput: '  Sensor probe  ',
        sensorProfileInput: sensor.profileId
      })
    ).toEqual({
      ok: true,
      device: {
        id: 'A4:C1:38:4F:24:CD',
        name: 'Sensor probe',
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
      expect(heating.configState.config.sensor.runtimeAddress).toBe(
        sensor.runtimeAddress
      );
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

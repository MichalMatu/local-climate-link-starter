import { describe, expect, it } from 'vitest';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  supportsShellyMultiSensorRuntime,
  supportsShellyRuntimeConfigPersistence
} from '../index.js';

describe('Shelly runtime capabilities', () => {
  it('recognizes the generated 0.4 climate engine as multi-sensor capable', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());

    expect(supportsShellyRuntimeConfigPersistence(script)).toBe(true);
    expect(supportsShellyMultiSensorRuntime(script)).toBe(true);
  });

  it('does not infer multi-sensor support from persistence alone', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());
    const singleSensorBody = script.replace('function av(v,t,n)', 'function legacyAv(v,t,n)');

    expect(supportsShellyRuntimeConfigPersistence(singleSensorBody)).toBe(true);
    expect(supportsShellyMultiSensorRuntime(singleSensorBody)).toBe(false);
  });

  it('rejects unrelated scripts', () => {
    expect(supportsShellyMultiSensorRuntime('// LCL')).toBe(false);
  });
});

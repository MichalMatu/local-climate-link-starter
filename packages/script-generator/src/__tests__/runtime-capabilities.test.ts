import { describe, expect, it } from 'vitest';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  supportsShellyMultiSensorRuntime,
  supportsShellyPerSensorDiagnosticsRuntime,
  supportsShellyRuntimeConfigPersistence
} from '../index.js';

describe('Shelly runtime capabilities', () => {
  it('recognizes the generated 0.4 climate engine as multi-sensor capable', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());

    expect(supportsShellyRuntimeConfigPersistence(script)).toBe(true);
    expect(supportsShellyMultiSensorRuntime(script)).toBe(true);
  });

  it('recognizes per-sensor diagnostics only when the structural markers are present', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());

    expect(supportsShellyPerSensorDiagnosticsRuntime(script)).toBe(true);
    expect(
      supportsShellyPerSensorDiagnosticsRuntime(
        script.replace('function pd()', 'function legacyPd()')
      )
    ).toBe(false);
    expect(
      supportsShellyPerSensorDiagnosticsRuntime(script.replace('d:pd()', 'd:legacyPd()'))
    ).toBe(false);
    expect(supportsShellyPerSensorDiagnosticsRuntime('// LCL')).toBe(false);
  });

  it.each([
    ['sensor-set validator', 'function vs(c)', 'function legacyVs(c)'],
    ['aggregator', 'function av(v,t,n)', 'function legacyAv(v,t,n)'],
    ['sensor index', 'function ix(a)', 'function legacyIx(a)']
  ])('requires the multi-sensor %s body capability', (_name, marker, replacement) => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());
    const legacyBody = script.replace(marker, replacement);

    expect(supportsShellyRuntimeConfigPersistence(legacyBody)).toBe(true);
    expect(supportsShellyMultiSensorRuntime(legacyBody)).toBe(false);
  });

  it('rejects unrelated scripts', () => {
    expect(supportsShellyMultiSensorRuntime('// LCL')).toBe(false);
  });
});

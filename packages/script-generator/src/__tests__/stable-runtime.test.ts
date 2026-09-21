import {
  configHash,
  createDefaultShellyThermostatConfig,
  createShellyRuntimeConfig,
  decodeShellyThermostatScript,
  generateShellyThermostatScript,
  stableStringify
} from '../index.js';

const stableEngineBody = (script: string): string =>
  script
    .replace(/^\/\/ h: .+$/m, '// h: <hash>')
    .replace(/var C=\{[^;]+\};/, 'var C=<config>;');

describe('stable climate engine runtime', () => {
  it('keeps one engine body across sensor profiles and VPD settings', () => {
    const xiaomi = createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2');
    const tp357 = createDefaultShellyThermostatConfig('tp357_custom_v1');
    const xiaomiVpd = {
      ...xiaomi,
      rule: {
        ...xiaomi.rule,
        vpdAssist: { enabled: true, targetKpa: 1.2 }
      }
    };
    const tp357Vpd = {
      ...tp357,
      rule: {
        ...tp357.rule,
        vpdAssist: { enabled: true, targetKpa: 1.2 }
      }
    };

    const expected = stableEngineBody(generateShellyThermostatScript(xiaomi));
    expect(stableEngineBody(generateShellyThermostatScript(tp357))).toBe(expected);
    expect(stableEngineBody(generateShellyThermostatScript(xiaomiVpd))).toBe(expected);
    expect(stableEngineBody(generateShellyThermostatScript(tp357Vpd))).toBe(expected);
  });

  it('still decodes installed 0.2.x Xiaomi runtimes without the profile flag', () => {
    const config = createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2');
    const { p: profileFlag, ...legacyRuntimeConfig } = createShellyRuntimeConfig(
      config,
      configHash(config)
    );
    expect(profileFlag).toBe(0);
    const legacyScript = `// LCL
// g: 0.2.0
// m: xiaomi-bthome-minimal
// h: legacy
var C=${stableStringify(legacyRuntimeConfig)};var R={};`;

    expect(decodeShellyThermostatScript(legacyScript)?.settings.sensorProfileId).toBe(
      'xiaomi_lywsd03mmc_bthome_v2'
    );
  });

  it('still decodes installed 0.2.x TP357 runtimes without the profile flag', () => {
    const config = createDefaultShellyThermostatConfig('tp357_custom_v1');
    const { p: profileFlag, ...legacyRuntimeConfig } = createShellyRuntimeConfig(
      config,
      configHash(config)
    );
    expect(profileFlag).toBe(1);
    const legacyScript = `// LCL
// g: 0.2.0
// m: tp357-minimal
// h: legacy
var C=${stableStringify(legacyRuntimeConfig)};var R={};`;

    expect(decodeShellyThermostatScript(legacyScript)?.settings.sensorProfileId).toBe(
      'tp357_custom_v1'
    );
  });

  it('rejects climate-engine-v1 runtime metadata without the profile flag', () => {
    const config = createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2');
    const { p: _profileFlag, ...runtimeConfigWithoutProfile } = createShellyRuntimeConfig(
      config,
      configHash(config)
    );
    const malformedScript = `// LCL
// g: 0.3.0
// m: climate-engine-v1
// h: malformed
var C=${stableStringify(runtimeConfigWithoutProfile)};var R={};`;

    expect(decodeShellyThermostatScript(malformedScript)).toBeNull();
  });
});

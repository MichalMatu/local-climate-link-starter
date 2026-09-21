import {
  configHash,
  createDefaultShellyThermostatConfig,
  createShellyRuntimeConfig,
  decodeShellyRuntimeConfig,
  generateShellyThermostatScript,
  stableStringify
} from '../index.js';

describe('Shelly runtime config boundary', () => {
  it('maps the typed thermostat model to the compact runtime config deterministically', () => {
    const base = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'dehumidifying'
    );
    const config = {
      ...base,
      sensor: {
        ...base.sensor,
        runtimeAddress: 'A4:C1:38:4F:24:CD',
        displayName: 'Grow tent'
      },
      rule: {
        ...base.rule,
        rssiMin: -81,
        staleTimeoutSec: 321,
        minChangeMs: 45_000,
        maxOnMs: 7_200_000,
        consecutiveHits: 3,
        vpdAssist: { enabled: true, targetKpa: 1.17 }
      }
    };
    const hash = configHash(config);

    expect(createShellyRuntimeConfig(config, hash)).toEqual({
      a: 'A4C1384F24CD',
      fa: 'A4:C1:38:4F:24:CD',
      n: 'Grow tent',
      k: hash,
      i: 0,
      r: -81,
      on: config.rule.control.onThreshold,
      off: config.rule.control.offThreshold,
      d: 1,
      m: 1,
      h: 3,
      c: 45_000,
      s: 321_000,
      x: 7_200_000,
      v: 1,
      vp: 1.17
    });
  });

  it('round-trips the exact config embedded in a generated runtime', () => {
    const config = createDefaultShellyThermostatConfig('tp357_custom_v1', 'cooling');
    const hash = configHash(config);
    const expected = createShellyRuntimeConfig(config, hash);
    const script = generateShellyThermostatScript(config);

    expect(script).toContain(`var C=${stableStringify(expected)};`);
    expect(decodeShellyRuntimeConfig(script)).toEqual(expected);
  });

  it('rejects missing, malformed and incomplete runtime config data', () => {
    expect(decodeShellyRuntimeConfig('var R={};')).toBeNull();
    expect(decodeShellyRuntimeConfig('var C={bad};var R={};')).toBeNull();
    expect(decodeShellyRuntimeConfig('var C={"a":"A"};var R={};')).toBeNull();
  });
});

import {
  configHash,
  createDefaultShellyThermostatConfig,
  createShellyRuntimeConfig,
  decodeShellyRuntimeConfigJson,
  decodeShellyThermostatScript,
  generateShellyRuntimeConfigUpdateEval,
  generateShellyThermostatScript,
  serializeShellyRuntimeConfig,
  shellyRuntimeConfigMatchesConfig,
  SHELLY_RUNTIME_CONFIG_STORAGE_KEY,
  supportsShellyRuntimeConfigPersistence
} from '../index.js';

describe('persistent Shelly runtime config', () => {
  it('serializes and parses the compact config deterministically', () => {
    const config = createDefaultShellyThermostatConfig('tp357_custom_v1', 'cooling');
    const serialized = serializeShellyRuntimeConfig(config);

    expect(serializeShellyRuntimeConfig(config)).toBe(serialized);
    expect(decodeShellyRuntimeConfigJson(serialized)).toMatchObject({
      k: configHash(config),
      p: 1,
      d: 1,
      m: 0
    });
    expect(decodeShellyRuntimeConfigJson('{bad')).toBeNull();
    expect(decodeShellyRuntimeConfigJson('{"v":1}')).toBeNull();
  });

  it('matches runtime semantics without depending on local-only sensor identity', () => {
    const original = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    const runtimeConfig = createShellyRuntimeConfig(original, configHash(original));
    const recovered = {
      ...original,
      sensor: {
        ...original.sensor,
        sensorId: original.sensor.runtimeAddress
      }
    };

    expect(shellyRuntimeConfigMatchesConfig(runtimeConfig, recovered)).toBe(true);
    expect(
      shellyRuntimeConfigMatchesConfig(runtimeConfig, {
        ...recovered,
        rule: {
          ...recovered.rule,
          control: { ...recovered.rule.control, onThreshold: 18 }
        }
      })
    ).toBe(false);
  });

  it('prefers a valid persisted override when decoding a managed engine', () => {
    const embedded = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    const updatedBase = createDefaultShellyThermostatConfig('tp357_custom_v1', 'cooling');
    const updated = {
      ...updatedBase,
      sensor: {
        ...updatedBase.sensor,
        runtimeAddress: 'C2:C0:00:30:64:01',
        displayName: 'TP357 persisted'
      },
      rule: {
        ...updatedBase.rule,
        control: {
          ...updatedBase.rule.control,
          onThreshold: 27,
          offThreshold: 26
        }
      }
    };

    const decoded = decodeShellyThermostatScript(
      generateShellyThermostatScript(embedded),
      serializeShellyRuntimeConfig(updated)
    );

    expect(decoded?.configHash).toBe(configHash(updated));
    expect(decoded?.runtimeConfig.k).toBe(configHash(updated));
    expect(decoded?.settings).toMatchObject({
      sensorProfileId: 'tp357_custom_v1',
      sensorDisplayName: 'TP357 persisted',
      runtimeAddress: 'C2:C0:00:30:64:01',
      mode: 'cooling',
      control: {
        metric: 'temperature',
        direction: 'above',
        onThreshold: 27,
        offThreshold: 26
      }
    });
  });

  it('rejects a non-empty malformed persisted override instead of silently using stale embedded config', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());

    expect(decodeShellyThermostatScript(script, '{bad')).toBeNull();
  });

  it('generates an in-place config update that persists the same compact config and resets runtime state', () => {
    const config = createDefaultShellyThermostatConfig(
      'tp357_custom_v1',
      'dehumidifying'
    );
    const code = generateShellyRuntimeConfigUpdateEval(config);
    const storage = new Map<string, string>();
    const runtimeState = {
      ls: 1,
      l: 2,
      t: 3,
      h: 4,
      tt: 5,
      ht: 6,
      b: 7,
      r: -40,
      on: true,
      rs: 'old',
      ds: 'old',
      lc: 8,
      os: 9,
      nh: 2,
      fh: 2,
      cv: 10,
      vp: 1,
      eo: 11,
      ef: 12,
      m: 1,
      sa: 13
    };
    const evaluate = new Function('C', 'R', 'vc', 'Script', 'nw', `return ${code};`) as (
      currentConfig: Record<string, unknown>,
      runtime: typeof runtimeState,
      validate: (value: unknown) => boolean,
      scriptApi: { storage: { setItem: (key: string, value: string) => void } },
      now: () => number
    ) => string;

    const result = evaluate(
      {},
      runtimeState,
      () => true,
      { storage: { setItem: (key, value) => storage.set(key, value) } },
      () => 1234
    );

    expect(result).toBe(configHash(config));
    expect(storage.get(SHELLY_RUNTIME_CONFIG_STORAGE_KEY)).toBe(
      serializeShellyRuntimeConfig(config)
    );
    expect(runtimeState).toMatchObject({
      ls: null,
      l: 0,
      t: null,
      h: null,
      tt: null,
      ht: null,
      b: null,
      r: null,
      on: false,
      rs: 'cu',
      ds: 'boot',
      lc: 1234,
      os: null,
      nh: 0,
      fh: 0,
      cv: null,
      vp: null,
      eo: null,
      ef: null,
      m: 0,
      sa: 0
    });
  });

  it('refuses an invalid config or missing Script.storage before mutating state', () => {
    const config = createDefaultShellyThermostatConfig();
    const code = generateShellyRuntimeConfigUpdateEval(config);
    const evaluate = new Function('C', 'R', 'vc', 'Script', 'nw', `return ${code};`) as (
      currentConfig: Record<string, unknown>,
      runtime: Record<string, unknown>,
      validate: (value: unknown) => boolean,
      scriptApi: unknown,
      now: () => number
    ) => string;
    const runtime = { on: true, ds: 'old' };

    expect(
      evaluate(
        {},
        runtime,
        () => false,
        {},
        () => 0
      )
    ).toBe('iv');
    expect(runtime).toEqual({ on: true, ds: 'old' });
    expect(
      evaluate(
        {},
        runtime,
        () => true,
        {},
        () => 0
      )
    ).toBe('ns');
    expect(runtime).toEqual({ on: true, ds: 'old' });
  });

  it('detects the persistence bootstrap only on capable managed engines', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());

    expect(supportsShellyRuntimeConfigPersistence(script)).toBe(true);
    expect(
      supportsShellyRuntimeConfigPersistence(script.replace('function vc(c)', ''))
    ).toBe(false);
    expect(
      supportsShellyRuntimeConfigPersistence(
        script.replace('// m: climate-engine-v1', '')
      )
    ).toBe(false);
  });

  it('embeds the persistent loader and storage key in the stable engine', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());

    expect(script).toContain(
      `Script.storage.getItem("${SHELLY_RUNTIME_CONFIG_STORAGE_KEY}")`
    );
    expect(script).toContain('R.ds="cf"');
    expect(script).toContain('if(E)');
  });
});

import {
  configHash,
  createDefaultShellyThermostatConfig,
  decodeShellyThermostatScript,
  generateShellyThermostatScript,
  normalizeConfig,
  stableStringify,
  type ShellyThermostatConfig
} from '../index.js';

type SensorProfileId = ShellyThermostatConfig['sensor']['profileId'];
type RuleMode = ShellyThermostatConfig['rule']['mode'];

const sensors = [
  'xiaomi_lywsd03mmc_bthome_v2',
  'tp357_custom_v1'
] as const satisfies readonly SensorProfileId[];
const modes = [
  'heating',
  'cooling',
  'humidifying',
  'dehumidifying'
] as const satisfies readonly RuleMode[];
const vpdOptions = [false, true] as const;

const runtimeBudgetBytes = 6_000;

const byteLength = (value: string): number => new TextEncoder().encode(value).length;

interface MatrixCase {
  sensorProfileId: SensorProfileId;
  mode: RuleMode;
  vpdAssistEnabled: boolean;
  label: string;
}

const matrixCases: MatrixCase[] = sensors.flatMap((sensorProfileId) =>
  modes.flatMap((mode) =>
    vpdOptions.map((vpdAssistEnabled) => ({
      sensorProfileId,
      mode,
      vpdAssistEnabled,
      label: `${sensorProfileId} / ${mode} / VPD ${vpdAssistEnabled ? 'on' : 'off'}`
    }))
  )
);

const configForCase = ({
  sensorProfileId,
  mode,
  vpdAssistEnabled
}: MatrixCase): ShellyThermostatConfig => {
  const config = createDefaultShellyThermostatConfig(sensorProfileId, mode);

  return {
    ...config,
    rule: {
      ...config.rule,
      vpdAssist: {
        enabled: vpdAssistEnabled,
        targetKpa: 1.25
      }
    }
  };
};

const expectedRuntimeModeForSensor = (sensorProfileId: SensorProfileId): string =>
  sensorProfileId === 'tp357_custom_v1' ? 'tp357-minimal' : 'xiaomi-bthome-minimal';

const expectedMetricFlagForMode = (mode: RuleMode): string =>
  mode === 'humidifying' || mode === 'dehumidifying' ? '"m":1' : '"m":0';

const expectedDirectionFlagForMode = (mode: RuleMode): string =>
  mode === 'cooling' || mode === 'dehumidifying' ? '"d":1' : '"d":0';

describe('Shelly runtime generation matrix', () => {
  it('covers every supported sensor, mode, and VPD combination', () => {
    const expectedCaseIds = new Set(
      sensors.flatMap((sensorProfileId) =>
        modes.flatMap((mode) =>
          vpdOptions.map(
            (vpdAssistEnabled) => `${sensorProfileId}:${mode}:${String(vpdAssistEnabled)}`
          )
        )
      )
    );
    const actualCaseIds = new Set(
      matrixCases.map(
        ({ sensorProfileId, mode, vpdAssistEnabled }) =>
          `${sensorProfileId}:${mode}:${String(vpdAssistEnabled)}`
      )
    );

    expect(actualCaseIds).toEqual(expectedCaseIds);
    expect(matrixCases).toHaveLength(sensors.length * modes.length * vpdOptions.length);
  });

  it.each(matrixCases)('generates a valid minimal runtime for $label', (matrixCase) => {
    const config = configForCase(matrixCase);
    const script = generateShellyThermostatScript(config);

    expect(script).toContain(
      `m: ${expectedRuntimeModeForSensor(matrixCase.sensorProfileId)}`
    );
    expect(script).toContain(expectedMetricFlagForMode(matrixCase.mode));
    expect(script).toContain(expectedDirectionFlagForMode(matrixCase.mode));
    expect(script).toContain('Shelly.call("Switch.Set"');
    expect(script).toContain('BLE.Scanner.start||BLE.Scanner.Start');
    expect(script).toContain('sw(false,"b",true)');
    expect(script).toContain('"st"');
    expect(script).toContain('"mx"');
    expect(script).toContain('"cv"');
    expect(script).toContain('HTTPServer.registerEndpoint("diag"');
    expect(script).toContain('R.vp');
    expect(script).toContain('R.eo');
    expect(script).toContain('R.ef');
    expect(script).not.toContain('{{');
    expect(script).not.toContain('__PLACEHOLDER__');
    expect(byteLength(script)).toBeLessThanOrEqual(runtimeBudgetBytes);
    expect(() => new Function(script)).not.toThrow();
  });

  it.each(matrixCases)('round-trips runtime settings for $label', (matrixCase) => {
    const config = configForCase(matrixCase);
    const script = generateShellyThermostatScript(config);
    const decoded = decodeShellyThermostatScript(script);

    expect(decoded).not.toBeNull();
    expect(decoded?.configHash).toBe(configHash(config));
    expect(decoded?.runtimeConfig.k).toBe(configHash(config));
    expect(decoded?.settings).toMatchObject({
      version: config.version,
      sensorProfileId: config.sensor.profileId,
      runtimeAddress: config.sensor.runtimeAddress,
      relayId: config.output.relayId,
      mode: config.rule.mode,
      control: config.rule.control,
      staleTimeoutSec: config.rule.staleTimeoutSec,
      minChangeMs: config.rule.minChangeMs,
      maxOnMs: config.rule.maxOnMs,
      rssiMin: config.rule.rssiMin,
      consecutiveHits: config.rule.consecutiveHits,
      failSafe: 'off',
      bootState: 'off'
    });
    expect(decoded?.settings.vpdAssist.enabled).toBe(config.rule.vpdAssist.enabled);
    expect(decoded?.settings.vpdAssist.targetKpa).toBe(
      config.rule.vpdAssist.enabled ? config.rule.vpdAssist.targetKpa : null
    );
  });

  it.each(matrixCases)('keeps parser code profile-specific for $label', (matrixCase) => {
    const script = generateShellyThermostatScript(configForCase(matrixCase));

    if (matrixCase.sensorProfileId === 'tp357_custom_v1') {
      expect(script).toContain('function mf(d)');
      expect(script).toContain('"tm"');
      expect(script).not.toContain('BTHome.parseData');
      expect(script).not.toContain('xiaomi_lywsd03mmc_bthome_v2');
      expect(script).not.toContain('parseBthomeV2Payload');
    } else {
      expect(script).toContain('function ad(d)');
      expect(script).toContain('function r2(d,o,s)');
      expect(script).not.toContain('BTHome.parseData');
      expect(script).not.toContain('function mf(d)');
      expect(script).not.toContain('"tm"');
      expect(script).not.toContain('tp357_custom_v1');
    }
  });

  it.each(matrixCases)('adds VPD code only when requested for $label', (matrixCase) => {
    const script = generateShellyThermostatScript(configForCase(matrixCase));

    if (matrixCase.vpdAssistEnabled) {
      expect(script).toContain('"vp":1.25');
      expect(script).toContain('function sv(t)');
      expect(script).toContain('Math.exp');
    } else {
      expect(script).toContain('"vp":0');
      expect(script).not.toContain('function sv(t)');
      expect(script).not.toContain('Math.exp');
    }
  });

  it('rejects invalid above-directed thresholds with a specific message', () => {
    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'cooling'
    );

    expect(() =>
      normalizeConfig({
        ...config,
        rule: {
          ...config.rule,
          control: {
            ...config.rule.control,
            onThreshold: 20,
            offThreshold: 20
          }
        }
      })
    ).toThrow(/onThreshold must be higher than offThreshold/);
  });

  it('stableStringify keeps arrays and nested object keys deterministic', () => {
    expect(
      stableStringify({
        b: [2, { d: null, c: 'x' }],
        a: 1
      })
    ).toBe('{"a":1,"b":[2,{"c":"x","d":null}]}');
  });
});

import {
  DEFAULT_COOLING_RULE,
  DEFAULT_DEHUMIDIFYING_RULE,
  DEFAULT_HUMIDIFYING_RULE,
  DEFAULT_HEATING_RULE,
  calculateHumidityForVpdKpa,
  calculateTemperatureForVpdKpa,
  calculateVpdKpa,
  createInitialAutomationState,
  defaultRuleForPreset,
  evaluateThresholdDecision,
  forceRelayOffState,
  resolveEffectiveThresholdControl,
  simulateThresholdRule,
  type AutomationState,
  type RulePresetId,
  type ThermostatMeasurement,
  type ThermostatRule
} from '../index.js';

const nowMs = 1_000_000;

const modes = ['heating', 'cooling', 'humidifying', 'dehumidifying'] as const;
const vpdOptions = [false, true] as const;

const rulesByMode = {
  heating: DEFAULT_HEATING_RULE,
  cooling: DEFAULT_COOLING_RULE,
  humidifying: DEFAULT_HUMIDIFYING_RULE,
  dehumidifying: DEFAULT_DEHUMIDIFYING_RULE
} satisfies Record<RulePresetId, ThermostatRule>;

interface MatrixCase {
  mode: RulePresetId;
  vpdAssistEnabled: boolean;
  label: string;
  rule: ThermostatRule;
}

const ruleForCase = (mode: RulePresetId, vpdAssistEnabled: boolean): ThermostatRule => ({
  ...rulesByMode[mode],
  consecutiveHits: 1,
  minChangeMs: 120_000,
  maxOnMs: 14_400_000,
  vpdAssist: {
    enabled: vpdAssistEnabled,
    targetKpa: 1.2
  }
});

const matrixCases: MatrixCase[] = modes.flatMap((mode) =>
  vpdOptions.map((vpdAssistEnabled) => ({
    mode,
    vpdAssistEnabled,
    label: `${mode} / VPD ${vpdAssistEnabled ? 'on' : 'off'}`,
    rule: ruleForCase(mode, vpdAssistEnabled)
  }))
);

const baseMeasurementForRule = (rule: ThermostatRule): ThermostatMeasurement => ({
  temperatureC: rule.control.metric === 'temperature' ? 22 : 25,
  humidityPct: rule.control.metric === 'humidity' ? 60 : 75,
  rssi: -60,
  seenAtMs: nowMs
});

const measurementWithControlValue = (
  rule: ThermostatRule,
  controlValue: number
): ThermostatMeasurement => ({
  ...baseMeasurementForRule(rule),
  ...(rule.control.metric === 'temperature'
    ? { temperatureC: controlValue }
    : { humidityPct: controlValue })
});

const missingControlValueForRule = (rule: ThermostatRule): ThermostatMeasurement => ({
  ...(rule.control.metric === 'temperature' ? { humidityPct: 55 } : { temperatureC: 24 }),
  rssi: -60,
  seenAtMs: nowMs
});

const relayOnState = (): AutomationState => ({
  relayOn: true,
  onHits: 0,
  offHits: 0,
  lastChangeMs: nowMs - 300_000,
  onStartedMs: nowMs - 300_000
});

const crossedValuesForRule = (rule: ThermostatRule) => {
  const effective = resolveEffectiveThresholdControl(rule, baseMeasurementForRule(rule));
  const { control } = effective;
  const delta = control.metric === 'temperature' ? 0.5 : 3;
  const inside = (control.onThreshold + control.offThreshold) / 2;

  return control.direction === 'below'
    ? {
        on: control.onThreshold - delta,
        off: control.offThreshold + delta,
        inside
      }
    : {
        on: control.onThreshold + delta,
        off: control.offThreshold - delta,
        inside
      };
};

describe('automation threshold matrix', () => {
  it('covers every supported rule mode with VPD disabled and enabled', () => {
    const expectedCaseIds = new Set(
      modes.flatMap((mode) =>
        vpdOptions.map((vpdAssistEnabled) => `${mode}:${String(vpdAssistEnabled)}`)
      )
    );
    const actualCaseIds = new Set(
      matrixCases.map((entry) => `${entry.mode}:${String(entry.vpdAssistEnabled)}`)
    );

    expect(actualCaseIds).toEqual(expectedCaseIds);
    expect(matrixCases).toHaveLength(modes.length * vpdOptions.length);
  });

  it.each(matrixCases)('requests relay ON for $label', ({ rule }) => {
    const values = crossedValuesForRule(rule);
    const decision = evaluateThresholdDecision({
      rule,
      state: createInitialAutomationState(),
      measurement: measurementWithControlValue(rule, values.on),
      nowMs
    });

    expect(decision.requestedRelayOn).toBe(true);
    expect(decision.shouldCallRelay).toBe(true);
    expect(decision.reason).toBe(
      rule.control.direction === 'below' ? 'below-threshold' : 'above-threshold'
    );
  });

  it.each(matrixCases)('requests relay OFF for $label', ({ rule }) => {
    const values = crossedValuesForRule(rule);
    const decision = evaluateThresholdDecision({
      rule,
      state: relayOnState(),
      measurement: measurementWithControlValue(rule, values.off),
      nowMs
    });

    expect(decision.requestedRelayOn).toBe(false);
    expect(decision.shouldCallRelay).toBe(true);
    expect(decision.reason).toBe(
      rule.control.direction === 'below' ? 'above-threshold' : 'below-threshold'
    );
  });

  it.each(matrixCases)(
    'keeps the relay stable inside the band for $label',
    ({ rule }) => {
      const values = crossedValuesForRule(rule);
      const offDecision = evaluateThresholdDecision({
        rule,
        state: createInitialAutomationState(),
        measurement: measurementWithControlValue(rule, values.inside),
        nowMs
      });
      const onDecision = evaluateThresholdDecision({
        rule,
        state: relayOnState(),
        measurement: measurementWithControlValue(rule, values.inside),
        nowMs
      });

      expect(offDecision.requestedRelayOn).toBe(false);
      expect(offDecision.shouldCallRelay).toBe(false);
      expect(offDecision.reason).toBe('inside-band');
      expect(onDecision.requestedRelayOn).toBe(true);
      expect(onDecision.shouldCallRelay).toBe(false);
      expect(onDecision.reason).toBe('inside-band');
    }
  );

  it.each(matrixCases)('keeps fail-safe OFF behavior for $label', ({ rule }) => {
    const staleDecision = evaluateThresholdDecision({
      rule,
      state: relayOnState(),
      measurement: {
        ...baseMeasurementForRule(rule),
        seenAtMs: nowMs - rule.staleTimeoutSec * 1000 - 1
      },
      nowMs
    });
    const missingDecision = evaluateThresholdDecision({
      rule,
      state: relayOnState(),
      nowMs
    });
    const bootDecision = evaluateThresholdDecision({
      rule,
      state: relayOnState(),
      measurement: baseMeasurementForRule(rule),
      nowMs,
      event: 'boot'
    });
    const missingControlDecision = evaluateThresholdDecision({
      rule,
      state: relayOnState(),
      measurement: missingControlValueForRule(rule),
      nowMs
    });

    expect(staleDecision.requestedRelayOn).toBe(false);
    expect(staleDecision.shouldCallRelay).toBe(true);
    expect(staleDecision.reason).toBe('sensor-stale');
    expect(missingDecision.requestedRelayOn).toBe(false);
    expect(missingDecision.shouldCallRelay).toBe(true);
    expect(missingDecision.reason).toBe('sensor-stale');
    expect(bootDecision.requestedRelayOn).toBe(false);
    expect(bootDecision.shouldCallRelay).toBe(true);
    expect(bootDecision.reason).toBe('boot-safe-off');
    expect(missingControlDecision.requestedRelayOn).toBe(false);
    expect(missingControlDecision.shouldCallRelay).toBe(true);
    expect(missingControlDecision.reason).toBe('control-value-missing');
  });

  it.each(matrixCases)('enforces relay guards for $label', ({ rule }) => {
    const values = crossedValuesForRule(rule);
    const maxOnDecision = evaluateThresholdDecision({
      rule,
      state: {
        ...relayOnState(),
        onStartedMs: nowMs - rule.maxOnMs
      },
      measurement: measurementWithControlValue(rule, values.on),
      nowMs
    });
    const minChangeDecision = evaluateThresholdDecision({
      rule,
      state: {
        relayOn: false,
        onHits: 0,
        offHits: 0,
        lastChangeMs: nowMs - rule.minChangeMs + 1
      },
      measurement: measurementWithControlValue(rule, values.on),
      nowMs
    });

    expect(maxOnDecision.requestedRelayOn).toBe(false);
    expect(maxOnDecision.shouldCallRelay).toBe(true);
    expect(maxOnDecision.reason).toBe('max-on-time');
    expect(minChangeDecision.requestedRelayOn).toBe(false);
    expect(minChangeDecision.shouldCallRelay).toBe(false);
    expect(minChangeDecision.reason).toBe('min-change-blocked');
  });

  it.each(matrixCases)('simulates ON then OFF transitions for $label', ({ rule }) => {
    const values = crossedValuesForRule(rule);
    const simulation = simulateThresholdRule(
      {
        ...rule,
        minChangeMs: 0
      },
      [
        {
          nowMs,
          measurement: measurementWithControlValue(rule, values.on)
        },
        {
          nowMs: nowMs + 1,
          measurement: measurementWithControlValue(rule, values.off)
        }
      ]
    );

    expect(simulation).toHaveLength(2);
    expect(simulation[0]?.requestedRelayOn).toBe(true);
    expect(simulation[0]?.shouldCallRelay).toBe(true);
    expect(simulation[1]?.requestedRelayOn).toBe(false);
    expect(simulation[1]?.shouldCallRelay).toBe(true);
  });

  it.each(matrixCases)('resolves VPD only when enabled for $label', ({ rule }) => {
    const effective = resolveEffectiveThresholdControl(
      rule,
      baseMeasurementForRule(rule)
    );

    expect(effective.vpdKpa).toBeGreaterThan(0);
    expect(effective.vpdAssistApplied).toBe(rule.vpdAssist.enabled);
    if (rule.vpdAssist.enabled) {
      expect(effective.vpdAssistTarget).toBeGreaterThanOrEqual(
        Math.min(rule.control.onThreshold, rule.control.offThreshold)
      );
      expect(effective.vpdAssistTarget).toBeLessThanOrEqual(
        Math.max(rule.control.onThreshold, rule.control.offThreshold)
      );
    } else {
      expect(effective.vpdAssistTarget).toBeUndefined();
    }
  });

  it('maps every default preset to the expected rule object', () => {
    expect(defaultRuleForPreset('heating')).toBe(DEFAULT_HEATING_RULE);
    expect(defaultRuleForPreset('cooling')).toBe(DEFAULT_COOLING_RULE);
    expect(defaultRuleForPreset('humidifying')).toBe(DEFAULT_HUMIDIFYING_RULE);
    expect(defaultRuleForPreset('dehumidifying')).toBe(DEFAULT_DEHUMIDIFYING_RULE);
  });

  it('keeps VPD helpers explicit when inputs are missing or impossible', () => {
    expect(calculateVpdKpa(undefined, 60)).toBeUndefined();
    expect(calculateVpdKpa(25, undefined)).toBeUndefined();
    expect(calculateTemperatureForVpdKpa(1.2, undefined)).toBeUndefined();
    expect(calculateTemperatureForVpdKpa(1.2, 100)).toBeUndefined();
    expect(calculateTemperatureForVpdKpa(1.2, 101)).toBeUndefined();
    expect(calculateTemperatureForVpdKpa(0, 60)).toBeUndefined();
    expect(calculateTemperatureForVpdKpa(100_000_000, 60)).toBeUndefined();
    expect(calculateHumidityForVpdKpa(1.2, undefined)).toBeUndefined();
    expect(calculateHumidityForVpdKpa(1.2, -237.3)).toBeUndefined();
  });

  it('falls back to static thresholds when VPD assist cannot resolve a target', () => {
    const rule = {
      ...DEFAULT_HEATING_RULE,
      vpdAssist: {
        enabled: true,
        targetKpa: 1.2
      }
    };
    const effective = resolveEffectiveThresholdControl(rule, {
      temperatureC: 22,
      seenAtMs: nowMs
    });

    expect(effective.control).toEqual(DEFAULT_HEATING_RULE.control);
    expect(effective.vpdKpa).toBeUndefined();
    expect(effective.vpdAssistTarget).toBeUndefined();
    expect(effective.vpdAssistApplied).toBe(false);
  });

  it('does not call relay for fail-safe OFF when relay is already OFF', () => {
    const state = {
      ...createInitialAutomationState(),
      lastChangeMs: nowMs - 1
    };
    const decision = evaluateThresholdDecision({
      rule: DEFAULT_HEATING_RULE,
      state,
      measurement: {
        temperatureC: 18,
        seenAtMs: nowMs - DEFAULT_HEATING_RULE.staleTimeoutSec * 1000 - 1
      },
      nowMs
    });

    expect(decision.requestedRelayOn).toBe(false);
    expect(decision.shouldCallRelay).toBe(false);
    expect(decision.nextState.lastChangeMs).toBe(state.lastChangeMs);
    expect(decision.reason).toBe('sensor-stale');
  });

  it('does not call relay when a crossed threshold requests the current relay state', () => {
    const onAgainDecision = evaluateThresholdDecision({
      rule: { ...DEFAULT_HEATING_RULE, consecutiveHits: 1 },
      state: relayOnState(),
      measurement: measurementWithControlValue(
        DEFAULT_HEATING_RULE,
        DEFAULT_HEATING_RULE.control.onThreshold - 1
      ),
      nowMs
    });
    const offAgainDecision = evaluateThresholdDecision({
      rule: { ...DEFAULT_HEATING_RULE, consecutiveHits: 1 },
      state: createInitialAutomationState(),
      measurement: measurementWithControlValue(
        DEFAULT_HEATING_RULE,
        DEFAULT_HEATING_RULE.control.offThreshold + 1
      ),
      nowMs
    });

    expect(onAgainDecision.requestedRelayOn).toBe(true);
    expect(onAgainDecision.shouldCallRelay).toBe(false);
    expect(onAgainDecision.reason).toBe('below-threshold');
    expect(offAgainDecision.requestedRelayOn).toBe(false);
    expect(offAgainDecision.shouldCallRelay).toBe(false);
    expect(offAgainDecision.reason).toBe('above-threshold');
  });

  it('switches a running relay off after the first crossed OFF threshold', () => {
    const firstDecision = evaluateThresholdDecision({
      rule: DEFAULT_HEATING_RULE,
      state: relayOnState(),
      measurement: measurementWithControlValue(
        DEFAULT_HEATING_RULE,
        DEFAULT_HEATING_RULE.control.offThreshold + 1
      ),
      nowMs
    });
    expect(firstDecision.requestedRelayOn).toBe(false);
    expect(firstDecision.shouldCallRelay).toBe(true);
    expect(firstDecision.reason).toBe('above-threshold');
    expect(firstDecision.nextState.offHits).toBe(1);
  });

  it('forceRelayOffState resets a running relay without changing an already-off state', () => {
    const offState = createInitialAutomationState();
    const onState = relayOnState();

    expect(forceRelayOffState(offState, nowMs)).toEqual(offState);
    expect(forceRelayOffState(onState, nowMs)).toEqual({
      ...onState,
      relayOn: false,
      lastChangeMs: nowMs,
      onStartedMs: undefined,
      onHits: 0,
      offHits: 0
    });
  });
});

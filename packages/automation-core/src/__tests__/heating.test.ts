import {
  DEFAULT_COOLING_RULE,
  DEFAULT_DEHUMIDIFYING_RULE,
  DEFAULT_HUMIDIFYING_RULE,
  DEFAULT_HEATING_RULE,
  calculateHumidityForVpdKpa,
  calculateTemperatureForVpdKpa,
  calculateVpdKpa,
  createInitialAutomationState,
  evaluateThresholdDecision,
  resolveEffectiveThresholdControl
} from '../index.js';

const nowMs = 1_000_000;
const freshMeasurement = (temperatureC: number) => ({
  temperatureC,
  humidityPct: 45,
  rssi: -60,
  seenAtMs: nowMs
});
const immediateRule = { ...DEFAULT_HEATING_RULE, consecutiveHits: 1 };

describe('evaluateThresholdDecision', () => {
  it('requests ON when temperature is below the ON threshold', () => {
    const decision = evaluateThresholdDecision({
      rule: immediateRule,
      state: createInitialAutomationState(),
      measurement: freshMeasurement(18.5),
      nowMs
    });

    expect(decision.requestedRelayOn).toBe(true);
    expect(decision.shouldCallRelay).toBe(true);
    expect(decision.reason).toBe('below-threshold');
  });

  it('requests OFF when temperature is above the OFF threshold', () => {
    const decision = evaluateThresholdDecision({
      rule: immediateRule,
      state: {
        relayOn: true,
        onHits: 0,
        offHits: 0,
        lastChangeMs: nowMs - 300_000,
        onStartedMs: nowMs - 200_000
      },
      measurement: freshMeasurement(20.5),
      nowMs
    });

    expect(decision.requestedRelayOn).toBe(false);
    expect(decision.shouldCallRelay).toBe(true);
    expect(decision.reason).toBe('above-threshold');
  });

  it('requires consecutive hits before changing relay with the default rule', () => {
    const firstDecision = evaluateThresholdDecision({
      rule: DEFAULT_HEATING_RULE,
      state: createInitialAutomationState(),
      measurement: freshMeasurement(18.5),
      nowMs
    });

    const secondDecision = evaluateThresholdDecision({
      rule: DEFAULT_HEATING_RULE,
      state: firstDecision.nextState,
      measurement: freshMeasurement(18.4),
      nowMs: nowMs + 1000
    });

    expect(firstDecision.requestedRelayOn).toBe(false);
    expect(firstDecision.shouldCallRelay).toBe(false);
    expect(firstDecision.nextState.onHits).toBe(1);
    expect(secondDecision.requestedRelayOn).toBe(true);
    expect(secondDecision.shouldCallRelay).toBe(true);
  });

  it('keeps relay state at exact thresholds to avoid chatter', () => {
    const atOnThreshold = evaluateThresholdDecision({
      rule: DEFAULT_HEATING_RULE,
      state: createInitialAutomationState(),
      measurement: freshMeasurement(DEFAULT_HEATING_RULE.control.onThreshold),
      nowMs
    });
    const atOffThreshold = evaluateThresholdDecision({
      rule: DEFAULT_HEATING_RULE,
      state: { relayOn: true, onHits: 0, offHits: 0 },
      measurement: freshMeasurement(DEFAULT_HEATING_RULE.control.offThreshold),
      nowMs
    });

    expect(atOnThreshold.requestedRelayOn).toBe(false);
    expect(atOnThreshold.shouldCallRelay).toBe(false);
    expect(atOnThreshold.reason).toBe('inside-band');
    expect(atOffThreshold.requestedRelayOn).toBe(true);
    expect(atOffThreshold.shouldCallRelay).toBe(false);
  });

  it('requests OFF when sensor reading is stale', () => {
    const decision = evaluateThresholdDecision({
      rule: DEFAULT_HEATING_RULE,
      state: {
        relayOn: true,
        onHits: 0,
        offHits: 0,
        onStartedMs: nowMs - 1_000
      },
      measurement: {
        temperatureC: 18,
        seenAtMs: nowMs - DEFAULT_HEATING_RULE.staleTimeoutSec * 1000 - 1
      },
      nowMs
    });

    expect(decision.requestedRelayOn).toBe(false);
    expect(decision.shouldCallRelay).toBe(true);
    expect(decision.reason).toBe('sensor-stale');
  });

  it('requests OFF on boot/start', () => {
    const decision = evaluateThresholdDecision({
      rule: DEFAULT_HEATING_RULE,
      state: { relayOn: true, onHits: 0, offHits: 0 },
      measurement: freshMeasurement(18),
      nowMs,
      event: 'boot'
    });

    expect(decision.requestedRelayOn).toBe(false);
    expect(decision.shouldCallRelay).toBe(true);
    expect(decision.reason).toBe('boot-safe-off');
  });

  it('blocks too-fast relay changes with minChangeMs', () => {
    const decision = evaluateThresholdDecision({
      rule: DEFAULT_HEATING_RULE,
      state: {
        relayOn: false,
        onHits: 1,
        offHits: 0,
        lastChangeMs: nowMs - DEFAULT_HEATING_RULE.minChangeMs + 1
      },
      measurement: freshMeasurement(18),
      nowMs
    });

    expect(decision.requestedRelayOn).toBe(false);
    expect(decision.shouldCallRelay).toBe(false);
    expect(decision.reason).toBe('min-change-blocked');
  });

  it('requests OFF when maxOnMs is exceeded', () => {
    const decision = evaluateThresholdDecision({
      rule: DEFAULT_HEATING_RULE,
      state: {
        relayOn: true,
        onHits: 0,
        offHits: 0,
        onStartedMs: nowMs - DEFAULT_HEATING_RULE.maxOnMs
      },
      measurement: freshMeasurement(18),
      nowMs
    });

    expect(decision.requestedRelayOn).toBe(false);
    expect(decision.shouldCallRelay).toBe(true);
    expect(decision.reason).toBe('max-on-time');
  });

  it('uses above-directed temperature thresholds for cooling', () => {
    const decision = evaluateThresholdDecision({
      rule: { ...DEFAULT_COOLING_RULE, consecutiveHits: 1 },
      state: createInitialAutomationState(),
      measurement: {
        temperatureC: 27,
        humidityPct: 45,
        seenAtMs: nowMs
      },
      nowMs
    });

    expect(decision.requestedRelayOn).toBe(true);
    expect(decision.reason).toBe('above-threshold');
  });

  it('uses humidity when the rule controls humidifying', () => {
    const decision = evaluateThresholdDecision({
      rule: { ...DEFAULT_HUMIDIFYING_RULE, consecutiveHits: 1 },
      state: createInitialAutomationState(),
      measurement: {
        temperatureC: 22,
        humidityPct: 40,
        seenAtMs: nowMs
      },
      nowMs
    });

    expect(decision.requestedRelayOn).toBe(true);
    expect(decision.reason).toBe('below-threshold');
  });

  it('uses above-directed humidity thresholds for dehumidifying', () => {
    const decision = evaluateThresholdDecision({
      rule: { ...DEFAULT_DEHUMIDIFYING_RULE, consecutiveHits: 1 },
      state: createInitialAutomationState(),
      measurement: {
        temperatureC: 22,
        humidityPct: 70,
        seenAtMs: nowMs
      },
      nowMs
    });

    expect(decision.requestedRelayOn).toBe(true);
    expect(decision.reason).toBe('above-threshold');
  });

  it('calculates VPD from temperature and humidity for diagnostics and assist', () => {
    const vpd = calculateVpdKpa(25, 60);

    expect(vpd).toBeCloseTo(1.27, 2);
  });

  it('derives temperature and humidity targets from VPD', () => {
    expect(calculateTemperatureForVpdKpa(1.27, 60)).toBeCloseTo(25, 1);
    expect(calculateHumidityForVpdKpa(1.27, 25)).toBeCloseTo(60, 0);
  });

  it('uses VPD assist to raise the heating target inside the safe range', () => {
    const rule = {
      ...DEFAULT_HEATING_RULE,
      control: {
        ...DEFAULT_HEATING_RULE.control,
        onThreshold: 20,
        offThreshold: 24
      },
      vpdAssist: {
        enabled: true,
        targetKpa: 1.2
      },
      consecutiveHits: 1
    };
    const measurement = {
      temperatureC: 21,
      humidityPct: 75,
      seenAtMs: nowMs
    };

    const thresholds = resolveEffectiveThresholdControl(rule, measurement);
    const decision = evaluateThresholdDecision({
      rule,
      state: createInitialAutomationState(),
      measurement,
      nowMs
    });

    expect(thresholds.vpdAssistApplied).toBe(true);
    expect(thresholds.control.onThreshold).toBeCloseTo(23.75, 2);
    expect(thresholds.control.offThreshold).toBe(24);
    expect(decision.requestedRelayOn).toBe(true);
    expect(decision.reason).toBe('below-threshold');
  });

  it('uses VPD assist to derive humidifying thresholds from temperature', () => {
    const rule = {
      ...DEFAULT_HUMIDIFYING_RULE,
      control: {
        ...DEFAULT_HUMIDIFYING_RULE.control,
        onThreshold: 50,
        offThreshold: 70
      },
      vpdAssist: {
        enabled: true,
        targetKpa: 1.2
      },
      consecutiveHits: 1
    };
    const measurement = {
      temperatureC: 25,
      humidityPct: 55,
      seenAtMs: nowMs
    };

    const thresholds = resolveEffectiveThresholdControl(rule, measurement);
    const decision = evaluateThresholdDecision({
      rule,
      state: createInitialAutomationState(),
      measurement,
      nowMs
    });

    expect(thresholds.vpdAssistApplied).toBe(true);
    expect(thresholds.control.onThreshold).toBeCloseTo(60.1, 1);
    expect(thresholds.control.offThreshold).toBeCloseTo(64.1, 1);
    expect(decision.requestedRelayOn).toBe(true);
    expect(decision.reason).toBe('below-threshold');
  });

  it('uses VPD assist to derive dehumidifying thresholds from temperature', () => {
    const rule = {
      ...DEFAULT_DEHUMIDIFYING_RULE,
      control: {
        ...DEFAULT_DEHUMIDIFYING_RULE.control,
        onThreshold: 70,
        offThreshold: 50
      },
      vpdAssist: {
        enabled: true,
        targetKpa: 1.2
      },
      consecutiveHits: 1
    };
    const measurement = {
      temperatureC: 25,
      humidityPct: 66,
      seenAtMs: nowMs
    };

    const thresholds = resolveEffectiveThresholdControl(rule, measurement);
    const decision = evaluateThresholdDecision({
      rule,
      state: createInitialAutomationState(),
      measurement,
      nowMs
    });

    expect(thresholds.vpdAssistApplied).toBe(true);
    expect(thresholds.control.onThreshold).toBeCloseTo(64.1, 1);
    expect(thresholds.control.offThreshold).toBeCloseTo(60.1, 1);
    expect(decision.requestedRelayOn).toBe(true);
    expect(decision.reason).toBe('above-threshold');
  });
});

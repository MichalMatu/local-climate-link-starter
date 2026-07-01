import type {
  AutomationDecision,
  AutomationInput,
  AutomationState,
  RelayDecisionReason,
  RuleControlMetric,
  ThresholdControl,
  ThermostatMeasurement,
  ThermostatRule
} from '../model.js';

const VPD_ASSIST_TEMPERATURE_MARGIN_C = 0.25;
const VPD_ASSIST_HUMIDITY_MARGIN_PCT = 2;

const offDecision = (
  state: AutomationState,
  reason: RelayDecisionReason,
  nowMs: number
): AutomationDecision => ({
  requestedRelayOn: false,
  shouldCallRelay: state.relayOn,
  reason,
  nextState: {
    ...state,
    relayOn: false,
    lastChangeMs: state.relayOn ? nowMs : state.lastChangeMs,
    onStartedMs: undefined,
    onHits: 0,
    offHits: 0
  }
});

const isSensorStale = (
  measurement: ThermostatMeasurement,
  rule: ThermostatRule,
  nowMs: number
): boolean => {
  return nowMs - measurement.seenAtMs > rule.staleTimeoutSec * 1000;
};

export const calculateVpdKpa = (
  temperatureC: number | undefined,
  humidityPct: number | undefined
): number | undefined => {
  if (temperatureC === undefined || humidityPct === undefined) {
    return undefined;
  }

  const saturationVaporPressureKpa = calculateSaturationVaporPressureKpa(temperatureC);
  return saturationVaporPressureKpa * (1 - humidityPct / 100);
};

const calculateSaturationVaporPressureKpa = (temperatureC: number): number =>
  0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));

export const calculateTemperatureForVpdKpa = (
  targetKpa: number,
  humidityPct: number | undefined
): number | undefined => {
  if (humidityPct === undefined || humidityPct >= 100) {
    return undefined;
  }

  const humidityFactor = 1 - humidityPct / 100;
  const targetSaturationVaporPressureKpa = targetKpa / humidityFactor;
  if (targetSaturationVaporPressureKpa <= 0) {
    return undefined;
  }

  const vaporLog = Math.log(targetSaturationVaporPressureKpa / 0.6108);
  const denominator = 17.27 - vaporLog;
  if (denominator <= 0) {
    return undefined;
  }

  return (237.3 * vaporLog) / denominator;
};

export const calculateHumidityForVpdKpa = (
  targetKpa: number,
  temperatureC: number | undefined
): number | undefined => {
  if (temperatureC === undefined) {
    return undefined;
  }

  const saturationVaporPressureKpa = calculateSaturationVaporPressureKpa(temperatureC);
  if (saturationVaporPressureKpa <= 0) {
    return undefined;
  }

  return 100 * (1 - targetKpa / saturationVaporPressureKpa);
};

export const measurementControlValue = (
  measurement: ThermostatMeasurement,
  metric: RuleControlMetric
): number | undefined => {
  switch (metric) {
    case 'temperature':
      return measurement.temperatureC;
    case 'humidity':
      return measurement.humidityPct;
  }
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const vpdAssistMarginForMetric = (metric: RuleControlMetric): number => {
  switch (metric) {
    case 'temperature':
      return VPD_ASSIST_TEMPERATURE_MARGIN_C;
    case 'humidity':
      return VPD_ASSIST_HUMIDITY_MARGIN_PCT;
  }
};

const vpdAssistTargetForMetric = (
  metric: RuleControlMetric,
  targetKpa: number,
  measurement: ThermostatMeasurement
): number | undefined => {
  switch (metric) {
    case 'temperature':
      return calculateTemperatureForVpdKpa(targetKpa, measurement.humidityPct);
    case 'humidity':
      return calculateHumidityForVpdKpa(targetKpa, measurement.temperatureC);
  }
};

export interface EffectiveThresholdControl {
  control: ThresholdControl;
  vpdKpa?: number | undefined;
  vpdAssistTarget?: number | undefined;
  vpdAssistApplied: boolean;
}

export const resolveEffectiveThresholdControl = (
  rule: ThermostatRule,
  measurement: ThermostatMeasurement
): EffectiveThresholdControl => {
  const vpdKpa = calculateVpdKpa(measurement.temperatureC, measurement.humidityPct);
  const staticControl = {
    ...rule.control
  };

  if (!rule.vpdAssist.enabled) {
    return {
      control: staticControl,
      vpdKpa,
      vpdAssistApplied: false
    };
  }

  const target = vpdAssistTargetForMetric(
    rule.control.metric,
    rule.vpdAssist.targetKpa,
    measurement
  );
  if (target === undefined) {
    return {
      control: staticControl,
      vpdKpa,
      vpdAssistApplied: false
    };
  }

  const lowerLimit = Math.min(rule.control.onThreshold, rule.control.offThreshold);
  const upperLimit = Math.max(rule.control.onThreshold, rule.control.offThreshold);
  const clampedTarget = clamp(target, lowerLimit, upperLimit);
  const margin = vpdAssistMarginForMetric(rule.control.metric);
  const onThreshold =
    rule.control.direction === 'below'
      ? clamp(clampedTarget - margin, lowerLimit, upperLimit)
      : clamp(clampedTarget + margin, lowerLimit, upperLimit);
  const offThreshold =
    rule.control.direction === 'below'
      ? clamp(clampedTarget + margin, lowerLimit, upperLimit)
      : clamp(clampedTarget - margin, lowerLimit, upperLimit);

  return {
    control: {
      ...rule.control,
      onThreshold,
      offThreshold
    },
    vpdKpa,
    vpdAssistTarget: clampedTarget,
    vpdAssistApplied: true
  };
};

const applyRelayTarget = (
  input: AutomationInput,
  requestedRelayOn: boolean,
  reason: RelayDecisionReason,
  stateWithHits: AutomationState
): AutomationDecision => {
  const { rule, state, nowMs } = input;

  if (requestedRelayOn === state.relayOn) {
    return {
      requestedRelayOn,
      shouldCallRelay: false,
      reason,
      nextState: stateWithHits
    };
  }

  const lastChangeMs = state.lastChangeMs;
  if (
    requestedRelayOn &&
    lastChangeMs !== undefined &&
    nowMs - lastChangeMs < rule.minChangeMs
  ) {
    return {
      requestedRelayOn: state.relayOn,
      shouldCallRelay: false,
      reason: 'min-change-blocked',
      nextState: {
        ...stateWithHits,
        relayOn: state.relayOn
      }
    };
  }

  return {
    requestedRelayOn,
    shouldCallRelay: true,
    reason,
    nextState: {
      ...stateWithHits,
      relayOn: requestedRelayOn,
      lastChangeMs: nowMs,
      onStartedMs: requestedRelayOn ? nowMs : undefined
    }
  };
};

export const evaluateThresholdDecision = (input: AutomationInput): AutomationDecision => {
  const { rule, state, measurement, nowMs, event } = input;

  if (event === 'boot') {
    return offDecision(state, 'boot-safe-off', nowMs);
  }

  if (!measurement || isSensorStale(measurement, rule, nowMs)) {
    return offDecision(state, 'sensor-stale', nowMs);
  }

  if (
    state.relayOn &&
    state.onStartedMs !== undefined &&
    nowMs - state.onStartedMs >= rule.maxOnMs
  ) {
    return offDecision(state, 'max-on-time', nowMs);
  }

  const controlValue = measurementControlValue(measurement, rule.control.metric);
  if (controlValue === undefined) {
    return offDecision(state, 'control-value-missing', nowMs);
  }

  const lastSeenState = {
    ...state,
    lastSeenMs: measurement.seenAtMs
  };
  const effectiveThresholds = resolveEffectiveThresholdControl(rule, measurement);
  const { control } = effectiveThresholds;
  const isOnThresholdCrossed =
    control.direction === 'below'
      ? controlValue < control.onThreshold
      : controlValue > control.onThreshold;
  const isOffThresholdCrossed =
    control.direction === 'below'
      ? controlValue > control.offThreshold
      : controlValue < control.offThreshold;
  const onReason: RelayDecisionReason =
    control.direction === 'below' ? 'below-threshold' : 'above-threshold';
  const offReason: RelayDecisionReason =
    control.direction === 'below' ? 'above-threshold' : 'below-threshold';

  if (isOnThresholdCrossed) {
    const onHits = state.onHits + 1;
    const stateWithHits = {
      ...lastSeenState,
      onHits,
      offHits: 0
    };

    if (onHits < rule.consecutiveHits) {
      return {
        requestedRelayOn: state.relayOn,
        shouldCallRelay: false,
        reason: 'inside-band',
        nextState: stateWithHits
      };
    }

    return applyRelayTarget(input, true, onReason, stateWithHits);
  }

  if (isOffThresholdCrossed) {
    const offHits = state.offHits + 1;
    const stateWithHits = {
      ...lastSeenState,
      onHits: 0,
      offHits
    };

    return applyRelayTarget(input, false, offReason, stateWithHits);
  }

  return {
    requestedRelayOn: state.relayOn,
    shouldCallRelay: false,
    reason: 'inside-band',
    nextState: {
      ...lastSeenState,
      onHits: 0,
      offHits: 0
    }
  };
};

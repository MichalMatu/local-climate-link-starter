export type AutomationMode = 'heating' | 'cooling' | 'humidifying' | 'dehumidifying';

export type RuleControlMetric = 'temperature' | 'humidity';

export type ThresholdDirection = 'below' | 'above';

export type RulePresetId = AutomationMode;

export type RelayDecisionReason =
  | 'below-threshold'
  | 'above-threshold'
  | 'inside-band'
  | 'sensor-stale'
  | 'boot-safe-off'
  | 'max-on-time'
  | 'min-change-blocked'
  | 'control-value-missing';

export interface ThresholdControl {
  metric: RuleControlMetric;
  direction: ThresholdDirection;
  onThreshold: number;
  offThreshold: number;
}

export interface VpdAssistConfig {
  enabled: boolean;
  targetKpa: number;
}

export interface ThermostatRule {
  mode: AutomationMode;
  control: ThresholdControl;
  vpdAssist: VpdAssistConfig;
  staleTimeoutSec: number;
  minChangeMs: number;
  maxOnMs: number;
  rssiMin: number;
  consecutiveHits: number;
  failSafe: 'off';
  bootState: 'off';
}

export interface ThermostatMeasurement {
  temperatureC?: number;
  humidityPct?: number;
  rssi?: number;
  seenAtMs: number;
}

export interface AutomationState {
  relayOn: boolean;
  lastSeenMs?: number | undefined;
  lastChangeMs?: number | undefined;
  onStartedMs?: number | undefined;
  onHits: number;
  offHits: number;
}

export interface AutomationInput {
  rule: ThermostatRule;
  state: AutomationState;
  measurement?: ThermostatMeasurement | undefined;
  nowMs: number;
  event?: 'boot' | 'measurement' | undefined;
}

export interface AutomationDecision {
  requestedRelayOn: boolean;
  shouldCallRelay: boolean;
  reason: RelayDecisionReason;
  nextState: AutomationState;
}

export const DEFAULT_HEATING_RULE: ThermostatRule = {
  mode: 'heating',
  control: {
    metric: 'temperature',
    direction: 'below',
    onThreshold: 19,
    offThreshold: 20
  },
  staleTimeoutSec: 120,
  minChangeMs: 120_000,
  maxOnMs: 14_400_000,
  rssiMin: -85,
  consecutiveHits: 2,
  failSafe: 'off',
  bootState: 'off',
  vpdAssist: {
    enabled: false,
    targetKpa: 1.2
  }
};

export const DEFAULT_COOLING_RULE: ThermostatRule = {
  mode: 'cooling',
  control: {
    metric: 'temperature',
    direction: 'above',
    onThreshold: 26,
    offThreshold: 24
  },
  staleTimeoutSec: 120,
  minChangeMs: 120_000,
  maxOnMs: 14_400_000,
  rssiMin: -85,
  consecutiveHits: 2,
  failSafe: 'off',
  bootState: 'off',
  vpdAssist: {
    enabled: false,
    targetKpa: 1.2
  }
};

export const DEFAULT_HUMIDIFYING_RULE: ThermostatRule = {
  mode: 'humidifying',
  control: {
    metric: 'humidity',
    direction: 'below',
    onThreshold: 45,
    offThreshold: 55
  },
  staleTimeoutSec: 120,
  minChangeMs: 120_000,
  maxOnMs: 14_400_000,
  rssiMin: -85,
  consecutiveHits: 2,
  failSafe: 'off',
  bootState: 'off',
  vpdAssist: {
    enabled: false,
    targetKpa: 1.2
  }
};

export const DEFAULT_DEHUMIDIFYING_RULE: ThermostatRule = {
  mode: 'dehumidifying',
  control: {
    metric: 'humidity',
    direction: 'above',
    onThreshold: 65,
    offThreshold: 55
  },
  staleTimeoutSec: 120,
  minChangeMs: 120_000,
  maxOnMs: 14_400_000,
  rssiMin: -85,
  consecutiveHits: 2,
  failSafe: 'off',
  bootState: 'off',
  vpdAssist: {
    enabled: false,
    targetKpa: 1.2
  }
};

export const defaultRuleForPreset = (preset: RulePresetId): ThermostatRule => {
  switch (preset) {
    case 'heating':
      return DEFAULT_HEATING_RULE;
    case 'cooling':
      return DEFAULT_COOLING_RULE;
    case 'humidifying':
      return DEFAULT_HUMIDIFYING_RULE;
    case 'dehumidifying':
      return DEFAULT_DEHUMIDIFYING_RULE;
  }
};

export const createInitialAutomationState = (): AutomationState => ({
  relayOn: false,
  onHits: 0,
  offHits: 0
});

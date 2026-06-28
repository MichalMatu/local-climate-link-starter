import { createInitialAutomationState } from '../model.js';
import type {
  AutomationDecision,
  AutomationState,
  ThermostatMeasurement,
  ThermostatRule
} from '../model.js';
import { evaluateThresholdDecision } from '../thermostat/heating.js';

export interface SimulationPoint {
  nowMs: number;
  measurement?: ThermostatMeasurement | undefined;
}

export const simulateThresholdRule = (
  rule: ThermostatRule,
  points: readonly SimulationPoint[],
  initialState: AutomationState = createInitialAutomationState()
): AutomationDecision[] => {
  let state = initialState;

  return points.map((point) => {
    const decision = evaluateThresholdDecision({
      rule,
      state,
      measurement: point.measurement,
      nowMs: point.nowMs
    });
    state = decision.nextState;
    return decision;
  });
};

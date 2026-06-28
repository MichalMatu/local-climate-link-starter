import type { AutomationState } from '../model.js';

export const forceRelayOffState = (
  state: AutomationState,
  nowMs: number
): AutomationState => ({
  ...state,
  relayOn: false,
  lastChangeMs: state.relayOn ? nowMs : state.lastChangeMs,
  onStartedMs: undefined,
  onHits: 0,
  offHits: 0
});

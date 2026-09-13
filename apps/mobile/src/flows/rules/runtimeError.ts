export type RuleRuntimeErrorCode =
  | 'inventory-unavailable'
  | 'ownership-conflict'
  | 'runtime-mismatch'
  | 'runtime-unsupported'
  | 'clock-unsynced'
  | 'schedule-slots'
  | 'verification-failed'
  | 'safety-test-failed';

export class RuleRuntimeError extends Error {
  constructor(
    readonly code: RuleRuntimeErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'RuleRuntimeError';
  }
}

export const ruleRuntimeError = (
  code: RuleRuntimeErrorCode,
  message: string
): RuleRuntimeError => new RuleRuntimeError(code, message);

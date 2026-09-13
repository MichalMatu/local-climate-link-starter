import type { RegistryError } from '../registry/result.js';

export type RuleLifecycleErrorCode =
  | 'rule-missing'
  | 'rule-already-deployed'
  | 'rule-not-deployed'
  | 'invalid-draft'
  | 'device-missing'
  | 'registry-rejected'
  | 'runtime-attention';

export class RuleLifecycleError extends Error {
  constructor(
    readonly code: RuleLifecycleErrorCode,
    message: string,
    readonly registryError?: RegistryError
  ) {
    super(message);
    this.name = 'RuleLifecycleError';
  }
}

export const ruleLifecycleError = (
  code: RuleLifecycleErrorCode,
  message: string,
  registryError?: RegistryError
): RuleLifecycleError => new RuleLifecycleError(code, message, registryError);

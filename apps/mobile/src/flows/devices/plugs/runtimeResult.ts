import type { Result, ShellyClientError } from '@lcl/shelly-client';
import type { RelayConflict } from '../../rules/ownership.js';

export type PlugRuntimeError =
  | { kind: 'rpc-failed'; cause: ShellyClientError }
  | {
      kind:
        | 'identity-mismatch'
        | 'registration-invalid'
        | 'relay-unconfirmed'
        | 'script-unconfirmed'
        | 'script-not-managed'
        | 'relay-off-unconfirmed';
    }
  | { kind: 'relay-owned'; conflicts: RelayConflict[] }
  | { kind: 'script-owned'; ruleIds: string[] };
export type PlugRuntimeResult<T> =
  { ok: true; value: T } | { ok: false; error: PlugRuntimeError };

export const fromShellyResult = <T>(result: Result<T>): PlugRuntimeResult<T> =>
  result.ok ? result : { ok: false, error: { kind: 'rpc-failed', cause: result.error } };

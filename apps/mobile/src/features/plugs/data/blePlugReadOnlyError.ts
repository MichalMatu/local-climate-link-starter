import type { Result, ShellyClientError, ShellyErrorKind } from '@lcl/shelly-client';
import { shellyResultErrorMessage } from '../../../platform/shellyResult.js';

export class BlePlugReadOnlyError extends Error {
  readonly kind: ShellyErrorKind;
  readonly retryable: boolean;

  constructor(error: ShellyClientError) {
    super(shellyResultErrorMessage({ ok: false, error }));
    this.name = 'BlePlugReadOnlyError';
    this.kind = error.kind;
    this.retryable = error.retryable;
  }
}

export const isRecoverableBlePlugReadOnlyError = (
  error: unknown
): error is BlePlugReadOnlyError =>
  error instanceof BlePlugReadOnlyError &&
  error.retryable &&
  (error.kind === 'shelly-offline' || error.kind === 'timeout');

export const unwrapBlePlugReadOnlyResult = <T>(
  result: Result<T, ShellyClientError>
): T => {
  if (!result.ok) throw new BlePlugReadOnlyError(result.error);
  return result.value;
};

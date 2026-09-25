import type { ShellyClientError } from '../model.js';
import type { ShellyBleProtocolError } from './bleProtocol.js';

export const timeoutError = (timeoutMs: number): ShellyClientError => ({
  kind: 'timeout',
  userMessageKey: 'errors.timeout',
  technicalMessage: `Shelly BLE RPC timed out after ${timeoutMs} ms.`,
  retryable: true
});

export const canceledError = (): ShellyClientError => ({
  kind: 'timeout',
  userMessageKey: 'errors.timeout',
  technicalMessage: 'Shelly BLE RPC request was canceled.',
  retryable: false
});

const causeMessage = (cause: unknown): string => {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'message' in cause &&
    typeof cause.message === 'string'
  ) {
    return cause.message;
  }
  return 'Shelly BLE communication failed.';
};

export const offlineError = (cause: unknown): ShellyClientError => ({
  kind: 'shelly-offline',
  userMessageKey: 'errors.shellyOffline',
  technicalMessage: causeMessage(cause),
  retryable: true
});

export const protocolError = (error: ShellyBleProtocolError): ShellyClientError => ({
  kind: 'validation-failed',
  userMessageKey: 'errors.shellyInvalidResponse',
  technicalMessage: error.message,
  retryable: false
});

export const rpcError = (message?: string): ShellyClientError => ({
  kind: 'unknown',
  userMessageKey: 'errors.shellyRpc',
  technicalMessage: message ?? 'Shelly BLE RPC returned an error.',
  retryable: true
});

export const responseTooLargeError = (
  length: number,
  maximum: number
): ShellyClientError => ({
  kind: 'validation-failed',
  userMessageKey: 'errors.shellyInvalidResponse',
  technicalMessage: `Shelly BLE RPC response length ${length} exceeds limit ${maximum}.`,
  retryable: false
});

export const isShellyClientError = (value: unknown): value is ShellyClientError =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  'userMessageKey' in value &&
  'retryable' in value;

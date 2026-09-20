import type { ShellyClientError } from '../model.js';

export const validationError = (message: string): ShellyClientError => ({
  kind: 'validation-failed',
  userMessageKey: 'errors.validationFailed',
  technicalMessage: message,
  retryable: false
});

export const relayTestError = (message: string): ShellyClientError => ({
  kind: 'relay-test-failed',
  userMessageKey: 'errors.relayTestFailed',
  technicalMessage: message,
  retryable: true
});

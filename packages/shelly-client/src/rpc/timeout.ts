import type { Result, ShellyClientError } from '../model.js';

export const timeoutError = (timeoutMs: number): ShellyClientError => ({
  kind: 'timeout',
  userMessageKey: 'errors.timeout',
  technicalMessage: `Shelly RPC timed out after ${timeoutMs} ms.`,
  retryable: true
});

export const withTimeout = async <T>(
  task: Promise<T>,
  timeoutMs: number
): Promise<Result<T>> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(timeoutError(timeoutMs)), timeoutMs);
  });

  try {
    const value = await Promise.race([task, timeout]);
    return { ok: true, value };
  } catch (cause) {
    if (typeof cause === 'object' && cause && 'kind' in cause) {
      return { ok: false, error: cause as ShellyClientError };
    }

    return {
      ok: false,
      error: {
        kind: 'unknown',
        userMessageKey: 'errors.unknown',
        technicalMessage:
          cause instanceof Error ? cause.message : 'Unknown Shelly error.',
        retryable: true
      }
    };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};

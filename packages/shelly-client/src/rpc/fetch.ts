import type {
  Result,
  ShellyClientError,
  ShellyRpcRequest,
  ShellyRpcTransport
} from '../model.js';

export interface FetchShellyRpcTransportOptions {
  baseUrl: string;
  defaultTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

interface ShellyRpcEnvelope {
  id?: number | string | undefined;
  src?: string | undefined;
  result?: unknown;
  params?: unknown;
  error?: {
    code?: number | undefined;
    message?: string | undefined;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseErrorEnvelope = (value: unknown): ShellyRpcEnvelope['error'] | undefined => {
  if (!isRecord(value) || !isRecord(value.error)) {
    return undefined;
  }

  const code = typeof value.error.code === 'number' ? value.error.code : undefined;
  const message =
    typeof value.error.message === 'string' ? value.error.message : undefined;
  return { code, message };
};

const extractRpcPayload = (body: unknown): Result<unknown> => {
  const error = parseErrorEnvelope(body);
  if (error) {
    return {
      ok: false,
      error: {
        kind: 'unknown',
        userMessageKey: 'errors.shellyRpc',
        technicalMessage: error.message ?? `Shelly RPC error ${error.code ?? 'unknown'}.`,
        retryable: true
      }
    };
  }

  if (!isRecord(body)) {
    return { ok: true, value: body };
  }

  if ('result' in body) {
    return { ok: true, value: body.result };
  }

  if ('params' in body) {
    return { ok: true, value: body.params };
  }

  return { ok: true, value: body };
};

const httpError = (response: Response, bodyText: string): ShellyClientError => {
  if (bodyText.trim() === 'out_of_memory') {
    return {
      kind: 'script-upload-failed',
      userMessageKey: 'errors.scriptUploadFailed',
      technicalMessage: 'Shelly RPC reported out_of_memory during script upload.',
      retryable: true
    };
  }

  return {
    kind: 'unknown',
    userMessageKey: 'errors.shellyRpc',
    technicalMessage: `Shelly RPC HTTP ${response.status} ${response.statusText}`.trim(),
    retryable: response.status >= 500
  };
};

const invalidJsonError = (): ShellyClientError => ({
  kind: 'validation-failed',
  userMessageKey: 'errors.shellyInvalidResponse',
  technicalMessage:
    'Shelly RPC returned a non-JSON response. The address may point to another device.',
  retryable: false
});

const localShellyUrlError = (baseUrl: string): ShellyClientError => ({
  kind: 'validation-failed',
  userMessageKey: 'errors.validationFailed',
  technicalMessage: `Shelly RPC is limited to local network targets, got ${baseUrl}.`,
  retryable: false
});

const parseIpv4Octets = (host: string): number[] | null => {
  const parts = host.split('.');
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => Number(part));
  return octets.every(
    (octet, index) =>
      Number.isInteger(octet) && octet >= 0 && octet <= 255 && parts[index] !== ''
  )
    ? octets
    : null;
};

export const isLocalShellyHost = (host: string): boolean => {
  const normalized = host.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');

  if (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  ) {
    return true;
  }

  if (normalized.startsWith('fe80:')) {
    return true;
  }

  const octets = parseIpv4Octets(normalized);
  if (!octets) {
    return false;
  }

  const [first = 0, second = 0] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

const createShellyRpcUrl = (baseUrl: string): Result<URL> => {
  let url: URL;
  try {
    url = new URL('/rpc', baseUrl);
  } catch {
    return { ok: false, error: localShellyUrlError(baseUrl) };
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    !isLocalShellyHost(url.hostname)
  ) {
    return { ok: false, error: localShellyUrlError(baseUrl) };
  }

  return { ok: true, value: url };
};

export class FetchShellyRpcTransport implements ShellyRpcTransport {
  private readonly defaultTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private nextRequestId = 1;

  constructor(private readonly options: FetchShellyRpcTransportOptions) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async call<TResponse>(
    request: ShellyRpcRequest,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<Result<TResponse>> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const rpcUrl = createShellyRpcUrl(this.options.baseUrl);
    if (!rpcUrl.ok) {
      return rpcUrl;
    }

    const externalSignal = options?.signal ?? this.options.signal;
    const controller = new AbortController();
    const abortRequest = () => controller.abort();
    if (externalSignal?.aborted) {
      abortRequest();
    } else {
      externalSignal?.addEventListener('abort', abortRequest, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const id = this.nextRequestId;
    this.nextRequestId += 1;

    try {
      const response = await this.fetchImpl(rpcUrl.value, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id,
          method: request.method,
          ...(request.params === undefined ? {} : { params: request.params })
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const bodyText = await response.text();
        return { ok: false, error: httpError(response, bodyText) };
      }

      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch {
        return { ok: false, error: invalidJsonError() };
      }

      const payload = extractRpcPayload(responseBody);
      return payload.ok ? { ok: true, value: payload.value as TResponse } : payload;
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === 'AbortError';
      const error: ShellyClientError = timedOut
        ? externalSignal?.aborted
          ? {
              kind: 'timeout',
              userMessageKey: 'errors.timeout',
              technicalMessage: 'Shelly RPC request was canceled.',
              retryable: false
            }
          : {
              kind: 'timeout',
              userMessageKey: 'errors.timeout',
              technicalMessage: `Shelly RPC timed out after ${timeoutMs} ms.`,
              retryable: true
            }
        : {
            kind: 'shelly-offline',
            userMessageKey: 'errors.shellyOffline',
            technicalMessage:
              cause instanceof Error ? cause.message : 'Shelly RPC failed.',
            retryable: true
          };
      return { ok: false, error };
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortRequest);
    }
  }
}

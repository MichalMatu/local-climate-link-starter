import { FetchShellyRpcTransport } from '@lcl/shelly-client';
import {
  Capacitor,
  CapacitorHttp,
  type HttpHeaders,
  type HttpResponse
} from '@capacitor/core';

const SHELLY_DEV_PROXY_PATH = '/__lcl_shelly_proxy';
const DEFAULT_SHELLY_RPC_TIMEOUT_MS = 8000;

export type ShellyTransportOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

const shouldUseShellyDevProxy = (): boolean =>
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  window.location.protocol.startsWith('http');

const shouldUseNativeShellyHttp = (): boolean =>
  !shouldUseShellyDevProxy() &&
  Capacitor.isNativePlatform() &&
  Capacitor.isPluginAvailable('CapacitorHttp');

const resolveShellyRequestUrl = (targetUrl: URL): URL => {
  if (!shouldUseShellyDevProxy()) {
    return targetUrl;
  }

  const proxyUrl = new URL(SHELLY_DEV_PROXY_PATH, window.location.origin);
  proxyUrl.searchParams.set('target', targetUrl.toString());
  return proxyUrl;
};

const headersToRecord = (headers: HeadersInit | undefined): HttpHeaders => {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [key, value]));
  }
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, String(value)])
  );
};

const responseBodyToText = (response: HttpResponse): string => {
  if (typeof response.data === 'string') {
    return response.data;
  }
  if (response.data === undefined || response.data === null) {
    return '';
  }
  return JSON.stringify(response.data);
};

const abortError = (): DOMException =>
  new DOMException('Shelly request was canceled.', 'AbortError');

const nativeShellyFetch = async (
  targetUrl: URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> => {
  if (init?.signal?.aborted) {
    throw abortError();
  }

  const method = init?.method ?? 'GET';
  const body = typeof init?.body === 'string' ? init.body : undefined;
  let abortListener: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    abortListener = () => reject(abortError());
    init?.signal?.addEventListener('abort', abortListener, { once: true });
  });

  try {
    const nativeResponse = await Promise.race([
      CapacitorHttp.request({
        url: targetUrl.toString(),
        method,
        headers: headersToRecord(init?.headers),
        ...(body === undefined ? {} : { data: body }),
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
        responseType: 'text'
      }),
      abortPromise
    ]);

    return new Response(responseBodyToText(nativeResponse), {
      status: nativeResponse.status,
      headers: nativeResponse.headers
    });
  } finally {
    if (abortListener) {
      init?.signal?.removeEventListener('abort', abortListener);
    }
  }
};

export const createShellyFetch =
  (timeoutMs: number): typeof fetch =>
  async (input, init) => {
    const targetUrl =
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url);
    if (shouldUseNativeShellyHttp()) {
      return nativeShellyFetch(targetUrl, init, timeoutMs);
    }
    return fetch(resolveShellyRequestUrl(targetUrl), init);
  };

export const createShellyTransport = (
  baseUrl: string,
  options: ShellyTransportOptions = {}
): FetchShellyRpcTransport => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SHELLY_RPC_TIMEOUT_MS;
  return new FetchShellyRpcTransport({
    baseUrl,
    defaultTimeoutMs: timeoutMs,
    fetchImpl: createShellyFetch(timeoutMs),
    ...(options.signal ? { signal: options.signal } : {})
  });
};

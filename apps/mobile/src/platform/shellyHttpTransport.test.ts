import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  isPluginAvailable: vi.fn(() => false),
  request: vi.fn()
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
    isPluginAvailable: mocks.isPluginAvailable
  },
  CapacitorHttp: { request: mocks.request }
}));

import { createShellyFetch, createShellyTransport } from './shellyHttpTransport.js';

const response = (body: string, status = 200) =>
  Promise.resolve(new Response(body, { status }));

describe('shellyHttpTransport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.isNativePlatform.mockReturnValue(false);
    mocks.isPluginAvailable.mockReturnValue(false);
    mocks.request.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response('{}'))
    );
  });

  it('routes browser development requests through the Shelly dev proxy', async () => {
    const shellyFetch = createShellyFetch(3000);
    await shellyFetch(new URL('http://192.168.0.20/rpc'), { method: 'POST' });

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call).toBeDefined();
    const url = call?.[0];
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).pathname).toBe('/__lcl_shelly_proxy');
    expect((url as URL).searchParams.get('target')).toBe('http://192.168.0.20/rpc');
  });

  it('uses CapacitorHttp on native platforms when the plugin is available', async () => {
    vi.stubGlobal('window', undefined);
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.isPluginAvailable.mockReturnValue(true);
    mocks.request.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { ok: true },
      url: 'http://192.168.0.20/rpc'
    });

    const shellyFetch = createShellyFetch(4321);
    const result = await shellyFetch(new URL('http://192.168.0.20/rpc'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"id":1}'
    });

    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://192.168.0.20/rpc',
        method: 'POST',
        connectTimeout: 4321,
        readTimeout: 4321,
        responseType: 'text',
        data: '{"id":1}'
      })
    );
    expect(await result.text()).toBe('{"ok":true}');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('passes timeout and abort signal into the RPC transport boundary', () => {
    const controller = new AbortController();
    const transport = createShellyTransport('http://192.168.0.20', {
      timeoutMs: 3000,
      signal: controller.signal
    });

    expect(transport).toBeDefined();
  });
});

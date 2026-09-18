import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePlainShellyRuntime } from './usePlainShellyRuntime.js';

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const Probe = () => {
  const { status } = usePlainShellyRuntime(
    { id: 'plug-test', baseUrl: 'http://192.168.0.40/' },
    { refetchIntervalMs: 100 }
  );
  return <span>{status?.telemetry.powerW?.toFixed(1) ?? 'loading'}</span>;
};

describe('usePlainShellyRuntime', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('polls live plug telemetry with Shelly.GetStatus only', async () => {
    let statusReads = 0;
    const methods: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number | string;
          method?: string;
        };
        if (body.method) methods.push(body.method);
        expect(body.method).toBe('Shelly.GetStatus');
        statusReads += 1;
        const powerW = statusReads >= 2 ? 17.6 : 0;
        return jsonResponse({
          id: body.id ?? 1,
          result: {
            matter: { enabled: false },
            script: { enable: true },
            ble: { enable: true },
            'switch:0': {
              id: 0,
              output: powerW > 0,
              apower: powerW,
              voltage: 230,
              current: powerW > 0 ? 0.08 : 0,
              aenergy: { total: 10 }
            },
            wifi: { rssi: -50 },
            sys: { time: '12:00', unixtime: 1_782_667_904, uptime: 100 }
          }
        });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>
    );

    expect(await screen.findByText('0.0')).toBeVisible();
    await waitFor(() => expect(screen.getByText('17.6')).toBeVisible(), {
      timeout: 1000
    });
    expect(statusReads).toBeGreaterThanOrEqual(2);
    expect(new Set(methods)).toEqual(new Set(['Shelly.GetStatus']));
  });
});

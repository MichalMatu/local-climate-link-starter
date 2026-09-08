import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { createInstalledAutomation } from '../flows/installations/model.js';
import { ShellyLedSettingsCard } from '../screens/ShellyLedSettingsCard.js';

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const installation = () =>
  createInstalledAutomation({
    shelly: { id: 'shellyplugsg3-led-test', model: 'S3PL-00112EU', gen: 3 },
    shellyName: 'Salon',
    baseUrl: 'http://192.168.0.20/',
    scriptId: 1,
    scriptHash: 'lcl-led-test',
    config: createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    ),
    nowMs: 1000
  });

const renderCard = (onFeedback = vi.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return {
    onFeedback,
    ...render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <ShellyLedSettingsCard
            installation={installation()}
            onFeedback={onFeedback}
          />
        </QueryClientProvider>
      </I18nProvider>
    )
  };
};

describe('ShellyLedSettingsCard', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('reads and applies native PLUGS_UI LED presets without touching controls', async () => {
    let mode: 'power' | 'switch' | 'off' = 'power';
    const requests: Array<{ method?: string; params?: unknown }> = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number | string;
          method?: string;
          params?: {
            config?: {
              leds?: { mode?: 'power' | 'switch' | 'off' };
            };
          };
        };
        requests.push({ method: body.method, params: body.params });

        let result: unknown = {};
        switch (body.method) {
          case 'Shelly.ListMethods':
            result = {
              methods: [
                'Shelly.GetStatus',
                'PLUGS_UI.GetConfig',
                'PLUGS_UI.SetConfig'
              ]
            };
            break;
          case 'PLUGS_UI.GetConfig':
            result = {
              leds: {
                mode,
                colors: {
                  'switch:0': {
                    on: { rgb: [0, 100, 0], brightness: 100 },
                    off: { rgb: [100, 0, 0], brightness: 100 }
                  },
                  power: { brightness: 80 }
                }
              },
              controls: { 'switch:0': { in_mode: 'momentary' } }
            };
            break;
          case 'PLUGS_UI.SetConfig':
            mode = body.params?.config?.leds?.mode ?? mode;
            result = { restart_required: false };
            break;
          default:
            result = {};
        }

        return jsonResponse({ id: body.id ?? 1, result });
      })
    );

    const { onFeedback } = renderCard();

    expect(await screen.findByRole('heading', { name: 'LED gniazdka' })).toBeVisible();
    expect(screen.getByText('Zużycie energii')).toBeVisible();
    expect(screen.getByText('80%')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Sygnalizuj ON/OFF' }));

    expect(await screen.findByText('Stan przekaźnika')).toBeVisible();
    expect(screen.getByText('RGB 0/100/0 · 100%')).toBeVisible();
    expect(screen.getByText('RGB 100/0/0 · 100%')).toBeVisible();
    expect(onFeedback).toHaveBeenCalledWith(
      'ok',
      'LED pokazuje teraz stan przekaźnika.'
    );

    const relaySet = requests.find(
      (request) =>
        request.method === 'PLUGS_UI.SetConfig' &&
        JSON.stringify(request.params).includes('"switch"')
    );
    expect(relaySet?.params).toEqual({
      config: {
        leds: {
          mode: 'switch',
          colors: {
            'switch:0': {
              on: { rgb: [0, 100, 0], brightness: 100 },
              off: { rgb: [100, 0, 0], brightness: 100 }
            }
          }
        }
      }
    });
    expect(JSON.stringify(relaySet)).not.toContain('"controls"');

    fireEvent.click(screen.getByRole('button', { name: 'Wyłącz LED' }));

    expect(await screen.findByText('Wyłączona')).toBeVisible();
    expect(onFeedback).toHaveBeenCalledWith('ok', 'LED został wyłączony.');
  });

  it('shows unsupported firmware/device as a stable non-error state', async () => {
    const methods: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number | string;
          method?: string;
        };
        if (body.method) {
          methods.push(body.method);
        }
        return jsonResponse({
          id: body.id ?? 1,
          result:
            body.method === 'Shelly.ListMethods'
              ? { methods: ['Shelly.GetStatus', 'Switch.Set'] }
              : {}
        });
      })
    );

    renderCard();

    expect(
      await screen.findByText(
        'To urządzenie lub firmware nie udostępnia ustawień PLUGS_UI. Pozostałe funkcje działają normalnie.'
      )
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Sygnalizuj ON/OFF' })
    ).toBeNull();
    expect(methods).toEqual(['Shelly.ListMethods']);
  });
});

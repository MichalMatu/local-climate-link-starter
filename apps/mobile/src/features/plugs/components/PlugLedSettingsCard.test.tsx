import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import { deviceLedCopy } from '../../../app/locales/deviceLed.js';
import { PlugLedSettingsCard } from './PlugLedSettingsCard.js';

const copy = deviceLedCopy.pl;

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const target = {
  deviceId: 'shellyplugsg3-led-test',
  baseUrl: 'http://192.168.0.20/'
};

const deviceInfo = (id = target.deviceId) => ({
  id,
  model: 'S3PL-00112EU',
  gen: 3,
  fw_id: '20260311-095902/1.7.5-g9979d16'
});

const renderCard = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <PlugLedSettingsCard target={target} />
      </QueryClientProvider>
    </I18nProvider>
  );
};

describe('PlugLedSettingsCard', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('edits full Plug S LED settings with a narrow patch', async () => {
    let leds = {
      mode: 'switch' as const,
      colors: {
        'switch:0': {
          on: { rgb: [0, 100, 0] as [number, number, number], brightness: 100 },
          off: { rgb: [100, 0, 0] as [number, number, number], brightness: 100 }
        },
        power: { brightness: 80 }
      },
      night_mode: {
        enable: false,
        brightness: 10,
        active_between: ['22:00', '06:00'] as [string, string]
      }
    };
    const setParams: unknown[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number | string;
          method?: string;
          params?: { config?: { leds?: Record<string, unknown> } };
        };
        let result: unknown = {};
        if (body.method === 'Shelly.GetDeviceInfo') {
          result = deviceInfo();
        } else if (body.method === 'Shelly.ListMethods') {
          result = { methods: ['PLUGS_UI.GetConfig', 'PLUGS_UI.SetConfig'] };
        } else if (body.method === 'PLUGS_UI.GetConfig') {
          result = { leds, controls: { 'switch:0': { in_mode: 'momentary' } } };
        } else if (body.method === 'PLUGS_UI.SetConfig') {
          setParams.push(body.params);
          const patch = body.params?.config?.leds ?? {};
          const night = patch.night_mode as Partial<typeof leds.night_mode> | undefined;
          leds = {
            ...leds,
            ...(patch.mode ? { mode: patch.mode as typeof leds.mode } : {}),
            ...(night ? { night_mode: { ...leds.night_mode, ...night } } : {})
          };
          result = { restart_required: false };
        }
        return jsonResponse({ id: body.id ?? 1, result });
      })
    );

    renderCard();
    expect(await screen.findByLabelText(copy.nightBrightness)).toHaveValue(10);

    fireEvent.change(screen.getByLabelText(copy.nightBrightness), {
      target: { value: '7' }
    });
    fireEvent.change(screen.getByLabelText(copy.nightStart), {
      target: { value: '23:30' }
    });
    fireEvent.click(screen.getByRole('button', { name: copy.save }));

    expect(await screen.findByText(copy.saved)).toBeVisible();
    expect(setParams).toEqual([
      {
        config: {
          leds: {
            night_mode: {
              brightness: 7,
              active_between: ['23:30', '06:00']
            }
          }
        }
      }
    ]);
  });

  it('uses the in-app color editor and initializes custom ON/OFF colors visibly', async () => {
    const leds = {
      mode: 'switch' as const,
      colors: {
        'switch:0': {
          on: { rgb: null, brightness: 100 },
          off: { rgb: null, brightness: 100 }
        },
        power: { brightness: 80 }
      },
      night_mode: {
        enable: false,
        brightness: 10,
        active_between: ['22:00', '06:00'] as [string, string]
      }
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number;
          method?: string;
        };
        let result: unknown = {};
        if (body.method === 'Shelly.GetDeviceInfo') result = deviceInfo();
        if (body.method === 'Shelly.ListMethods') {
          result = { methods: ['PLUGS_UI.GetConfig', 'PLUGS_UI.SetConfig'] };
        }
        if (body.method === 'PLUGS_UI.GetConfig') {
          result = { leds, controls: { 'switch:0': { in_mode: 'momentary' } } };
        }
        return jsonResponse({ id: body.id ?? 1, result });
      })
    );

    const rendered = renderCard();
    const customColorToggles = await screen.findAllByRole('checkbox', {
      name: copy.customColor
    });
    expect(customColorToggles).toHaveLength(2);
    expect(rendered.container.querySelector('input[type="color"]')).toBeNull();
    const [onColorToggle, offColorToggle] = customColorToggles;
    if (!onColorToggle || !offColorToggle) throw new Error('Missing LED color toggles.');

    fireEvent.click(onColorToggle);
    expect(screen.getByRole('textbox', { name: `ON ${copy.color}` })).toHaveValue(
      '#00ff00'
    );

    fireEvent.click(offColorToggle);
    expect(screen.getByRole('textbox', { name: `OFF ${copy.color}` })).toHaveValue(
      '#ff0000'
    );
  });

  it('renders unsupported PLUGS_UI as a stable device capability state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number;
          method?: string;
        };
        return jsonResponse({
          id: body.id ?? 1,
          result:
            body.method === 'Shelly.GetDeviceInfo'
              ? deviceInfo()
              : body.method === 'Shelly.ListMethods'
                ? { methods: ['Shelly.GetStatus', 'Switch.Set'] }
                : {}
        });
      })
    );

    renderCard();
    expect(await screen.findByText(copy.unsupported)).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: copy.save })).toBeNull()
    );
  });

  it('rejects a reused endpoint when the physical Shelly id does not match', async () => {
    const methods: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number;
          method?: string;
        };
        if (body.method) methods.push(body.method);
        return jsonResponse({
          id: body.id ?? 1,
          result:
            body.method === 'Shelly.GetDeviceInfo'
              ? deviceInfo('shellyplugsg3-different-device')
              : {}
        });
      })
    );

    renderCard();
    expect(await screen.findByText(copy.unavailable)).toBeVisible();
    expect(methods).toEqual(['Shelly.GetDeviceInfo']);
  });
});

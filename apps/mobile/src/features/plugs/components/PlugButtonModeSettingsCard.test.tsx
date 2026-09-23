import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import { deviceButtonModeCopy } from '../../../app/locales/deviceButtonMode.js';
import { PlugButtonModeSettingsCard } from './PlugButtonModeSettingsCard.js';

const copy = deviceButtonModeCopy.pl;

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const target = {
  deviceId: 'shellyplugsg3-button-test',
  baseUrl: 'http://192.168.0.20/'
};

const deviceInfo = () => ({
  id: target.deviceId,
  model: 'S3PL-00112EU',
  gen: 3,
  fw_id: '20260311-095902/1.7.5-g9979d16'
});

const leds = {
  mode: 'switch',
  colors: {
    'switch:0': {
      on: { rgb: [0, 100, 0], brightness: 100 },
      off: { rgb: [100, 0, 0], brightness: 100 }
    },
    power: { brightness: 100 }
  },
  night_mode: { enable: false, brightness: 100, active_between: [] }
};

const renderCard = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  const rendered = render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <PlugButtonModeSettingsCard target={target} />
      </QueryClientProvider>
    </I18nProvider>
  );
  return { ...rendered, queryClient };
};

describe('PlugButtonModeSettingsCard', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('changes only PLUGS_UI physical button mode', async () => {
    let mode: 'momentary' | 'detached' = 'momentary';
    const setConfigs: unknown[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number | string;
          method?: string;
          params?: {
            config?: {
              controls?: { 'switch:0'?: { in_mode?: 'momentary' | 'detached' } };
            };
          };
        };
        let result: unknown = {};
        if (body.method === 'Shelly.GetDeviceInfo') {
          result = deviceInfo();
        } else if (body.method === 'Shelly.ListMethods') {
          result = { methods: ['PLUGS_UI.GetConfig', 'PLUGS_UI.SetConfig'] };
        } else if (body.method === 'PLUGS_UI.GetConfig') {
          result = { leds, controls: { 'switch:0': { in_mode: mode } } };
        } else if (body.method === 'PLUGS_UI.SetConfig') {
          setConfigs.push(body.params?.config);
          const nextMode = body.params?.config?.controls?.['switch:0']?.in_mode;
          if (nextMode) mode = nextMode;
          result = { restart_required: false };
        }
        return jsonResponse({ id: body.id ?? 1, result });
      })
    );

    renderCard();
    const modeSelect = await screen.findByRole('button', { name: copy.currentMode });
    const save = screen.getByRole('button', { name: copy.save });
    expect(modeSelect).toHaveTextContent(copy.momentary);
    expect(save).toBeDisabled();

    fireEvent.click(modeSelect);
    fireEvent.click(screen.getByRole('option', { name: copy.detached }));
    expect(modeSelect).toHaveTextContent(copy.detached);
    expect(save).toBeEnabled();
    fireEvent.click(save);

    expect(await screen.findByText(copy.saved)).toBeVisible();
    expect(setConfigs).toEqual([
      {
        controls: {
          'switch:0': { in_mode: 'detached' }
        }
      }
    ]);
    expect(JSON.stringify(setConfigs)).not.toContain('"leds"');
    expect(save).toBeDisabled();
  });

  it('does not overwrite a dirty button-mode draft when the device query refetches', async () => {
    const mode: 'momentary' | 'detached' = 'momentary';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number | string;
          method?: string;
        };
        const result =
          body.method === 'Shelly.GetDeviceInfo'
            ? deviceInfo()
            : body.method === 'Shelly.ListMethods'
              ? { methods: ['PLUGS_UI.GetConfig', 'PLUGS_UI.SetConfig'] }
              : body.method === 'PLUGS_UI.GetConfig'
                ? { leds, controls: { 'switch:0': { in_mode: mode } } }
                : {};
        return jsonResponse({ id: body.id ?? 1, result });
      })
    );

    const { queryClient } = renderCard();
    const modeSelect = await screen.findByRole('button', { name: copy.currentMode });
    fireEvent.click(modeSelect);
    fireEvent.click(screen.getByRole('option', { name: copy.detached }));
    expect(modeSelect).toHaveTextContent(copy.detached);

    await queryClient.refetchQueries({
      queryKey: ['plug-button-mode-settings', target.deviceId, target.baseUrl],
      exact: true
    });
    await waitFor(() => expect(modeSelect).toHaveTextContent(copy.detached));
  });

  it('renders missing control capability as unsupported without mutating anything', async () => {
    const methods: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number | string;
          method?: string;
        };
        if (body.method) methods.push(body.method);
        const result =
          body.method === 'Shelly.GetDeviceInfo'
            ? deviceInfo()
            : body.method === 'Shelly.ListMethods'
              ? { methods: ['PLUGS_UI.GetConfig', 'PLUGS_UI.SetConfig'] }
              : body.method === 'PLUGS_UI.GetConfig'
                ? { leds }
                : {};
        return jsonResponse({ id: body.id ?? 1, result });
      })
    );

    renderCard();
    expect(await screen.findByText(copy.unsupported)).toBeVisible();
    expect(methods).toEqual([
      'Shelly.GetDeviceInfo',
      'Shelly.ListMethods',
      'PLUGS_UI.GetConfig'
    ]);
    expect(screen.queryByRole('button', { name: copy.save })).toBeNull();
  });
});

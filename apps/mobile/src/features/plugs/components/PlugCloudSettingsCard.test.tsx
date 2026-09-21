import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import { deviceCloudCopy } from '../../../app/locales/deviceCloud.js';
import { PlugCloudSettingsCard } from './PlugCloudSettingsCard.js';

const copy = deviceCloudCopy.pl;

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const target = {
  deviceId: 'shellyplugsg3-cloud-test',
  baseUrl: 'http://192.168.0.30/'
};

const deviceInfo = () => ({
  id: target.deviceId,
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
        <PlugCloudSettingsCard target={target} />
      </QueryClientProvider>
    </I18nProvider>
  );
};

describe('PlugCloudSettingsCard', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('changes only the Shelly Cloud enable flag', async () => {
    let enabled = false;
    const setConfigs: unknown[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number | string;
          method?: string;
          params?: { config?: { enable?: boolean } };
        };
        let result: unknown = {};
        if (body.method === 'Shelly.GetDeviceInfo') {
          result = deviceInfo();
        } else if (body.method === 'Shelly.ListMethods') {
          result = { methods: ['Cloud.GetConfig', 'Cloud.SetConfig', 'Cloud.GetStatus'] };
        } else if (body.method === 'Cloud.GetConfig') {
          result = { enable: enabled, server: 'shelly-195-eu.shelly.cloud:6022/jrpc' };
        } else if (body.method === 'Cloud.GetStatus') {
          result = { connected: enabled };
        } else if (body.method === 'Cloud.SetConfig') {
          setConfigs.push(body.params?.config);
          if (body.params?.config?.enable !== undefined)
            enabled = body.params.config.enable;
          result = { restart_required: false };
        }
        return jsonResponse({ id: body.id ?? 1, result });
      })
    );

    renderCard();
    const toggle = await screen.findByRole('checkbox', { name: copy.enable });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(`${copy.connection}: ${copy.disconnected}`)).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: copy.save }));

    expect(await screen.findByText(copy.saved)).toBeVisible();
    expect(setConfigs).toEqual([{ enable: true }]);
    expect(screen.getByText(`${copy.connection}: ${copy.connected}`)).toBeVisible();
  });

  it('renders a missing writable Cloud surface as unsupported without mutating anything', async () => {
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
              ? { methods: ['Cloud.GetConfig', 'Cloud.GetStatus'] }
              : {};
        return jsonResponse({ id: body.id ?? 1, result });
      })
    );

    renderCard();
    expect(await screen.findByText(copy.unsupported)).toBeVisible();
    expect(methods).toEqual(['Shelly.GetDeviceInfo', 'Shelly.ListMethods']);
    expect(screen.queryByRole('button', { name: copy.save })).toBeNull();
  });
});

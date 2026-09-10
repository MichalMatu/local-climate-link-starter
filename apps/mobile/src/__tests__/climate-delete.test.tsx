import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  type ShellyRpcMethod
} from '@lcl/shelly-client';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { createInstalledAutomation } from '../flows/installations/model.js';
import { deleteInstalledAutomation } from '../flows/installations/runtimeControl.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';
import { InstallationDetailScreen } from '../screens/InstallationDetailScreen.js';

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  });

const installation = () => {
  const base = createDefaultShellyThermostatConfig(
    'xiaomi_lywsd03mmc_bthome_v2',
    'heating'
  );
  return createInstalledAutomation({
    shelly: { id: 'shellyplugsg3-delete', model: 'S3PL-00112EU', gen: 3 },
    shellyName: 'Salon',
    baseUrl: 'http://192.168.0.20/',
    scriptId: 1,
    scriptHash: 'lcl-delete',
    config: {
      ...base,
      sensor: {
        ...base.sensor,
        runtimeAddress: 'A4:C1:38:4F:24:CD',
        displayName: 'Przedpokój'
      }
    },
    nowMs: 1000
  });
};

const diagnosticPayload = () => ({
  v: 1,
  z: 'lcl-delete',
  s: ['A4:C1:38:4F:24:CD', 'Przedpokój'],
  q: [0, 0, 19, 20, 120, -85],
  y: ['14:00', 1_782_820_000, 3600],
  p: [true, 42.3, 230.1, 0.2, 1250, 32.4],
  g: [
    3_550_000,
    21.4,
    55.2,
    91,
    -51,
    true,
    'ok',
    3_500_000,
    3_540_000,
    0,
    0,
    21.4,
    1.31,
    19,
    20,
    3_560_000,
    'ok'
  ]
});

type ScriptEntry = {
  id: number;
  name: string;
  enable: boolean;
  running: boolean;
};

const installShellyDeleteMock = (options: { failDelete?: boolean } = {}) => {
  let relayOn = true;
  let scripts: ScriptEntry[] = [
    { id: 1, name: LOCAL_CLIMATE_LINK_SCRIPT_NAME, enable: true, running: true },
    { id: 77, name: 'User utility script', enable: true, running: true }
  ];
  const rpcCalls: Array<{ method: ShellyRpcMethod; params?: Record<string, unknown> }> = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof URL ? input.toString() : String(input);
      const target = new URL(url, 'http://localhost').searchParams.get('target');
      if (url.includes('/script/1/diag') || target?.includes('/script/1/diag')) {
        return jsonResponse(diagnosticPayload());
      }

      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number | string;
        method?: ShellyRpcMethod;
        params?: { id?: number; on?: boolean };
      };
      if (!body.method) {
        return jsonResponse({ id: body.id ?? 1, result: {} });
      }
      rpcCalls.push({
        method: body.method,
        ...(body.params ? { params: body.params as Record<string, unknown> } : {})
      });

      let result: unknown = {};
      switch (body.method) {
        case 'Shelly.GetDeviceInfo':
          result = { id: 'shellyplugsg3-delete', model: 'S3PL-00112EU', gen: 3 };
          break;
        case 'Shelly.GetStatus':
          result = {
            matter: { enabled: false },
            script: { enable: true },
            ble: { enable: true },
            'switch:0': { id: 0, output: relayOn },
            wifi: { rssi: -55 },
            sys: { time: '14:00', unixtime: 1_782_820_000, uptime: 3600 }
          };
          break;
        case 'Script.List':
          result = { scripts: structuredClone(scripts) };
          break;
        case 'Switch.Set':
          relayOn = body.params?.on ?? false;
          result = null;
          break;
        case 'Script.Stop':
          scripts = scripts.map((script) =>
            script.id === body.params?.id ? { ...script, running: false } : script
          );
          result = null;
          break;
        case 'Script.Delete':
          if (options.failDelete) {
            return jsonResponse({ error: 'delete failed' }, 500);
          }
          scripts = scripts.filter((script) => script.id !== body.params?.id);
          result = null;
          break;
        default:
          result = {};
      }

      return jsonResponse({ id: body.id ?? 1, result });
    })
  );

  return {
    get relayOn() {
      return relayOn;
    },
    get scripts() {
      return scripts;
    },
    rpcCalls
  };
};

const renderDetail = (installationId: string, onBack = vi.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return {
    onBack,
    ...render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <InstallationDetailScreen installationId={installationId} onBack={onBack} />
        </QueryClientProvider>
      </I18nProvider>
    )
  };
};

describe('climate automation delete', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    resetInstalledAutomationStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    resetInstalledAutomationStore();
    vi.unstubAllGlobals();
  });

  it('deletes only the exact managed script and leaves the relay OFF', async () => {
    const saved = installation();
    const shelly = installShellyDeleteMock();

    await deleteInstalledAutomation(saved);

    expect(shelly.relayOn).toBe(false);
    expect(shelly.scripts.some((script) => script.id === saved.script.id)).toBe(false);
    expect(shelly.scripts.some((script) => script.id === 77)).toBe(true);
    const deletes = shelly.rpcCalls.filter((call) => call.method === 'Script.Delete');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.params?.id).toBe(saved.script.id);
  });

  it('removes the local entry only after Shelly confirms deletion', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    const shelly = installShellyDeleteMock();
    const { onBack } = renderDetail(saved.id);

    fireEvent.click(await screen.findByRole('button', { name: 'Usuń automatykę' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Potwierdź usuń' }));

    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(
      useInstalledAutomationStore.getState().installations.some((item) => item.id === saved.id)
    ).toBe(false);
    expect(shelly.relayOn).toBe(false);
    expect(shelly.scripts.some((script) => script.id === 77)).toBe(true);
  });

  it('keeps the local entry when Shelly deletion fails', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    const shelly = installShellyDeleteMock({ failDelete: true });
    const { onBack } = renderDetail(saved.id);

    fireEvent.click(await screen.findByRole('button', { name: 'Usuń automatykę' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Potwierdź usuń' }));

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      await within(toastRegion).findByText(
        'Nie udało się bezpiecznie usunąć automatyki. Wpis pozostał w aplikacji.'
      )
    ).toBeVisible();
    expect(onBack).not.toHaveBeenCalled();
    expect(
      useInstalledAutomationStore.getState().installations.some((item) => item.id === saved.id)
    ).toBe(true);
    expect(shelly.relayOn).toBe(false);
  });
});

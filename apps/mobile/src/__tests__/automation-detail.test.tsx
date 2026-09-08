import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { createInstalledAutomation } from '../flows/installations/model.js';
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
    shelly: { id: 'shellyplugsg3-detail', model: 'S3PL-00112EU', gen: 3 },
    shellyName: 'Salon',
    baseUrl: 'http://192.168.0.20/',
    scriptId: 1,
    scriptHash: 'lcl-detail',
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
  z: 'lcl-detail',
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

const installShellyFetchMock = () => {
  let scriptRunning = true;
  let relayOn = true;
  const rpcMethods: string[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : String(input);
    const target = new URL(url, 'http://localhost').searchParams.get('target');
    if (url.includes('/script/1/diag') || target?.includes('/script/1/diag')) {
      return scriptRunning ? jsonResponse(diagnosticPayload()) : jsonResponse({}, 503);
    }

    const body = JSON.parse(String(init?.body ?? '{}')) as {
      id?: number | string;
      method?: string;
      params?: { id?: number; on?: boolean };
    };
    if (body.method) {
      rpcMethods.push(body.method);
    }

    let result: unknown = {};
    switch (body.method) {
      case 'Shelly.GetDeviceInfo':
        result = {
          id: 'shellyplugsg3-detail',
          model: 'S3PL-00112EU',
          gen: 3,
          fw_id: '20260311-095902/1.7.5-g9979d16'
        };
        break;
      case 'Shelly.GetStatus':
        result = {
          matter: { enabled: false },
          script: { enable: true },
          ble: { enable: true },
          'switch:0': {
            id: 0,
            output: relayOn,
            apower: relayOn ? 42.3 : 0,
            voltage: 230.1,
            current: relayOn ? 0.2 : 0,
            aenergy: { total: 1250 },
            temperature: { tC: 32.4 }
          },
          wifi: { rssi: -55 },
          sys: {
            time: '14:00',
            unixtime: 1_782_820_000,
            uptime: 3600,
            last_sync_ts: 1_782_819_900
          }
        };
        break;
      case 'Script.List':
        result = {
          scripts: [
            {
              id: 1,
              name: 'Local Climate Link Thermostat',
              enable: true,
              running: scriptRunning
            }
          ]
        };
        break;
      case 'Script.Stop':
        scriptRunning = false;
        result = null;
        break;
      case 'Script.Start':
        scriptRunning = true;
        result = null;
        break;
      case 'Switch.Set':
        relayOn = body.params?.on ?? false;
        result = null;
        break;
      default:
        result = {};
    }

    return jsonResponse({ id: body.id ?? 1, result });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { rpcMethods };
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

describe('InstallationDetailScreen', () => {
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

  it('shows a stable not-found route instead of falling back to another installation', () => {
    renderDetail('missing-installation');
    expect(
      screen.getByRole('heading', { name: 'Nie znaleziono automatyki' })
    ).toBeVisible();
  });

  it('shows Shelly runtime and safely pauses and resumes the exact installed script', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    const { rpcMethods } = installShellyFetchMock();

    renderDetail(saved.id);

    expect(await screen.findByText('Działa')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Salon' })).toBeVisible();
    expect(screen.getByText('21.4°C')).toBeVisible();
    expect(screen.getByText('55.2%')).toBeVisible();
    expect(screen.getByText('1.31 kPa')).toBeVisible();
    expect(screen.getAllByText('19°C / 20°C').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Przedpokój')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Wstrzymaj automatykę' }));

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      await within(toastRegion).findByText(
        'Automatyka zatrzymana, wyjście potwierdzone jako OFF.'
      )
    ).toBeVisible();
    expect(await screen.findByText('Wstrzymana')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Wznów automatykę' })).toBeVisible();
    expect(rpcMethods).toContain('Script.Stop');
    expect(rpcMethods).toContain('Switch.Set');

    fireEvent.click(screen.getByRole('button', { name: 'Wznów automatykę' }));

    expect(await within(toastRegion).findByText('Automatyka uruchomiona.')).toBeVisible();
    expect(await screen.findByText('Działa')).toBeVisible();
    expect(rpcMethods).toContain('Script.Start');
  });
});

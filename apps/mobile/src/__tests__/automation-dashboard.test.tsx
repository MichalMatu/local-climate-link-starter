import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { createInstalledAutomation } from '../flows/installations/model.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';
import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const controlRpcResult = (method: string | undefined): unknown => {
  switch (method) {
    case 'Shelly.GetDeviceInfo':
      return { id: 'shellyplugsg3-test', model: 'S3PL-00112EU', gen: 3 };
    case 'Shelly.GetStatus':
      return {
        matter: { enabled: false },
        script: { enable: true },
        ble: { enable: true },
        'switch:0': { id: 0, output: false },
        wifi: { rssi: -55 },
        sys: { time: '12:00', unixtime: 1_782_667_904, uptime: 12_345 }
      };
    case 'Script.List':
      return {
        scripts: [
          {
            id: 1,
            name: 'Local Climate Link Thermostat',
            enable: true,
            running: true
          }
        ]
      };
    default:
      return {};
  }
};

const diagnosticPayload = ({
  lastSeenUptimeMs = 12_300_000,
  uptimeSec = 12_345,
  effectiveOnThreshold = 19,
  effectiveOffThreshold = 20,
  dataState = 'ok'
}: {
  lastSeenUptimeMs?: number;
  uptimeSec?: number;
  effectiveOnThreshold?: number;
  effectiveOffThreshold?: number;
  dataState?: string;
} = {}) => ({
  v: 1,
  z: 'lcl-test',
  s: ['A4:C1:38:4F:24:CD', 'Xiaomi salon'],
  q: [0, 0, 19, 20, 120, -85],
  y: ['09:31', 1_782_667_904, uptimeSec],
  p: [true, 42.3, 230.1, 0.2, 1234, 31.2],
  g: [
    lastSeenUptimeMs,
    21.4,
    55.2,
    91,
    -51,
    true,
    'ok',
    12_250_000,
    12_290_000,
    0,
    0,
    21.4,
    1.31,
    effectiveOnThreshold,
    effectiveOffThreshold,
    12_320_000,
    dataState
  ]
});

const installedAutomation = () => {
  const base = createDefaultShellyThermostatConfig(
    'xiaomi_lywsd03mmc_bthome_v2',
    'heating'
  );
  return createInstalledAutomation({
    shelly: { id: 'shellyplugsg3-test', model: 'S3PL-00112EU', gen: 3 },
    shellyName: 'Salon',
    baseUrl: 'http://192.168.0.20/',
    scriptId: 1,
    scriptHash: 'lcl-test',
    config: {
      ...base,
      sensor: {
        ...base.sensor,
        runtimeAddress: 'A4:C1:38:4F:24:CD',
        displayName: 'Xiaomi salon'
      }
    },
    nowMs: 1000
  });
};

const renderDashboard = (onAddAutomation = vi.fn(), onOpenInstallation = vi.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return {
    onAddAutomation,
    onOpenInstallation,
    ...render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AutomationDashboardScreen
            onAddAutomation={onAddAutomation}
            onOpenInstallation={onOpenInstallation}
          />
        </QueryClientProvider>
      </I18nProvider>
    )
  };
};

describe('AutomationDashboardScreen', () => {
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

  it('shows a useful empty state', () => {
    const { onAddAutomation } = renderDashboard();

    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.getByText('Nie masz jeszcze zapisanej automatyki')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Skonfiguruj pierwszy system' }));
    expect(onAddAutomation).toHaveBeenCalledTimes(1);
  });

  it('shows live runtime values from Shelly for a saved installation', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(diagnosticPayload()))
    );

    renderDashboard();

    expect(await screen.findByText('21.4°C')).toBeVisible();
    expect(screen.getByText('55.2%')).toBeVisible();
    expect(screen.getByText('1.31 kPa')).toBeVisible();
    expect(screen.getByText('Salon')).toBeVisible();
    expect(screen.getByText('Xiaomi salon')).toBeVisible();
    expect(screen.getByText('Działa')).toBeVisible();
    expect(screen.getByText('ON')).toBeVisible();
    expect(screen.getByText('19°C / 20°C')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Szczegóły' })).toBeVisible();
  });

  it('marks an old Shelly sensor reading as stale', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          diagnosticPayload({ lastSeenUptimeMs: 12_000_000, uptimeSec: 12_345 })
        )
      )
    );

    renderDashboard();

    expect(await screen.findByText('Dane nieaktualne')).toBeVisible();
  });

  it('uses effective runtime thresholds and recovers after a manual refresh', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());
    let diagnosticAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof URL ? input.toString() : String(input);
      const target = new URL(url, 'http://localhost').searchParams.get('target');
      if (url.includes('/script/1/diag') || target?.includes('/script/1/diag')) {
        diagnosticAttempts += 1;
        if (diagnosticAttempts === 1) {
          throw new Error('offline');
        }
        return jsonResponse(
          diagnosticPayload({ effectiveOnThreshold: 19.25, effectiveOffThreshold: 19.75 })
        );
      }

      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number | string;
        method?: string;
      };
      return jsonResponse({ id: body.id ?? 1, result: controlRpcResult(body.method) });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDashboard();

    expect(await screen.findByText('Wymaga uwagi')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Odśwież' }));

    expect(await screen.findByText('Działa')).toBeVisible();
    expect(screen.getByText('19.25°C / 19.75°C')).toBeVisible();
    expect(diagnosticAttempts).toBe(2);
  });

  it('shows offline without replacing runtime values with phone BLE data', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline')))
    );

    renderDashboard();

    expect(await screen.findByText('Offline')).toBeVisible();
    expect(screen.getByText('Brak połączenia z Shelly.')).toBeVisible();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });
});

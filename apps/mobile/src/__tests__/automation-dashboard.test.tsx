import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import {
  createInstalledAutomation,
  createTimeInstalledAutomation
} from '../flows/installations/model.js';
import { dailyScheduleTimespec } from '../flows/time-automation/config.js';
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

const timeInstalledAutomation = () =>
  createTimeInstalledAutomation({
    shelly: { id: 'shellyplugsg3-time-test', model: 'S3PL-00112EU', gen: 3 },
    shellyName: 'Lampa',
    baseUrl: 'http://192.168.0.21/',
    onJobId: 7,
    offJobId: 8,
    config: { relayId: 0, onTime: '08:00', offTime: '20:00' },
    nowMs: 1000
  });

const installTimeShellyFetchMock = () => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      id?: number | string;
      method?: string;
    };
    let result: unknown = {};
    if (body.method === 'Shelly.GetStatus') {
      result = {
        matter: { enabled: false },
        script: { enable: true },
        ble: { enable: true },
        'switch:0': { id: 0, output: true },
        wifi: { rssi: -55 },
        sys: {
          time: '12:00',
          unixtime: 1_800_000_000,
          uptime: 3600,
          last_sync_ts: 1_799_999_900
        }
      };
    } else if (body.method === 'Schedule.List') {
      result = {
        jobs: [
          {
            id: 7,
            enable: true,
            timespec: dailyScheduleTimespec('08:00'),
            calls: [{ method: 'Switch.Set', params: { id: 0, on: true } }]
          },
          {
            id: 8,
            enable: true,
            timespec: dailyScheduleTimespec('20:00'),
            calls: [{ method: 'Switch.Set', params: { id: 0, on: false } }]
          }
        ],
        rev: 1
      };
    }
    return jsonResponse({ id: body.id ?? 1, result });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const renderDashboard = (
  onAddAutomation = vi.fn(),
  onOpenInstallation = vi.fn(),
  onOpenSettings = vi.fn()
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return {
    onAddAutomation,
    onOpenInstallation,
    onOpenSettings,
    queryClient,
    ...render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AutomationDashboardScreen
            onAddAutomation={onAddAutomation}
            onOpenInstallation={onOpenInstallation}
            onOpenSettings={onOpenSettings}
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

  it('does not duplicate the canonical zero-installation state', () => {
    const { onAddAutomation } = renderDashboard();

    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.queryByText('Nie masz jeszcze zapisanej automatyki')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
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
    expect(screen.queryByText('Działa')).toBeNull();
    expect(screen.getAllByText('ON').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('19°C / 20°C')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Klimat' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const timeNav = screen.getByRole('button', { name: 'Czas' });
    expect(timeNav).toBeEnabled();
    fireEvent.click(timeNav);
    expect(screen.getByText('Brak automatyzacji')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Klimat' }));
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Szczegóły' })).toBeVisible();
  });

  it('shows a native time schedule and opens it by stable installation id', async () => {
    const installation = timeInstalledAutomation();
    useInstalledAutomationStore.getState().upsertInstallation(installation);
    installTimeShellyFetchMock();
    const onOpenInstallation = vi.fn();

    renderDashboard(vi.fn(), onOpenInstallation);

    expect(await screen.findByText('Harmonogram dzienny')).toBeVisible();
    expect(screen.getByText('Lampa')).toBeVisible();
    expect(screen.getByText('08:00')).toBeVisible();
    expect(screen.getByText('20:00')).toBeVisible();
    expect(screen.getByText('Natywny Shelly Schedule')).toBeVisible();
    expect(await screen.findByText('Działa')).toBeVisible();
    expect(screen.getByText('ON')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const climateNav = screen.getByRole('button', { name: 'Klimat' });
    expect(climateNav).toBeEnabled();
    fireEvent.click(climateNav);
    expect(screen.getByText('Brak automatyzacji')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));

    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły' }));
    expect(onOpenInstallation).toHaveBeenCalledWith(installation.id);
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

  it('uses effective runtime thresholds and recovers without a manual refresh control', async () => {
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

    const { queryClient } = renderDashboard();

    expect(await screen.findByText('Wymaga uwagi')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Odśwież' })).toBeNull();
    await queryClient.refetchQueries({
      predicate: (query) => query.queryKey[0] === 'installed-automation-diagnostics'
    });

    await waitFor(() => expect(screen.queryByText('Wymaga uwagi')).toBeNull());
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
    expect(screen.queryByText('Brak połączenia z Shelly.')).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });
});

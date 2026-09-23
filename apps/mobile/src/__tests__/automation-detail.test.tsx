import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import type { ShellyScheduleJob } from '@lcl/shelly-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import {
  createInstalledAutomation,
  createTimeInstalledAutomation
} from '../flows/installations/model.js';
import { dailyScheduleTimespec } from '../flows/time-automation/config.js';
import {
  resetHardwareSetupDraftStore,
  useHardwareSetupDraftStore
} from '../flows/hardware-setup/setupDraftStore.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';
import { InstallationDetailScreen } from '../screens/InstallationDetailScreen.js';
import { renderWithAppToastHost } from '../test/renderWithAppToastHost.js';

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
        sensorId: 'sensor-a4c1384f24cd',
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
  d: [['A4C1384F24CD', 21.4, 55.2, 91, -51, 3_550_000, 1]],
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

type ShellyFetchMockOptions = {
  offline?: boolean;
  diagnostics?: 'ok' | 'stale';
  scriptId?: number | null;
};

const installShellyFetchMock = (options: ShellyFetchMockOptions = {}) => {
  let scriptRunning = true;
  let relayOn = true;
  let runtimeMode = 0;
  const rpcMethods: string[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : String(input);
    const target = new URL(url, 'http://localhost').searchParams.get('target');
    if (url.includes('/script/1/diag') || target?.includes('/script/1/diag')) {
      if (options.offline || !scriptRunning) {
        return jsonResponse({}, 503);
      }

      const payload = diagnosticPayload();
      if (options.diagnostics === 'stale') {
        payload.g[16] = 'st';
      }
      return jsonResponse(payload);
    }

    const body = JSON.parse(String(init?.body ?? '{}')) as {
      id?: number | string;
      method?: string;
      params?: { id?: number; on?: boolean; code?: string };
    };
    if (body.method) {
      rpcMethods.push(body.method);
    }

    if (options.offline) {
      return jsonResponse({ error: 'offline' }, 503);
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
      case 'Script.List': {
        const scriptId = options.scriptId === undefined ? 1 : options.scriptId;
        result = {
          scripts:
            scriptId === null
              ? []
              : [
                  {
                    id: scriptId,
                    name: 'Local Climate Link Thermostat',
                    enable: true,
                    running: scriptRunning
                  }
                ]
        };
        break;
      }
      case 'Script.GetCode':
        result = { data: '// deployed exact source', left: 0 };
        break;
      case 'Script.GetStatus':
        result = {
          running: scriptRunning,
          mem_used: 2660,
          mem_peak: 6804,
          mem_free: 22442,
          cpu: 15.2
        };
        break;
      case 'Sys.GetStatus':
        result = { ram_size: 259128, ram_free: 90000 };
        break;
      case 'Script.Eval': {
        const code = body.params?.code ?? '';
        if (code.includes('R.m=1')) {
          runtimeMode = 1;
        } else if (code.includes('R.m=0')) {
          runtimeMode = 0;
        }
        result = { result: String(runtimeMode) };
        break;
      }
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

const timeInstallation = () =>
  createTimeInstalledAutomation({
    shelly: { id: 'shellyplugsg3-time-detail', model: 'S3PL-00112EU', gen: 3 },
    shellyName: 'Lampa',
    baseUrl: 'http://192.168.0.21/',
    onJobId: 7,
    offJobId: 8,
    config: { relayId: 0, onTime: '08:00', offTime: '20:00' },
    nowMs: 1000
  });

const installTimeShellyFetchMock = () => {
  let relayOn = true;
  let rev = 1;
  let jobs: ShellyScheduleJob[] = [
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
  ];
  const rpcMethods: string[] = [];

  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      id?: number | string;
      method?: string;
      params?: {
        id?: number;
        on?: boolean;
        enable?: boolean;
        timespec?: string;
        calls?: Array<{ method: string; params?: Record<string, unknown> }>;
      };
    };
    if (body.method) {
      rpcMethods.push(body.method);
    }

    let result: unknown = {};
    switch (body.method) {
      case 'Shelly.GetDeviceInfo':
        result = {
          id: 'shellyplugsg3-time-detail',
          model: 'S3PL-00112EU',
          gen: 3
        };
        break;
      case 'Shelly.GetStatus':
        result = {
          matter: { enabled: false },
          script: { enable: true },
          ble: { enable: true },
          'switch:0': { id: 0, output: relayOn },
          wifi: { rssi: -55 },
          sys: {
            time: '12:00',
            unixtime: 1_800_000_000,
            uptime: 3600,
            last_sync_ts: 1_799_999_900
          }
        };
        break;
      case 'Schedule.List':
        result = { jobs: structuredClone(jobs), rev };
        break;
      case 'Schedule.Update': {
        const jobId = body.params?.id;
        const index = jobs.findIndex((job) => job.id === jobId);
        if (index >= 0) {
          const current = jobs[index]!;
          jobs[index] = {
            ...current,
            ...(body.params?.enable === undefined ? {} : { enable: body.params.enable }),
            ...(body.params?.timespec === undefined
              ? {}
              : { timespec: body.params.timespec }),
            ...(body.params?.calls === undefined ? {} : { calls: body.params.calls })
          };
          rev += 1;
        }
        result = { rev };
        break;
      }
      case 'Schedule.Delete':
        jobs = jobs.filter((job) => job.id !== body.params?.id);
        rev += 1;
        result = { rev };
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
  return {
    get jobs() {
      return jobs;
    },
    get relayOn() {
      return relayOn;
    },
    rpcMethods
  };
};

const renderDetail = (
  installationId: string,
  onBack = vi.fn(),
  onOpenBleDiscovery = vi.fn(),
  onEdit = vi.fn()
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return {
    onBack,
    onOpenBleDiscovery,
    onEdit,
    ...renderWithAppToastHost(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <InstallationDetailScreen
            installationId={installationId}
            onBack={onBack}
            onOpenBleDiscovery={onOpenBleDiscovery}
            onEdit={onEdit}
          />
        </QueryClientProvider>
      </I18nProvider>
    )
  };
};

describe('InstallationDetailScreen', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    resetInstalledAutomationStore();
    resetHardwareSetupDraftStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    resetInstalledAutomationStore();
    resetHardwareSetupDraftStore();
    vi.unstubAllGlobals();
  });

  it('shows a stable not-found child page instead of falling back to another installation', () => {
    const onBack = vi.fn();
    renderDetail('missing-installation', onBack);

    expect(
      screen.getByRole('heading', { name: 'Nie znaleziono automatyki' })
    ).toBeVisible();
    expect(screen.queryByText('Local Climate Link')).toBeNull();
    const back = screen.getByRole('button', { name: '‹ Gniazdka' });
    expect(back).toBeVisible();
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps physical Plug settings in the Device tab instead of a nested settings page', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    installShellyFetchMock();
    renderDetail(saved.id);

    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia gniazdka' }));
    expect(await screen.findByRole('heading', { name: 'LED gniazdka' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Przycisk gniazdka' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Shelly Cloud' })).toBeVisible();
  });

  it('renders climate editing inline without a separate Edit action', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    installShellyFetchMock();
    renderDetail(saved.id);

    const save = await screen.findByRole('button', { name: 'Zapisz zmiany' });
    expect(save).toBeVisible();
    expect(save).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Edytuj' })).toBeNull();
  });

  it('uses one detail surface without child-page Back chrome', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    installShellyFetchMock();
    renderDetail(saved.id);

    expect(screen.queryByRole('button', { name: '‹ Gniazdka' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Automatyka' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Bluetooth' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ustawienia gniazdka' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Skrypt' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Informacje' })).toBeVisible();
  });

  it('does not repeat the dashboard name, rename control, or climate-purpose heading', async () => {
    const saved = installation();
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: saved.shelly.deviceId,
      name: 'Salon',
      baseUrl: 'http://192.168.0.20/',
      scriptIdInput: '1'
    });
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    installShellyFetchMock();

    renderDetail(saved.id);

    expect(screen.queryByRole('heading', { name: 'Salon' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nazwa gniazdka' })).toBeNull();
    expect(screen.queryByText('Sterowanie temperaturą')).toBeNull();
  });

  it('separates automation, BLE and device telemetry without dashboard duplication', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    installShellyFetchMock();
    renderDetail(saved.id);

    const automationSurface = screen.getByRole('region', { name: 'Stan bieżący' });
    expect(within(automationSurface).getByText('Powód automatyzacji')).toBeVisible();
    expect(within(automationSurface).getByText('Wyjście automatyzacji')).toBeVisible();
    expect(within(automationSurface).getByText('Stan przekaźnika')).toBeVisible();
    expect(within(automationSurface).getAllByText('Przedpokój').length).toBeGreaterThan(
      0
    );
    expect(screen.queryByRole('heading', { name: 'Automatyka' })).toBeNull();
    expect(screen.queryByText('0.20 A')).toBeNull();
    expect(screen.queryByText('32.4°C')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Bluetooth' }));
    expect(await screen.findByText('Przedpokój')).toBeVisible();
    expect(await screen.findByText('91%')).toBeVisible();
    expect(await screen.findByText('-51 dBm')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Informacje' }));
    expect(await screen.findByText('0.20 A')).toBeVisible();
    expect(await screen.findByText('32.4°C')).toBeVisible();
    expect(await screen.findByText('S3PL-00112EU, gen 3')).toBeVisible();
  });

  it('keeps technical diagnostics in Info and leaves Script focused on source', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    const { rpcMethods } = installShellyFetchMock();
    renderDetail(saved.id);

    fireEvent.click(screen.getByRole('button', { name: 'Informacje' }));
    expect(await screen.findByText('CPU skryptu')).toBeVisible();
    expect(screen.getByText('Stan skryptu RPC')).toBeVisible();
    await waitFor(() => expect(rpcMethods).toContain('Script.GetStatus'));
    expect(rpcMethods).toContain('Sys.GetStatus');
    const before = rpcMethods.filter((method) => method === 'Script.GetStatus').length;
    await waitFor(
      () =>
        expect(
          rpcMethods.filter((method) => method === 'Script.GetStatus').length
        ).toBeGreaterThan(before),
      { timeout: 5_000 }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skrypt' }));
    expect(await screen.findByText('// deployed exact source')).toBeVisible();
    expect(screen.queryByText('CPU skryptu')).toBeNull();
    expect(screen.queryByText('Stan skryptu RPC')).toBeNull();
  });

  it('shows the deployed script directly in the Script tab with no nested page', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    const { rpcMethods } = installShellyFetchMock();
    renderDetail(saved.id);

    fireEvent.click(screen.getByRole('button', { name: 'Skrypt' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByText('// deployed exact source')).toBeVisible();
    expect(rpcMethods).toContain('Script.GetCode');
  });

  it.each([
    {
      name: 'offline',
      options: { offline: true },
      heading: 'Shelly offline'
    },
    {
      name: 'stale sensor',
      options: { diagnostics: 'stale' as const },
      heading: 'Brak świeżych danych z czujnika'
    },
    {
      name: 'ownership mismatch',
      options: { scriptId: 2 },
      heading: 'Problem właściciela wyjścia'
    }
  ])('offers read-only recovery for $name state', async ({ options, heading }) => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    const { rpcMethods } = installShellyFetchMock(options);

    renderDetail(saved.id);

    expect(await screen.findByText(heading)).toBeVisible();
    const refresh = screen.getByRole('button', { name: 'Sprawdź ponownie' });
    expect(refresh).toBeVisible();

    fireEvent.click(refresh);
    expect(await screen.findByText(heading)).toBeVisible();
    expect(rpcMethods).not.toContain('Script.Start');
    expect(rpcMethods).not.toContain('Script.Stop');
    expect(rpcMethods).not.toContain('Switch.Set');
  });

  it('manages a native daily schedule end to end without a climate script owner', async () => {
    const saved = timeInstallation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    const shelly = installTimeShellyFetchMock();
    const onBack = vi.fn();

    const rendered = renderDetail(saved.id, onBack);

    expect(await screen.findByText('Działa')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Lampa' })).toBeVisible();
    expect(screen.getAllByText('08:00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('20:00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Natywny Shelly Schedule')).toBeVisible();
    expect(screen.getByText('ON', { exact: true })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Wstrzymaj automatykę' }));
    expect(await screen.findByText('Wstrzymana')).toBeVisible();
    expect(shelly.relayOn).toBe(false);
    expect(shelly.jobs.every((job) => !job.enable)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Wznów automatykę' }));
    expect(await screen.findByText('Działa')).toBeVisible();
    expect(shelly.relayOn).toBe(true);
    expect(shelly.jobs.every((job) => job.enable)).toBe(true);

    const edit = screen.getByRole('button', { name: 'Edytuj' });
    fireEvent.click(edit);
    expect(rendered.onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Usuń automatykę czasową' }));
    const dialog = screen.getByRole('dialog', { name: 'Usunąć automatykę czasową?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Potwierdź usuń' }));

    expect(
      await screen.findByRole('heading', { name: 'Nie znaleziono automatyki' })
    ).toBeVisible();
    expect(shelly.jobs).toEqual([]);
    expect(shelly.relayOn).toBe(false);
    expect(useInstalledAutomationStore.getState().installations).toEqual([]);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(shelly.rpcMethods).toContain('Schedule.Update');
    expect(shelly.rpcMethods).toContain('Schedule.Delete');
  });
});

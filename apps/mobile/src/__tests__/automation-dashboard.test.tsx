import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react';
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
import {
  resetHardwareSetupDraftStore,
  useHardwareSetupDraftStore
} from '../flows/hardware-setup/setupDraftStore.js';
import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';

vi.mock('../flows/hardware-setup/useHardwareSetupFlow.js', () => ({
  useHardwareSetupFlow: () => {
    throw new Error('Thermometer dashboard must not mount the full hardware setup flow.');
  }
}));

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const CLIMATE_PULSE_TEST_WAIT_MS = 700;

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
    case 'Script.Eval':
      return { result: '0' };
    default:
      return {};
  }
};

const diagnosticPayload = ({
  lastSeenUptimeMs = 12_300_000,
  uptimeSec = 12_345,
  effectiveOnThreshold = 19,
  effectiveOffThreshold = 20,
  lastVpd = 1.31,
  dataState = 'ok',
  plugRelayOn = true,
  ruleRelayOn = true
}: {
  lastSeenUptimeMs?: number;
  uptimeSec?: number;
  effectiveOnThreshold?: number;
  effectiveOffThreshold?: number;
  lastVpd?: number | null;
  dataState?: string;
  plugRelayOn?: boolean;
  ruleRelayOn?: boolean;
} = {}) => ({
  v: 1,
  z: 'lcl-test',
  s: ['A4:C1:38:4F:24:CD', 'Xiaomi salon'],
  q: [0, 0, 19, 20, 120, -85],
  y: ['09:31', 1_782_667_904, uptimeSec],
  p: [plugRelayOn, 42.3, 230.1, 0.2, 1234, 31.2],
  g: [
    lastSeenUptimeMs,
    21.4,
    55.2,
    91,
    -51,
    ruleRelayOn,
    'ok',
    12_250_000,
    12_290_000,
    0,
    0,
    21.4,
    lastVpd,
    effectiveOnThreshold,
    effectiveOffThreshold,
    12_320_000,
    dataState
  ]
});

const installedAutomation = (vpdAssistEnabled = false) => {
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
      rule: {
        ...base.rule,
        vpdAssist: {
          ...base.rule.vpdAssist,
          enabled: vpdAssistEnabled
        }
      },
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
  onOpenPlugSettings = vi.fn(),
  onAddPlug = vi.fn(),
  onAddThermometer = vi.fn(),
  initialKind: 'climate' | 'time' = 'climate'
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const view = (kind: 'climate' | 'time') => (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <AutomationDashboardScreen
          initialKind={kind}
          onAddPlug={onAddPlug}
          onAddThermometer={onAddThermometer}
          onAddAutomation={onAddAutomation}
          onOpenInstallation={onOpenInstallation}
          onOpenPlugSettings={onOpenPlugSettings}
        />
      </QueryClientProvider>
    </I18nProvider>
  );
  const rendered = render(view(initialKind));
  return {
    onAddAutomation,
    onOpenInstallation,
    onOpenPlugSettings,
    onAddPlug,
    onAddThermometer,
    queryClient,
    ...rendered,
    rerenderKind: (kind: 'climate' | 'time') => rendered.rerender(view(kind))
  };
};

describe('AutomationDashboardScreen', () => {
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

  it('uses the Plugs FAB only for adding a physical plug', () => {
    const onAddPlug = vi.fn();
    const { onAddAutomation } = renderDashboard(vi.fn(), vi.fn(), vi.fn(), onAddPlug);

    expect(screen.getByRole('main', { name: 'Gniazdka' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Gniazdka' })).toBeNull();
    expect(screen.queryByText('Nie masz jeszcze zapisanej automatyki')).toBeNull();
    const plugEmptyState = screen.getByRole('status');
    expect(within(plugEmptyState).getByText('Brak dodanych gniazdek.')).toBeVisible();
    expect(screen.queryByText('Brak automatyzacji')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));
    expect(onAddPlug).toHaveBeenCalledTimes(1);
    expect(onAddAutomation).not.toHaveBeenCalled();
  });

  it('associates a saved Plug with its automation by stable device id, not endpoint', () => {
    const saved = installedAutomation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: saved.shelly.deviceId,
      name: saved.shelly.name,
      baseUrl: 'http://192.168.0.99/',
      scriptIdInput: '1'
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number | string;
          method?: string;
        };
        return jsonResponse({ id: body.id ?? 1, result: controlRpcResult(body.method) });
      })
    );

    renderDashboard();

    expect(screen.queryByText('Brak automatyzacji')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dodaj automatykę' })).toBeNull();
  });

  it('uses the same centered empty-state treatment for Thermometers', () => {
    renderDashboard(vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), 'time');

    const thermometerEmptyState = screen
      .getByText('Brak dodanych termometrów.')
      .closest('.dashboard-kind-empty');
    expect(thermometerEmptyState).not.toBeNull();
    expect(thermometerEmptyState).toHaveClass('dashboard-kind-empty');
    expect(
      thermometerEmptyState?.querySelector('.dashboard-kind-empty__icon')
    ).not.toBeNull();
  });

  it('keeps a saved plug fully controllable after automation is removed', async () => {
    const onAddAutomation = vi.fn();
    let relayOn = false;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number | string;
        method?: string;
        params?: { on?: boolean };
      };
      let result: unknown = {};
      switch (body.method) {
        case 'Shelly.GetDeviceInfo':
          result = { id: 'shellyplugsg3-plain', model: 'S3PL-00112EU', gen: 3 };
          break;
        case 'Shelly.GetStatus':
          result = {
            matter: { enabled: false },
            script: { enable: true },
            ble: { enable: true },
            'switch:0': {
              id: 0,
              output: relayOn,
              apower: relayOn ? 28.4 : 0,
              voltage: 243.2,
              current: relayOn ? 0.12 : 0,
              aenergy: { total: 25160 }
            },
            wifi: { rssi: -55 },
            sys: { time: '09:48', unixtime: 1_782_667_904, uptime: 12_345 }
          };
          break;
        case 'Script.List':
          result = { scripts: [] };
          break;
        case 'Switch.Set':
          relayOn = body.params?.on === true;
          result = {};
          break;
      }
      return jsonResponse({ id: body.id ?? 1, result });
    });
    vi.stubGlobal('fetch', fetchMock);

    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.30/',
      name: 'Nawilżacz',
      baseUrl: 'http://192.168.0.30/',
      scriptIdInput: '1'
    });
    const { onOpenPlugSettings } = renderDashboard(onAddAutomation);

    const card = screen.getByText('Nawilżacz').closest('article');
    expect(card).not.toBeNull();
    const plugCard = card as HTMLElement;
    expect(within(plugCard).getByText('Brak automatyzacji')).toBeVisible();
    fireEvent.click(within(plugCard).getByRole('button', { name: 'Nazwa gniazdka' }));
    const nameInput = within(plugCard).getByRole('textbox', { name: 'Nazwa gniazdka' });
    fireEvent.change(nameInput, { target: { value: 'Nawilżacz salon' } });
    fireEvent.blur(nameInput);
    expect(within(plugCard).getByText('Nawilżacz salon')).toBeVisible();
    expect(useHardwareSetupDraftStore.getState().shellyDevices[0]?.name).toBe(
      'Nawilżacz salon'
    );
    expect(await within(plugCard).findByText('0.0 W')).toBeVisible();
    expect(within(plugCard).getByText('243 V')).toBeVisible();
    expect(within(plugCard).getByText('25.16 kWh')).toBeVisible();
    expect(within(plugCard).getByText('09:48')).toBeVisible();

    fireEvent.click(
      within(plugCard).getByRole('button', {
        name: 'Ustawienia gniazdka: Nawilżacz salon'
      })
    );
    expect(onOpenPlugSettings).toHaveBeenCalledWith('http://192.168.0.30/');
    expect(screen.queryByRole('dialog')).toBeNull();

    const onButton = within(plugCard).getByRole('button', { name: 'ON' });
    const offButton = within(plugCard).getByRole('button', { name: 'OFF' });
    expect(offButton).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(onButton);
    await waitFor(() => expect(onButton).toHaveAttribute('aria-pressed', 'true'));
    expect(
      fetchMock.mock.calls.some(([, init]) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          method?: string;
          params?: { on?: boolean };
        };
        return body.method === 'Switch.Set' && body.params?.on === true;
      })
    ).toBe(true);

    fireEvent.click(within(plugCard).getByRole('button', { name: 'Dodaj automatykę' }));
    expect(onAddAutomation).toHaveBeenCalledWith('climate', 'http://192.168.0.30/');
  });

  it('refreshes plain plug power after relay telemetry settles without remounting', async () => {
    let relayOn = false;
    let statusReads = 0;
    const rpcMethods: string[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number | string;
        method?: string;
        params?: { on?: boolean };
      };
      if (body.method) rpcMethods.push(body.method);
      let result: unknown = {};
      switch (body.method) {
        case 'Shelly.GetStatus': {
          statusReads += 1;
          const settledPower = relayOn && statusReads >= 3 ? 28.4 : 0;
          result = {
            matter: { enabled: false },
            script: { enable: true },
            ble: { enable: true },
            'switch:0': {
              id: 0,
              output: relayOn,
              apower: settledPower,
              voltage: 243.2,
              current: settledPower > 0 ? 0.12 : 0,
              aenergy: { total: 25160 }
            },
            wifi: { rssi: -55 },
            sys: { time: '09:48', unixtime: 1_782_667_904, uptime: 12_345 }
          };
          break;
        }
        case 'Switch.Set':
          relayOn = body.params?.on === true;
          result = {};
          break;
      }
      return jsonResponse({ id: body.id ?? 1, result });
    });
    vi.stubGlobal('fetch', fetchMock);

    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.31/',
      name: 'Lampa testowa',
      baseUrl: 'http://192.168.0.31/',
      scriptIdInput: '1'
    });
    renderDashboard();

    const card = screen.getByText('Lampa testowa').closest('article') as HTMLElement;
    expect(await within(card).findByText('0.0 W')).toBeVisible();

    const onButton = within(card).getByRole('button', { name: 'ON' });
    fireEvent.click(onButton);
    await waitFor(() => expect(onButton).toHaveAttribute('aria-pressed', 'true'));
    expect(within(card).getByText('0.0 W')).toBeVisible();

    expect(await within(card).findByText('28.4 W', {}, { timeout: 2500 })).toBeVisible();
    expect(statusReads).toBeGreaterThanOrEqual(3);
    expect(rpcMethods).toContain('Switch.Set');
    expect(rpcMethods).not.toContain('Shelly.GetDeviceInfo');
    expect(rpcMethods).not.toContain('Script.List');
  });

  it('renames a configured Plug inline and keeps draft and installed names synchronized', async () => {
    const saved = installedAutomation();
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: saved.shelly.deviceId,
      name: 'Salon',
      baseUrl: 'http://192.168.0.20/',
      scriptIdInput: '1'
    });
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(diagnosticPayload()))
    );

    renderDashboard();

    const card = screen.getByText('Salon').closest('article') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Nazwa gniazdka' }));
    const input = within(card).getByRole('textbox', { name: 'Nazwa gniazdka' });
    fireEvent.change(input, { target: { value: 'Nawilżacz growbox' } });
    fireEvent.blur(input);

    expect(within(card).getByText('Nawilżacz growbox')).toBeVisible();
    expect(useHardwareSetupDraftStore.getState().shellyDevices[0]?.name).toBe(
      'Nawilżacz growbox'
    );
    expect(useInstalledAutomationStore.getState().installations[0]?.shelly.name).toBe(
      'Nawilżacz growbox'
    );
  });

  it('shows live runtime values from Shelly for a saved installation', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(diagnosticPayload()))
    );

    const { rerenderKind } = renderDashboard();

    expect(await screen.findByText('21.4°C')).toBeVisible();
    expect(screen.getByText('55.2%')).toBeVisible();
    expect(screen.getByText('1.31 kPa')).toBeVisible();
    expect(screen.getByText('42.3 W')).toBeVisible();
    expect(screen.getByText('230 V')).toBeVisible();
    expect(screen.getByText('1.23 kWh')).toBeVisible();
    expect(screen.getByText('09:31')).toBeVisible();
    expect(screen.getByText('Salon')).toBeVisible();
    const climateCard = screen.getByText('Salon').closest('article') as HTMLElement;
    const climateLeadingIcon = climateCard.querySelector(
      '.automation-card__leading-icon'
    );
    expect(climateLeadingIcon?.querySelector('.tabler-icon-plug')).not.toBeNull();
    expect(climateLeadingIcon?.querySelector('.tabler-icon-temperature')).toBeNull();
    expect(climateLeadingIcon).toHaveClass('automation-card__leading-icon--active');
    expect(screen.queryByText('Działa')).toBeNull();
    expect(screen.getAllByText('ON').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ON 19°C · OFF 20°C')).toBeVisible();
    expect(screen.queryByText('Sterowanie temperaturą')).toBeNull();
    rerenderKind('time');
    expect(screen.getByRole('main', { name: 'Termometry' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Termometry' })).toBeNull();
    expect(document.querySelector('.sensor-setup-panel--embedded')).not.toBeNull();
    expect(document.querySelector('.sensor-setup-panel--embedded.demo-panel')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Skanuj termometry BLE telefonem' })
    ).toBeVisible();
    rerenderKind('climate');
    expect(screen.getByRole('button', { name: 'Szczegóły: Salon' })).toBeVisible();
    expect(
      document.querySelector('.automation-card__menu svg.tabler-icon')
    ).not.toBeNull();
    expect(
      document.querySelectorAll('.dashboard-shell svg:not(.tabler-icon)')
    ).toHaveLength(0);
  });

  it('prefers the fresh diagnostic plug relay over a stale control poll for the icon', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof URL ? input.toString() : String(input);
      const target = new URL(url, 'http://localhost').searchParams.get('target');
      if (url.includes('/script/1/diag') || target?.includes('/script/1/diag')) {
        return jsonResponse(diagnosticPayload({ plugRelayOn: true, ruleRelayOn: true }));
      }

      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number | string;
        method?: string;
      };
      return jsonResponse({ id: body.id ?? 1, result: controlRpcResult(body.method) });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDashboard();

    const card = (await screen.findByText('Salon')).closest('article') as HTMLElement;
    const leadingIcon = card.querySelector('.automation-card__leading-icon');
    await waitFor(() =>
      expect(leadingIcon).toHaveClass('automation-card__leading-icon--active')
    );
  });

  it('derives current VPD from runtime temperature and humidity when Shelly omits it', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(diagnosticPayload({ lastVpd: null })))
    );

    renderDashboard();

    expect(await screen.findByText('1.14 kPa')).toBeVisible();
  });

  it('shows the VPD target inline only while VPD assist is enabled', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation(true));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(diagnosticPayload()))
    );

    renderDashboard();

    expect(await screen.findByText('1.31 → 1.20 kPa')).toBeVisible();
    expect(screen.queryByText('1.31 kPa')).toBeNull();
  });

  it('pulses only the plug symbol when a fresh climate measurement arrives', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());
    let lastSeenUptimeMs = 12_300_000;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(diagnosticPayload({ lastSeenUptimeMs })))
    );

    const { queryClient } = renderDashboard();
    expect(await screen.findByText('21.4°C')).toBeVisible();
    const leadingIcon = document.querySelector(
      '.automation-card--climate .automation-card__leading-icon'
    );
    expect(leadingIcon).not.toBeNull();
    expect(leadingIcon?.querySelector('.tabler-icon-plug')).not.toBeNull();
    expect(leadingIcon?.querySelector('.tabler-icon-temperature')).toBeNull();
    expect(leadingIcon).not.toHaveClass('automation-card__leading-icon--fresh');

    lastSeenUptimeMs = 12_330_000;
    await act(async () => {
      await queryClient.refetchQueries({
        predicate: (query) => query.queryKey[0] === 'installed-automation-diagnostics'
      });
    });
    await waitFor(() =>
      expect(leadingIcon).toHaveClass('automation-card__leading-icon--fresh')
    );
    expect(leadingIcon?.querySelector('.automation-card__icon')).not.toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, CLIMATE_PULSE_TEST_WAIT_MS));
    });
    expect(leadingIcon).not.toHaveClass('automation-card__leading-icon--fresh');
  });

  it('keeps the fresh-reading pulse working while the automation is in MANUAL mode', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());
    let lastSeenUptimeMs = 12_300_000;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof URL ? input.toString() : String(input);
      const target = new URL(url, 'http://localhost').searchParams.get('target');
      if (url.includes('/script/1/diag') || target?.includes('/script/1/diag')) {
        return jsonResponse(
          diagnosticPayload({
            lastSeenUptimeMs,
            plugRelayOn: false,
            ruleRelayOn: false
          })
        );
      }

      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number | string;
        method?: string;
      };
      const result =
        body.method === 'Script.Eval' ? { result: '1' } : controlRpcResult(body.method);
      return jsonResponse({ id: body.id ?? 1, result });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { queryClient } = renderDashboard();
    expect(await screen.findByText('21.4°C')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'MANUAL' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );

    const leadingIcon = document.querySelector(
      '.automation-card--climate .automation-card__leading-icon'
    );
    expect(leadingIcon).not.toBeNull();
    expect(leadingIcon).not.toHaveClass('automation-card__leading-icon--active');
    expect(leadingIcon).not.toHaveClass('automation-card__leading-icon--fresh');

    lastSeenUptimeMs = 12_330_000;
    await act(async () => {
      await queryClient.refetchQueries({
        predicate: (query) => query.queryKey[0] === 'installed-automation-diagnostics'
      });
    });
    await waitFor(() =>
      expect(leadingIcon).toHaveClass('automation-card__leading-icon--fresh')
    );
  });

  it('shows a native time schedule and opens it by stable installation id', async () => {
    const installation = timeInstalledAutomation();
    useInstalledAutomationStore.getState().upsertInstallation(installation);
    installTimeShellyFetchMock();
    const onOpenInstallation = vi.fn();

    const { rerenderKind } = renderDashboard(vi.fn(), onOpenInstallation);

    expect(await screen.findByText('Harmonogram dzienny')).toBeVisible();
    expect(screen.getByText('Lampa')).toBeVisible();
    expect(screen.getByText('08:00')).toBeVisible();
    expect(screen.getByText('20:00')).toBeVisible();
    expect(screen.getByText('Natywny Shelly Schedule')).toBeVisible();
    expect(await screen.findByText('Działa')).toBeVisible();
    expect(screen.getByText('ON')).toBeVisible();
    const timeCard = screen.getByText('Lampa').closest('article') as HTMLElement;
    const timeLeadingIcon = timeCard.querySelector('.automation-card__leading-icon');
    expect(timeLeadingIcon?.querySelector('.tabler-icon-plug')).not.toBeNull();
    expect(timeLeadingIcon).toHaveClass('automation-card__leading-icon--active');
    rerenderKind('time');
    expect(screen.getByRole('main', { name: 'Termometry' })).toBeVisible();
    rerenderKind('climate');
    expect(screen.getByText('Harmonogram dzienny')).toBeVisible();

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
    expect(screen.getByText('ON 19.25°C · OFF 19.75°C')).toBeVisible();
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

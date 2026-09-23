import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import type { NormalizedBleAdvertisement } from '@lcl/ble-core';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript
} from '@lcl/script-generator';
import { hashScriptCode, LOCAL_CLIMATE_LINK_SCRIPT_NAME } from '@lcl/shelly-client';

const phoneBleScannerMock = vi.hoisted(() => ({
  failureMessage: null as string | null,
  startCount: 0,
  stopCount: 0,
  endContinuousScanCount: 0,
  advertisementDelayMs: 0
}));

const pvvxGattMock = vi.hoisted(() => ({
  timeCalls: 0,
  stopCountAtTimeStart: 0
}));

const createStoredThermostatScript = (): string => {
  const config = createDefaultShellyThermostatConfig(
    'xiaomi_lywsd03mmc_bthome_v2',
    'heating'
  );

  return generateShellyThermostatScript({
    ...config,
    sensor: {
      ...config.sensor,
      sensorId: 'sensor-a4c1384f24cd',
      runtimeAddress: 'A4:C1:38:4F:24:CD',
      displayName: 'Xiaomi salon'
    },
    rule: config.rule
  });
};

vi.mock('@lcl/ble-core', async () => {
  const actual = await vi.importActual('@lcl/ble-core');

  class TestCapacitorBleScanner {
    private stopped = false;

    async *startScan(options?: {
      timeoutMs?: number;
    }): AsyncIterable<NormalizedBleAdvertisement> {
      this.stopped = false;
      phoneBleScannerMock.startCount += 1;
      if (phoneBleScannerMock.failureMessage) {
        throw new Error(phoneBleScannerMock.failureMessage);
      }

      const seenAtMs = Date.now();
      const advertisements: NormalizedBleAdvertisement[] = [
        {
          id: 'A4:C1:38:4F:24:CD',
          name: 'LYWSD03MMC BTHome',
          rssi: -58,
          serviceUuids: ['fcd2'],
          serviceData: {
            fcd2: new Uint8Array([0x40, 0x02, 0x56, 0x08, 0x03, 0xd7, 0x11])
          },
          manufacturerData: {},
          seenAtMs,
          platform: 'android'
        },
        {
          id: 'F7:5F:8D:0F:76:20',
          name: 'TP357',
          rssi: -74,
          serviceUuids: [],
          serviceData: {},
          manufacturerData: {
            c0c2: new Uint8Array([0x00, 0x38, 0x64, 0x01])
          },
          seenAtMs,
          platform: 'android'
        },
        {
          id: 'A4:C1:38:4F:24:CD',
          name: 'LYWSD03MMC BTHome',
          rssi: -72,
          serviceUuids: ['fcd2'],
          serviceData: {
            fcd2: new Uint8Array([0x40, 0x01, 0x64])
          },
          manufacturerData: {},
          seenAtMs: seenAtMs + 1000,
          platform: 'android'
        },
        {
          id: 'F7:5F:8D:0F:76:20',
          name: 'TP357',
          rssi: -70,
          serviceUuids: [],
          serviceData: {},
          manufacturerData: {
            c0c2: new Uint8Array([0x00, 0x38, 0x64, 0x01])
          },
          seenAtMs: seenAtMs + 2000,
          platform: 'android'
        }
      ];

      for (const advertisement of advertisements) {
        if (this.stopped) {
          return;
        }
        yield advertisement;
        if (phoneBleScannerMock.advertisementDelayMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, phoneBleScannerMock.advertisementDelayMs)
          );
        }
      }

      if (options?.timeoutMs === 0 && phoneBleScannerMock.endContinuousScanCount > 0) {
        phoneBleScannerMock.endContinuousScanCount -= 1;
        return;
      }

      while (options?.timeoutMs === 0 && !this.stopped) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    async stopScan(): Promise<void> {
      phoneBleScannerMock.stopCount += 1;
      this.stopped = true;
    }
  }

  return {
    ...(actual as object),
    CapacitorBleScanner: TestCapacitorBleScanner,
    CapacitorBleGattClient: class TestCapacitorBleGattClient {},
    setPvvxDeviceTime: vi.fn(async () => {
      pvvxGattMock.timeCalls += 1;
      pvvxGattMock.stopCountAtTimeStart = phoneBleScannerMock.stopCount;
      return { currentTimeSec: 1_700_000_000 };
    })
  };
});

import {
  DEFAULT_HARDWARE_SETUP_DRAFT,
  HARDWARE_SETUP_DRAFT_STORAGE_KEY,
  resetHardwareSetupDraftStore,
  useHardwareSetupDraftStore
} from '../flows/hardware-setup/setupDraftStore.js';
import { I18nProvider, setLocalePreference, t } from '../app/i18n.js';
import { setThemeMode } from '../app/themeMode.js';
import { resetHardwareSetupReadingsStore } from '../flows/hardware-setup/sensorReadingsStore.js';
import { createInstalledAutomation } from '../features/automations/index.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';
import {
  cleanupStaleShellyBleDiscoveryScripts,
  fetchShellyJson
} from '../flows/hardware-setup/shellyRequests.js';
import { formatSensorId } from '../flows/hardware-setup/validation.js';
import { HardwareSetupScreen } from '../screens/hardware-setup/HardwareSetupScreen.js';
import { renderWithAppToastHost } from '../test/renderWithAppToastHost.js';

const renderHardwareSetup = (props: Parameters<typeof HardwareSetupScreen>[0] = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return renderWithAppToastHost(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <HardwareSetupScreen {...props} />
      </I18nProvider>
    </QueryClientProvider>
  );
};

const chooseSelectField = (
  label: string,
  optionLabel: string,
  container: HTMLElement = document.body
) => {
  const scope = within(container);
  fireEvent.click(scope.getByRole('button', { name: label }));
  const listbox = scope.getByRole('listbox', { name: label });
  fireEvent.click(within(listbox).getByRole('option', { name: optionLabel }));
};

const rpcResult = (result: unknown) =>
  new Response(JSON.stringify({ id: 1, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const jsonResponse = (result: unknown, status = 200) =>
  new Response(JSON.stringify(result), {
    status,
    headers: { 'content-type': 'application/json' }
  });

const requestUrl = (input: RequestInfo | URL): URL => {
  const url = rawRequestUrl(input);
  if (url.pathname === '/__lcl_shelly_proxy') {
    const target = url.searchParams.get('target');
    return target ? new URL(target) : url;
  }
  return url;
};

const rawRequestUrl = (input: RequestInfo | URL): URL => {
  if (input instanceof URL) {
    return input;
  }
  if (typeof input === 'string') {
    return new URL(input);
  }
  return new URL(input.url);
};

const requestBody = (init?: RequestInit): { method?: string; params?: unknown } => {
  const body = init?.body;
  return typeof body === 'string'
    ? (JSON.parse(body) as { method?: string; params?: unknown })
    : {};
};

const findBleScanCandidate = async (dialog: HTMLElement, mac = 'A4:C1:38:4F:24:CD') =>
  within(dialog).findByText(mac, undefined, { timeout: 3000 });

const findShellySettingsPage = async (name: string) => {
  const heading = await screen.findByRole('heading', { name });
  const page = heading.closest('.plug-settings-page');
  expect(page).not.toBeNull();
  expect(screen.queryByRole('dialog', { name })).toBeNull();
  return page as HTMLElement;
};

const findShellyBleScanPage = async () => {
  const heading = await screen.findByRole('heading', { name: 'Skanuj termometry BLE' });
  const page = heading.closest('.plug-ble-discovery-page');
  expect(page).not.toBeNull();
  expect(screen.queryByRole('dialog', { name: 'Skanuj termometry BLE' })).toBeNull();
  return page as HTMLElement;
};

const createAbortableFetchMock = () => {
  let abortCount = 0;
  const fetchImpl = vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        const abortRequest = () => {
          abortCount += 1;
          reject(new DOMException('Aborted', 'AbortError'));
        };

        if (signal?.aborted) {
          abortRequest();
          return;
        }

        signal?.addEventListener('abort', abortRequest, { once: true });
      })
  );

  return {
    fetchImpl,
    getAbortCount: () => abortCount
  };
};

const openShellyAddDialog = async (section: 'manual' | 'scan' = 'manual') => {
  fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));
  const page = await screen.findByRole('region', { name: 'Dodaj gniazdko' });
  expect(page).toHaveClass('device-add-page');
  expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();
  if (section === 'manual') {
    fireEvent.click(within(page).getByRole('tab', { name: 'Dodaj ręcznie' }));
  }
  return page;
};

const openSensorAddDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Dodaj termometr' }));
  const page = await screen.findByRole('region', { name: 'Dodaj termometr' });
  expect(page).toHaveClass('device-add-page');
  expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();
  fireEvent.click(within(page).getByRole('tab', { name: 'Dodaj ręcznie' }));
  return page;
};

const openRuleScriptDialog = async () => {
  openRuleDeveloperTools();
  fireEvent.click(screen.getByRole('button', { name: 'Shelly Script' }));
  return screen.findByRole('dialog', { name: 'Shelly Script' });
};

const closeCurrentAddPage = () => {
  const back = document.querySelector<HTMLButtonElement>(
    '.app-page-back-row .setup-context__back'
  );
  expect(back).not.toBeNull();
  fireEvent.click(back!);
};

const openRuleDisclosure = (label: string): HTMLDetailsElement => {
  const summary = screen.getByText(label, { selector: 'summary' });
  const details = summary.closest('details') as HTMLDetailsElement | null;
  expect(details).not.toBeNull();
  if (!details!.open) {
    fireEvent.click(summary);
  }
  return details!;
};

const openRuleDeveloperTools = () => {
  const details = openRuleDisclosure('Zaawansowane');
  const actions = details.querySelector('.rule-developer-actions--compact');
  expect(actions).not.toBeNull();
  expect(actions!.querySelectorAll('button')).toHaveLength(2);
};

const getRuleSummary = () => {
  const trigger = screen.getByRole('button', { name: 'Podsumowanie reguły' });
  fireEvent.click(trigger);
  const popover = screen.getByRole('tooltip', { name: 'Podsumowanie reguły' });
  const snapshot = document.createElement('article');
  snapshot.textContent = popover.textContent;
  fireEvent.click(trigger);
  return snapshot;
};

const addShellyThroughUi = async (name = 'Przedpokój') => {
  fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));
  const addDialog = await openShellyAddDialog();
  fireEvent.change(within(addDialog).getByLabelText('Nazwa gniazdka'), {
    target: { value: name }
  });
  fireEvent.change(within(addDialog).getByLabelText('Adres IP Shelly'), {
    target: { value: '192.168.0.20' }
  });
  fireEvent.click(within(addDialog).getByRole('button', { name: 'Dodaj' }));
  expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Dodaj gniazdko' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();
  closeCurrentAddPage();
  expect(
    await screen.findByRole('button', { name: 'Ustawienia gniazdka' })
  ).toBeInTheDocument();
};

const openShellyBleScanFromSettings = async () => {
  fireEvent.click(
    screen.getByRole('button', { name: 'Skanuj termometry BLE przez to gniazdko' })
  );
};

const addSensorThroughUi = async ({
  mac = 'A4:C1:38:4F:24:CD',
  name = 'Xiaomi salon',
  profile = 'xiaomi_lywsd03mmc_bthome_v2'
}: {
  mac?: string;
  name?: string;
  profile?: 'xiaomi_lywsd03mmc_bthome_v2' | 'tp357_custom_v1';
} = {}) => {
  fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
  const addDialog = await openSensorAddDialog();
  chooseSelectField(
    'Typ termometru',
    profile === 'tp357_custom_v1' ? 'TP357' : 'Xiaomi/PVVX BTHome v2',
    addDialog
  );
  fireEvent.change(within(addDialog).getByLabelText('Nazwa termometru'), {
    target: { value: name }
  });
  fireEvent.change(within(addDialog).getByLabelText('MAC termometru'), {
    target: { value: mac }
  });
  fireEvent.click(within(addDialog).getByRole('button', { name: 'Dodaj' }));
  expect(await screen.findByText('Zapisano termometr.')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Dodaj termometr' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Dodaj termometr' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();
  closeCurrentAddPage();
  expect(await screen.findByText(name)).toBeInTheDocument();
};

const getSavedSensorCard = (name: string) => {
  const card = screen.getByText(name).closest('article');
  expect(card).not.toBeNull();
  return card!;
};

describe('HardwareSetupScreen', () => {
  beforeEach(() => {
    resetHardwareSetupDraftStore();
    resetHardwareSetupReadingsStore();
    resetInstalledAutomationStore();
    phoneBleScannerMock.failureMessage = null;
    phoneBleScannerMock.startCount = 0;
    phoneBleScannerMock.stopCount = 0;
    phoneBleScannerMock.endContinuousScanCount = 0;
    pvvxGattMock.timeCalls = 0;
    pvvxGattMock.stopCountAtTimeStart = 0;
    setLocalePreference('system');
    setThemeMode('system');
    document.documentElement.removeAttribute('data-lcl-theme');
    window.history.replaceState(null, '', '/');
    let relayOn = false;
    let thermostatRunning = true;
    let thermostatDeleted = false;
    let thermostatCode = createStoredThermostatScript();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        if (url.pathname === '/script/4/ble-scan') {
          return jsonResponse({
            v: 1,
            r: true,
            sa: 1782667904992,
            so: null,
            lr: 'candidate-updated',
            c: [
              {
                a: 'A4:C1:38:4F:24:CD',
                p: 'x',
                t: 31.18,
                h: 44.06,
                r: -37,
                s: 1782667904992
              }
            ]
          });
        }
        if (url.pathname === '/script/1/diag') {
          return jsonResponse({
            v: 1,
            z: 'lcl-12345678',
            s: ['A4:C1:38:4F:24:CD', 'Xiaomi/PVVX BTHome'],
            q: [0, 0, 19, 20, 120, -85],
            y: ['09:31', 1782667904, 12345],
            p: [false, 0, 230.1, 0, 1234, 31.2],
            g: [
              12300000,
              31.18,
              44.06,
              100,
              -37,
              false,
              'ab',
              12250000,
              null,
              0,
              13,
              31.18,
              1.45,
              22.2,
              22.6,
              12320000,
              'ok'
            ]
          });
        }

        const body = requestBody(init);
        if (url.pathname === '/rpc' && url.hostname !== '192.168.0.20') {
          return new Response('<!doctype html><html></html>', {
            status: 200,
            headers: { 'content-type': 'text/html' }
          });
        }

        switch (body.method) {
          case 'Shelly.GetDeviceInfo':
            return rpcResult({
              id: 'shellyplugsg3-test',
              model: 'S3PL-00112EU',
              gen: 3,
              fw_id: '20260311-095902/1.7.5-g9979d16'
            });
          case 'Shelly.GetStatus':
            return rpcResult({
              ble: {},
              script: {},
              wifi: { rssi: -54 },
              sys: {
                time: '09:31',
                unixtime: 1782667904,
                uptime: 12345,
                last_sync_ts: 1782667800
              },
              'switch:0': {
                id: 0,
                output: relayOn,
                apower: relayOn ? 28.4 : 0,
                voltage: 230.1,
                current: relayOn ? 0.12 : 0,
                aenergy: { total: 1234 }
              }
            });
          case 'Schedule.List':
            return rpcResult({ jobs: [], rev: 0 });
          case 'Script.List':
            return rpcResult({
              scripts: thermostatDeleted
                ? []
                : [
                    {
                      id: 1,
                      name: 'Local Climate Link Thermostat',
                      enable: true,
                      running: thermostatRunning
                    }
                  ]
            });
          case 'Script.GetCode':
            return rpcResult({ data: thermostatCode, left: 0 });
          case 'Script.Eval': {
            const params = body.params as { code?: string } | undefined;
            if (params?.code?.includes('Script.storage')) {
              return rpcResult({ result: JSON.stringify({ s: 1, v: null }) });
            }
            return rpcResult({});
          }
          case 'Script.Create':
            return rpcResult({ id: 4 });
          case 'Script.PutCode': {
            const params = body.params as { append?: boolean; code?: string } | undefined;
            thermostatDeleted = false;
            if (params?.code !== undefined) {
              thermostatCode =
                params.append === true ? `${thermostatCode}${params.code}` : params.code;
            }
            return rpcResult({});
          }
          case 'Script.SetConfig':
            return rpcResult({});
          case 'Script.Start': {
            const params = body.params as { id?: number } | undefined;
            if (params?.id === 1) {
              thermostatRunning = true;
            }
            return rpcResult({});
          }
          case 'Script.Stop': {
            const params = body.params as { id?: number } | undefined;
            if (params?.id === 1) {
              thermostatRunning = false;
            }
            return rpcResult({});
          }
          case 'Script.Delete': {
            const params = body.params as { id?: number } | undefined;
            if (params?.id === 1) {
              thermostatDeleted = true;
              thermostatRunning = false;
            }
            return rpcResult({});
          }
          case 'Switch.Set': {
            const params = body.params as { on?: boolean } | undefined;
            relayOn = params?.on === true;
            return rpcResult({});
          }
          case 'Switch.GetStatus':
            return rpcResult({ id: 0, output: relayOn });
          case 'Script.GetStatus':
            return rpcResult({
              id: 4,
              running: true,
              mem_used: 12_288,
              mem_peak: 16_384,
              mem_free: 25_116,
              cpu: 0.3
            });
          case 'Sys.GetStatus':
            return rpcResult({ ram_size: 259_128, ram_free: 96_180 });
          default:
            return rpcResult({});
        }
      })
    );
  });

  afterEach(() => {
    cleanup();
    setLocalePreference('system');
    setThemeMode('system');
    document.documentElement.removeAttribute('data-lcl-theme');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders hardware setup as logical pages with a top menu', async () => {
    renderHardwareSetup();

    expect(screen.queryByText('MVP manual')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zestaw' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shelly' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Termometry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reguła' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Diag' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skrypt' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shelly' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('region', { name: 'Gniazdka Shelly' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Gniazdka Shelly' })
    ).not.toBeInTheDocument();
    const addShellyButton = screen.getByRole('button', { name: 'Dodaj gniazdko' });
    expect(addShellyButton).toHaveClass('setup-add-fab');
    expect(addShellyButton.querySelector('.setup-add-fab__icon')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Dodaj gniazdko' })).toHaveAttribute(
      'title',
      'Dodaj nowe gniazdko Shelly'
    );
    expect(screen.queryByPlaceholderText('http://192.168.x.x')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Lista gniazdek sterujących lokalną automatyzacją.')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Dodane gniazdka')).not.toBeInTheDocument();
    const shellyAddDialog = await openShellyAddDialog();
    expect(
      within(shellyAddDialog).getByPlaceholderText('http://192.168.x.x')
    ).toBeInTheDocument();
    const shellyScanTab = within(shellyAddDialog).getByRole('tab', {
      name: 'Skanuj sieć'
    });
    const shellyManualTab = within(shellyAddDialog).getByRole('tab', {
      name: 'Dodaj ręcznie'
    });
    expect(shellyScanTab).toBeVisible();
    expect(shellyScanTab).toHaveAttribute('aria-selected', 'false');
    expect(shellyManualTab).toHaveAttribute('aria-selected', 'true');
    expect(
      within(shellyAddDialog).getByRole('tabpanel', { name: 'Dodaj ręcznie' })
    ).toBeInTheDocument();
    expect(
      within(shellyAddDialog).queryByRole('tabpanel', { name: 'Skanuj sieć' })
    ).not.toBeInTheDocument();
    expect(
      within(shellyAddDialog).getByRole('button', { name: 'Dodaj' })
    ).toHaveAttribute('title', 'Dodaj to sprawdzone gniazdko do aplikacji');
    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();
    closeCurrentAddPage();
    expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    expect(
      screen.queryByText('Wpisz nazwę i MAC termometru, którego ma używać Shelly.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Termometry' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('region', { name: 'Termometry BLE' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Termometry' })).not.toBeInTheDocument();
    const addSensorFabButton = screen.getByRole('button', { name: 'Dodaj termometr' });
    expect(addSensorFabButton).toHaveClass('setup-add-fab');
    expect(addSensorFabButton.querySelector('.setup-add-fab__icon')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Dodaj termometr' })).toHaveAttribute(
      'title',
      'Dodaj termometr BLE'
    );
    expect(screen.queryByLabelText('Typ termometru')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Xiaomi/PVVX BTHome v2 jest pierwszym realnie wspieranym profilem.'
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Xiaomi/PVVX')).not.toBeInTheDocument();

    const sensorAddDialog = await openSensorAddDialog();
    expect(within(sensorAddDialog).getByLabelText('Typ termometru')).toHaveAttribute(
      'value',
      'xiaomi_lywsd03mmc_bthome_v2'
    );
    fireEvent.click(
      within(sensorAddDialog).getByRole('button', { name: 'Typ termometru' })
    );
    const profileListbox = within(sensorAddDialog).getByRole('listbox', {
      name: 'Typ termometru'
    });
    expect(
      within(profileListbox).getByRole('option', {
        name: 'Xiaomi/PVVX BTHome v2'
      })
    ).toBeInTheDocument();
    expect(within(profileListbox).getByRole('option', { name: 'TP357' })).toBeEnabled();
    fireEvent.click(within(profileListbox).getByRole('option', { name: 'TP357' }));
    expect(within(sensorAddDialog).getByLabelText('Typ termometru')).toHaveAttribute(
      'value',
      'tp357_custom_v1'
    );
    expect(screen.queryByText(/wspierane/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
    expect(
      within(sensorAddDialog).getByPlaceholderText('Salon / Kuchnia / Przedpokój')
    ).toBeInTheDocument();
    const addSensorButton = within(sensorAddDialog).getByRole('button', {
      name: 'Dodaj'
    });
    expect(addSensorButton).toBeEnabled();
    fireEvent.click(addSensorButton);
    expect(
      within(sensorAddDialog).getByText('Wpisz nazwę termometru.')
    ).toBeInTheDocument();
    expect(within(sensorAddDialog).getByLabelText('Nazwa termometru')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(
      within(sensorAddDialog).getByText('Wpisz MAC termometru.')
    ).toBeInTheDocument();
    expect(within(sensorAddDialog).getByLabelText('MAC termometru')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.queryByText('Temperatura')).not.toBeInTheDocument();
    expect(screen.queryByText('Wilgotność')).not.toBeInTheDocument();
    expect(screen.queryByText('Bateria')).not.toBeInTheDocument();
    expect(screen.queryByText('RSSI')).not.toBeInTheDocument();
    closeCurrentAddPage();

    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    expect(screen.getByLabelText('Gniazdko Shelly')).toBeInTheDocument();
    expect(screen.getByLabelText('Termometr')).toBeInTheDocument();
    expect(screen.getByText('Zaawansowane', { selector: 'summary' })).toBeVisible();
    openRuleDeveloperTools();
    expect(
      screen.queryByText('Narzędzia deweloperskie', { selector: 'summary' })
    ).not.toBeInTheDocument();
    expect(getRuleSummary()).toHaveTextContent(
      'Gdy termometr zniknie na 2 min albo Shelly uruchomi się ponownie'
    );
    expect(getRuleSummary()).toHaveTextContent(
      'Po świeżym odczycie automatyka znów zastosuje tę regułę'
    );
    expect(getRuleSummary()).not.toHaveTextContent('gniazdko przejdzie w OFF');
    expect(getRuleSummary()).not.toHaveTextContent('Termometr:');
  });

  it('opens fixed climate setup directly on the rule editor', () => {
    const shellyId = 'http://192.168.0.30/';
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: shellyId,
      name: 'Grzejnik',
      baseUrl: shellyId,
      scriptIdInput: '1'
    });

    renderHardwareSetup({ setupIntent: 'temperature', fixedShellyId: shellyId });

    expect(screen.queryByRole('button', { name: 'Termometry' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reguła' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Termometr' })).toHaveAttribute(
      'aria-haspopup',
      'listbox'
    );
    expect(screen.getByRole('button', { name: 'Tryb reguły' })).toHaveAttribute(
      'aria-haspopup',
      'listbox'
    );
  });

  it('uses the shared child-page back chrome for the setup flow', () => {
    const onBackToIntent = vi.fn();
    renderHardwareSetup({ setupIntent: 'temperature', onBackToIntent });

    const back = screen.getByRole('button', { name: '‹ Zmień cel' });
    expect(back.closest('.app-page-back-row')).not.toBeNull();
    fireEvent.click(back);
    expect(onBackToIntent).toHaveBeenCalledTimes(1);
  });

  it('opens saved Shelly settings and BLE discovery as nested child pages', async () => {
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.20/',
      name: 'Salon',
      baseUrl: 'http://192.168.0.20/',
      scriptIdInput: '1'
    });
    renderHardwareSetup({ setupIntent: 'temperature', onBackToIntent: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia gniazdka' }));

    expect(screen.queryByRole('dialog', { name: 'Salon' })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Salon' })).toBeVisible();
    expect(screen.getByRole('button', { name: '‹ Shelly' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Menu konfiguracji' })).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Skanuj termometry BLE przez to gniazdko' })
    );
    expect(screen.queryByRole('dialog', { name: 'Skanuj termometry BLE' })).toBeNull();
    expect(
      await screen.findByRole('heading', { name: 'Skanuj termometry BLE' })
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '‹ Salon' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Menu konfiguracji' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '‹ Salon' }));
    await waitFor(
      () => {
        const rpcBodies = vi
          .mocked(fetch)
          .mock.calls.map((call) => requestBody(call[1]))
          .filter((body) => body.method);
        expect(
          rpcBodies.some(
            (body) =>
              body.method === 'Script.Delete' &&
              (body.params as { id?: number } | undefined)?.id === 4
          )
        ).toBe(true);
        expect(
          rpcBodies.some(
            (body) =>
              body.method === 'Script.Start' &&
              (body.params as { id?: number } | undefined)?.id === 1
          )
        ).toBe(true);
      },
      { timeout: 5000 }
    );
    expect(await screen.findByRole('heading', { name: 'Salon' })).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '‹ Shelly' }));
    expect(screen.getByRole('navigation', { name: 'Menu konfiguracji' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ustawienia gniazdka' })).toBeVisible();
  });

  it('never renders page-local Back on standalone Plug or Thermometer add pages', async () => {
    const plugView = renderHardwareSetup({ plugAddOnly: true });

    expect(await screen.findByRole('region', { name: 'Dodaj gniazdko' })).toHaveClass(
      'device-add-page'
    );
    expect(document.querySelector('.setup-context__back')).toBeNull();

    plugView.unmount();
    renderHardwareSetup({
      sensorAddOnly: true,
      sensorAddMode: 'phone-scan'
    });

    expect(await screen.findByRole('region', { name: 'Dodaj termometr' })).toHaveClass(
      'device-add-page'
    );
    expect(document.querySelector('.setup-context__back')).toBeNull();
  });

  it('opens device add flows as full child pages instead of modals', async () => {
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));
    const plugPage = await openShellyAddDialog('scan');
    expect(within(plugPage).getByRole('tab', { name: 'Skanuj sieć' })).toBeVisible();
    expect(plugPage).not.toHaveClass('automation-card');
    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();
    closeCurrentAddPage();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const sensorPage = await openSensorAddDialog();
    expect(within(sensorPage).getByLabelText('MAC termometru')).toBeVisible();
    expect(sensorPage).not.toHaveClass('automation-card');
    expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();
  });

  it('shows a friendly message when Shelly reports script memory exhaustion', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('out_of_memory', {
        status: 200,
        headers: { 'content-type': 'text/plain' }
      })
    );

    await expect(
      fetchShellyJson(new URL('http://192.168.0.20/script/2/ble-scan'), 5000)
    ).rejects.toThrow(t('hardware.shelly.outOfMemory'));
  });

  it('attempts every stale BLE discovery cleanup before reporting partial failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = requestBody(init);
        if (body.method === 'Script.List') {
          return rpcResult({
            scripts: [
              {
                id: 8,
                name: 'Local Climate Link BLE Discovery',
                enable: false,
                running: true
              },
              {
                id: 9,
                name: 'Local Climate Link BLE Discovery',
                enable: false,
                running: false
              },
              {
                id: 1,
                name: 'Local Climate Link Thermostat',
                enable: true,
                running: true
              }
            ]
          });
        }
        if (body.method === 'Script.Stop') {
          return rpcResult({});
        }
        if (
          body.method === 'Script.Delete' &&
          (body.params as { id?: number } | undefined)?.id === 8
        ) {
          return jsonResponse({
            id: 1,
            error: { code: -1, message: 'script busy' }
          });
        }
        if (body.method === 'Script.Delete') {
          return rpcResult({});
        }
        return rpcResult({});
      })
    );

    await expect(
      cleanupStaleShellyBleDiscoveryScripts('http://192.168.0.20/')
    ).rejects.toThrow('Nie udało się posprzątać skanerów BLE.');

    const deleteIds = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]))
      .filter((body) => body.method === 'Script.Delete')
      .map((body) => (body.params as { id?: number } | undefined)?.id);
    expect(deleteIds).toEqual([8, 9]);
  });

  it('checks Shelly through the RPC client and shows compatibility state', async () => {
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));
    const addDialog = await openShellyAddDialog();
    fireEvent.change(within(addDialog).getByLabelText('Nazwa gniazdka'), {
      target: { value: 'Salon' }
    });
    fireEvent.change(within(addDialog).getByLabelText('Adres IP Shelly'), {
      target: { value: '192.168.0.20' }
    });
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Dodaj' }));

    expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dodaj gniazdko' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();
    expect(
      screen.queryByRole('dialog', { name: 'Shelly sprawdzone' })
    ).not.toBeInTheDocument();
    closeCurrentAddPage();
    expect(screen.queryByText('http://192.168.0.20/')).not.toBeInTheDocument();
    expect(screen.getByText('Salon')).toBeInTheDocument();
    expect(screen.queryByText('Adres')).not.toBeInTheDocument();
    expect(screen.queryByText('Script ID')).not.toBeInTheDocument();
    expect(screen.queryByText('wybrane')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wybierz' })).not.toBeInTheDocument();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    fireEvent.click(
      within(savedPlugList).getByRole('button', { name: 'Nazwa gniazdka' })
    );
    const nameInput = within(savedPlugList).getByLabelText('Nazwa gniazdka');
    fireEvent.change(nameInput, { target: { value: 'Salon testowy' } });
    expect(nameInput).toHaveValue('Salon testowy');
    fireEvent.blur(nameInput);
    expect(within(savedPlugList).getByText('Salon testowy')).toBeInTheDocument();

    fireEvent.click(
      within(savedPlugList).getByRole('button', { name: 'Ustawienia gniazdka' })
    );
    const infoDialog = await findShellySettingsPage('Salon testowy');
    expect(within(infoDialog).getByText('Adres IP')).toBeInTheDocument();
    const shellyPanelLink = within(infoDialog).getByRole('link', {
      name: 'Otwórz panel Shelly: http://192.168.0.20/'
    });
    expect(shellyPanelLink).toHaveAttribute('href', 'http://192.168.0.20/');
    expect(shellyPanelLink).toHaveAttribute('target', '_blank');
    expect(shellyPanelLink).toHaveAttribute('rel', 'noreferrer noopener');
    expect(
      await within(infoDialog).findByText('S3PL-00112EU, gen 3')
    ).toBeInTheDocument();
    expect(within(infoDialog).getByText('Scripts')).toBeInTheDocument();
    expect(within(infoDialog).getByText('Bluetooth')).toBeInTheDocument();
    const detailRows = infoDialog.querySelector('.status-stack');
    expect(detailRows).not.toBeNull();
    expect(
      within(detailRows as HTMLElement).queryByText('Przekaźnik')
    ).not.toBeInTheDocument();
    expect(within(detailRows as HTMLElement).queryByText('Tryb')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '‹ Shelly' }));
    expect(document.querySelector('.plug-settings-page')).toBeNull();

    const firstCallUrl = rawRequestUrl(vi.mocked(fetch).mock.calls[0]?.[0] as URL);
    expect(firstCallUrl.pathname).toBe('/__lcl_shelly_proxy');
    expect(firstCallUrl.searchParams.get('target')).toBe('http://192.168.0.20/rpc');
  });

  it('allows rule install when Shelly.GetStatus omits Scripts but Script.List works', async () => {
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = requestBody(init);
        if (body.method === 'Shelly.GetStatus') {
          return rpcResult({
            ble: {},
            matter: false,
            'switch:0': { id: 0, output: false }
          });
        }
        return defaultFetch(input, init);
      })
    );

    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    await addSensorThroughUi({ name: 'Xiaomi salon' });
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }));

    const relayDialog = await screen.findByRole(
      'dialog',
      {
        name: 'Przetestuj przekaźnik przed użyciem'
      },
      { timeout: 3000 }
    );
    expect(
      within(relayDialog).getByText('Dla grzania domyślny tryb bezpieczeństwa to OFF.')
    ).toBeInTheDocument();
    expect(within(relayDialog).getByRole('button', { name: 'Przetestuj' })).toBeEnabled();
    expect(
      screen.queryByText(
        'Nie widzę Shelly Scripts w statusie gniazdka. Sprawdź firmware albo wyłącz Matter.'
      )
    ).not.toBeInTheDocument();

    const installations = useInstalledAutomationStore.getState().installations;
    expect(installations).toHaveLength(1);
    expect(installations[0]).toMatchObject({
      shelly: {
        deviceId: 'shellyplugsg3-test',
        name: 'Salon',
        baseUrl: 'http://192.168.0.20/'
      },
      config: {
        sensor: {
          runtimeAddress: 'A4:C1:38:4F:24:CD'
        },
        rule: {
          mode: 'heating'
        }
      }
    });
  });

  it('blocks rule install when Shelly status does not expose BLE', async () => {
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = requestBody(init);
        if (body.method === 'Shelly.GetStatus') {
          return rpcResult({
            matter: false,
            script: {},
            'switch:0': { id: 0, output: false }
          });
        }
        return defaultFetch(input, init);
      })
    );

    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    await addSensorThroughUi({ name: 'Xiaomi salon' });
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }));

    const blockDialog = await screen.findByRole('dialog', {
      name: 'Nie mogę wysłać reguły'
    });
    expect(
      within(blockDialog).getByText(
        'Nie widzę Bluetooth/BLE w statusie Shelly. Sprawdź, czy gniazdko obsługuje BLE.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Przetestuj' })).not.toBeInTheDocument();
  });

  it('validates Shelly form values before starting a network check', async () => {
    renderHardwareSetup();
    const addDialog = await openShellyAddDialog();

    fireEvent.change(within(addDialog).getByLabelText('Adres IP Shelly'), {
      target: { value: 'shelly.local' }
    });
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Dodaj' }));

    expect(
      within(addDialog).getByText('Adres IP Shelly musi wyglądać jak 192.168.0.20.')
    ).toBeInTheDocument();
    expect(within(addDialog).getByLabelText('Adres IP Shelly')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(
      screen.queryByRole('dialog', { name: 'Nie udało się sprawdzić Shelly' })
    ).not.toBeInTheDocument();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('shows the concrete Shelly Add failure instead of replacing it with generic IP advice', async () => {
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (requestBody(init).method === 'Script.List') {
          throw new Error('Script.List test failure');
        }
        return defaultFetch(input, init);
      })
    );

    renderHardwareSetup();
    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));
    const addDialog = await openShellyAddDialog();
    fireEvent.change(within(addDialog).getByLabelText('Nazwa gniazdka'), {
      target: { value: 'Salon' }
    });
    fireEvent.change(within(addDialog).getByLabelText('Adres IP Shelly'), {
      target: { value: '192.168.0.20' }
    });
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Dodaj' }));

    expect(
      await screen.findByText(
        'Nie widzę Shelly Scripts w statusie gniazdka. Sprawdź firmware albo wyłącz Matter.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Sprawdź IP w routerze albo w ustawieniach Shelly.')
    ).not.toBeInTheDocument();
  });

  it('renders saved Shelly status and settings without runtime automation controls', async () => {
    renderHardwareSetup();
    await addShellyThroughUi();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    expect(
      within(savedPlugList).queryByRole('button', { name: 'http://192.168.0.20/' })
    ).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Przekaźnik')).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Tryb')).not.toBeInTheDocument();
    for (const name of ['AUTO', 'MANUAL', 'ON', 'OFF']) {
      expect(
        within(savedPlugList).queryByRole('button', { name })
      ).not.toBeInTheDocument();
    }

    expect(await within(savedPlugList).findByText('0.0 W')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('230 V')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('1.23 kWh')).toBeInTheDocument();

    const infoToggle = within(savedPlugList).getByRole('button', {
      name: 'Ustawienia gniazdka'
    });
    expect(infoToggle).toHaveAttribute('title', 'Ustawienia gniazdka');
    expect(
      within(savedPlugList).getByRole('button', {
        name: 'Skanuj termometry BLE przez to gniazdko'
      })
    ).toBeInTheDocument();
    expect(
      within(savedPlugList).getByRole('button', {
        name: 'Usuń gniazdko tylko z aplikacji'
      })
    ).toHaveClass('icon-action--danger');

    fireEvent.click(infoToggle);
    const infoDialog = await findShellySettingsPage('Przedpokój');
    expect(within(infoDialog).getByText('Adres IP')).toBeInTheDocument();
    expect(
      within(infoDialog).getByRole('link', {
        name: 'Otwórz panel Shelly: http://192.168.0.20/'
      })
    ).toBeInTheDocument();
    expect(within(infoDialog).getByText('Firmware')).toBeInTheDocument();
    expect(
      within(infoDialog).getByText('20260311-095902/1.7.5-g9979d16')
    ).toBeInTheDocument();
    const detailRows = infoDialog.querySelector('.status-stack');
    expect(detailRows).not.toBeNull();
    expect(
      within(detailRows as HTMLElement).queryByText('Przekaźnik')
    ).not.toBeInTheDocument();
    expect(within(detailRows as HTMLElement).queryByText('Tryb')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '‹ Shelly' }));

    const rpcMethods = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]).method)
      .filter(Boolean);
    expect(rpcMethods).not.toContain('Script.Start');
    expect(rpcMethods).not.toContain('Script.Stop');
    expect(rpcMethods).not.toContain('Switch.Set');
  });

  it('keeps installed-runtime ownership out of generic Shelly setup', async () => {
    renderHardwareSetup();
    await addShellyThroughUi();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    for (const name of ['AUTO', 'MANUAL', 'ON', 'OFF']) {
      expect(
        within(savedPlugList).queryByRole('button', { name })
      ).not.toBeInTheDocument();
    }
    expect(
      within(savedPlugList).getByRole('button', { name: 'Ustawienia gniazdka' })
    ).toBeInTheDocument();
    expect(
      within(savedPlugList).getByRole('button', {
        name: 'Skanuj termometry BLE przez to gniazdko'
      })
    ).toBeInTheDocument();

    const runtimeMutations = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]).method)
      .filter((method) =>
        ['Script.Start', 'Script.Stop', 'Switch.Set'].includes(method ?? '')
      );
    expect(runtimeMutations).toEqual([]);
  });

  it('renders a saved Shelly plug in final setup shape and refreshes status', async () => {
    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      shellyDevices: [
        {
          id: 'http://192.168.0.20/',
          name: 'Shelly Plug S Gen3',
          baseUrl: 'http://192.168.0.20/',
          scriptIdInput: '1'
        }
      ],
      selectedShellyId: 'http://192.168.0.20/'
    });

    renderHardwareSetup();

    expect(screen.queryByText('nieznany')).not.toBeInTheDocument();
    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    expect(within(savedPlugList).getByText('Shelly Plug S Gen3')).toBeInTheDocument();
    expect(within(savedPlugList).queryByLabelText('Nazwa')).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Moc')).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Napięcie')).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Energia')).not.toBeInTheDocument();
    for (const name of ['AUTO', 'MANUAL', 'ON', 'OFF']) {
      expect(
        within(savedPlugList).queryByRole('button', { name })
      ).not.toBeInTheDocument();
    }
    expect(
      within(savedPlugList).getByRole('button', { name: 'Ustawienia gniazdka' })
    ).toBeInTheDocument();

    expect(await within(savedPlugList).findByText('0.0 W')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('230 V')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('1.23 kWh')).toBeInTheDocument();
  });

  it('forgets a saved Shelly plug without deleting durable automation ownership', async () => {
    const installation = createInstalledAutomation({
      shelly: { id: 'shellyplugsg3-test', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Salon',
      baseUrl: 'http://192.168.0.20/',
      scriptId: 1,
      scriptHash: 'owned-script',
      config: createDefaultShellyThermostatConfig(
        'xiaomi_lywsd03mmc_bthome_v2',
        'heating'
      ),
      nowMs: 1000
    });
    useInstalledAutomationStore.getState().upsertInstallation(installation);

    renderHardwareSetup();
    await addShellyThroughUi('Salon');

    fireEvent.click(
      screen.getByRole('button', { name: 'Usuń gniazdko tylko z aplikacji' })
    );

    const dialog = await screen.findByRole('dialog', { name: 'Usunąć gniazdko?' });
    expect(within(dialog).getByText('Salon')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Gniazdko zostanie usunięte tylko z aplikacji. Skrypt zapisany w Shelly pozostanie bez zmian.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Brak dodanych gniazdek.')).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Usuń' }));

    expect(
      screen.queryByRole('dialog', { name: 'Usunąć gniazdko?' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Brak dodanych gniazdek.')).toBeInTheDocument();
    expect(await screen.findByText('Usunięto gniazdko z aplikacji.')).toBeInTheDocument();
    expect(useInstalledAutomationStore.getState().installations).toEqual([installation]);
  });

  it('re-adds the same physical Shelly at a new endpoint and reconciles its automation', async () => {
    const installation = createInstalledAutomation({
      shelly: { id: 'shellyplugsg3-test', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Old name',
      baseUrl: 'http://192.168.0.19/',
      scriptId: 1,
      scriptHash: hashScriptCode(
        `${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${createStoredThermostatScript()}`
      ),
      config: createDefaultShellyThermostatConfig(
        'xiaomi_lywsd03mmc_bthome_v2',
        'heating'
      ),
      nowMs: 1000
    });
    useInstalledAutomationStore.getState().upsertInstallation(installation);

    renderHardwareSetup();
    await addShellyThroughUi('Salon');

    expect(useHardwareSetupDraftStore.getState().shellyDevices).toContainEqual(
      expect.objectContaining({
        id: 'shellyplugsg3-test',
        name: 'Salon',
        baseUrl: 'http://192.168.0.20/'
      })
    );
    const reconciled = useInstalledAutomationStore.getState().installations[0];
    expect(reconciled?.shelly).toMatchObject({
      deviceId: 'shellyplugsg3-test',
      name: 'Salon',
      baseUrl: 'http://192.168.0.20/'
    });
    expect(reconciled?.installedAtMs).toBe(1000);
  });

  it('keeps a saved Shelly plug when the styled removal modal is cancelled', async () => {
    renderHardwareSetup();
    await addShellyThroughUi('Salon');

    fireEvent.click(
      screen.getByRole('button', { name: 'Usuń gniazdko tylko z aplikacji' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Usunąć gniazdko?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Anuluj' }));

    expect(
      screen.queryByRole('dialog', { name: 'Usunąć gniazdko?' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Salon')).toBeInTheDocument();
    expect(screen.queryByText('Usunięto gniazdko z aplikacji.')).not.toBeInTheDocument();
    expect(screen.queryByText('Brak dodanych gniazdek.')).not.toBeInTheDocument();
  });

  it('does not use native browser dialogs for Shelly removal confirmation', async () => {
    const confirm = vi.fn(() => {
      throw new Error('native confirm should not be used');
    });
    vi.stubGlobal('confirm', confirm);
    renderHardwareSetup();
    await addShellyThroughUi('Salon');

    fireEvent.click(
      screen.getByRole('button', { name: 'Usuń gniazdko tylko z aplikacji' })
    );

    expect(
      await screen.findByRole('dialog', { name: 'Usunąć gniazdko?' })
    ).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('keeps a saved Shelly manageable before any automation exists', async () => {
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        const body = requestBody(init);

        if (url.pathname === '/rpc' && url.hostname !== '192.168.0.20') {
          return new Response('<!doctype html><html></html>', {
            status: 200,
            headers: { 'content-type': 'text/html' }
          });
        }

        switch (body.method) {
          case 'Shelly.GetDeviceInfo':
            return rpcResult({
              id: `shellyplugsg3-${url.hostname.split('.').join('-')}`,
              model: 'S3PL-00112EU',
              gen: 3
            });
          case 'Shelly.GetStatus':
            return rpcResult({
              ble: {},
              script: {},
              'switch:0': { id: 0, output: false }
            });
          case 'Script.List':
            return rpcResult({ scripts: [] });
          default:
            return rpcResult({});
        }
      }
    );

    renderHardwareSetup();
    await addShellyThroughUi();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    for (const name of ['AUTO', 'MANUAL', 'ON', 'OFF']) {
      expect(
        within(savedPlugList).queryByRole('button', { name })
      ).not.toBeInTheDocument();
    }
    expect(
      within(savedPlugList).getByRole('button', { name: 'Ustawienia gniazdka' })
    ).toBeInTheDocument();
    expect(
      within(savedPlugList).getByRole('button', {
        name: 'Skanuj termometry BLE przez to gniazdko'
      })
    ).toBeInTheDocument();

    const rpcMethods = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]).method)
      .filter(Boolean);
    expect(rpcMethods).not.toContain('Script.Start');
    expect(rpcMethods).not.toContain('Script.Stop');
    expect(rpcMethods).not.toContain('Switch.Set');
  });

  it('adds a scanned Shelly directly with an editable per-result name', async () => {
    renderHardwareSetup();

    const page = await openShellyAddDialog('scan');
    expect(within(page).getByLabelText('Od')).toHaveValue('192.168.0.1');
    expect(within(page).getByLabelText('Do')).toHaveValue('192.168.0.254');

    const shellyScanControl = within(page).getByRole('button', {
      name: 'Rozpocznij skan'
    });
    expect(shellyScanControl).toHaveClass('device-scan-action');
    expect(shellyScanControl).not.toHaveAttribute('aria-busy');
    expect(shellyScanControl.querySelector('.device-scan-action__spinner')).toBeNull();
    fireEvent.click(shellyScanControl);

    expect(await within(page).findByText('http://192.168.0.20/')).toBeInTheDocument();
    expect(within(page).getByText('S3PL-00112EU, gen 3')).toBeInTheDocument();
    const scannedName = within(page).getByRole('textbox', {
      name: 'Nazwa gniazdka: http://192.168.0.20/'
    });
    expect(scannedName).toHaveValue('S3PL-00112EU');
    const scannedRow = scannedName.closest(
      '.device-discovery-card'
    ) as HTMLElement | null;
    expect(scannedRow).not.toBeNull();
    expect(scannedRow).toHaveClass('shelly-scan-result');
    expect(scannedName).toHaveClass('device-discovery-card__name-input');
    expect(within(scannedRow!).getAllByRole('textbox')).toHaveLength(1);
    expect(within(scannedRow!).getByText('http://192.168.0.20/')).toHaveClass(
      'device-discovery-card__identity'
    );
    expect(within(scannedRow!).getByText('S3PL-00112EU, gen 3')).toBeVisible();
    expect(
      within(scannedRow!).getByRole('button', { name: 'Dodaj: http://192.168.0.20/' })
    ).toHaveClass('device-discovery-card__action');
    fireEvent.change(scannedName, { target: { value: 'Salon' } });

    fireEvent.click(
      within(page).getByRole('button', { name: 'Dodaj: http://192.168.0.20/' })
    );

    expect(screen.getByRole('region', { name: 'Dodaj gniazdko' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();
    await waitFor(() =>
      expect(
        within(page).getByRole('button', { name: 'Dodane: http://192.168.0.20/' })
      ).toBeDisabled()
    );
    expect(within(page).getByText('http://192.168.0.20/')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();
    closeCurrentAddPage();
    const savedPlugList = await screen.findByLabelText('Dodane gniazdka');
    expect(within(savedPlugList).getByText('Salon')).toBeInTheDocument();
  });

  it('shows already saved Shelly devices and continues scanning the full range', async () => {
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        const body = requestBody(init);
        if (
          url.pathname === '/rpc' &&
          url.hostname !== '192.168.0.20' &&
          url.hostname !== '192.168.0.21'
        ) {
          return new Response('<!doctype html><html></html>', {
            status: 200,
            headers: { 'content-type': 'text/html' }
          });
        }

        switch (body.method) {
          case 'Shelly.GetDeviceInfo':
            return rpcResult({
              id: `shellyplugsg3-${url.hostname.split('.').join('-')}`,
              model: 'S3PL-00112EU',
              gen: 3
            });
          case 'Shelly.GetStatus':
            return rpcResult({
              ble: {},
              script: {},
              'switch:0': { id: 0, output: false }
            });
          case 'Script.List':
            return rpcResult({
              scripts: [
                {
                  id: 1,
                  name: 'Local Climate Link Thermostat',
                  enable: true,
                  running: true
                }
              ]
            });
          default:
            return rpcResult({});
        }
      }
    );
    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    vi.mocked(fetch).mockClear();

    const addDialog = await openShellyAddDialog('scan');
    const dialog = addDialog;
    fireEvent.change(within(dialog).getByLabelText('Od'), {
      target: { value: '192.168.0.19' }
    });
    fireEvent.change(within(dialog).getByLabelText('Do'), {
      target: { value: '192.168.0.21' }
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));

    expect(await within(dialog).findByText('http://192.168.0.20/')).toBeInTheDocument();
    expect(within(dialog).getByText('http://192.168.0.21/')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Dodane: http://192.168.0.20/' })
    ).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Dodaj: http://192.168.0.21/' })
    ).toBeEnabled();
    const scannedHosts = vi
      .mocked(fetch)
      .mock.calls.map((call) => ({
        method: requestBody(call[1]).method,
        url: requestUrl(call[0])
      }))
      .filter(
        ({ method, url }) => method === 'Shelly.GetDeviceInfo' && url.pathname === '/rpc'
      )
      .map(({ url }) => url.hostname);
    expect(scannedHosts).toContain('192.168.0.20');
    expect(scannedHosts).toContain('192.168.0.21');
  });

  it('keeps the Shelly scan page minimal without presets or help chrome', async () => {
    renderHardwareSetup();

    const page = await openShellyAddDialog('scan');
    expect(within(page).getByLabelText('Od')).toHaveValue('192.168.0.1');
    expect(within(page).getByLabelText('Do')).toHaveValue('192.168.0.254');
    expect(within(page).queryByRole('button', { name: 'STA' })).toBeNull();
    expect(within(page).queryByRole('button', { name: 'AP' })).toBeNull();
    expect(
      within(page).queryByRole('button', { name: 'Informacja o skanowaniu Shelly' })
    ).toBeNull();
    expect(within(page).queryByText(/Zakres:/)).toBeNull();
    expect(within(page).getByRole('button', { name: 'Rozpocznij skan' })).toHaveClass(
      'secondary-action'
    );

    const manualTab = within(page).getByRole('tab', { name: 'Dodaj ręcznie' });
    fireEvent.click(manualTab);
    expect(
      within(page).getByRole('tabpanel', { name: 'Dodaj ręcznie' })
    ).toBeInTheDocument();
    fireEvent.click(within(page).getByRole('tab', { name: 'Skanuj sieć' }));
    expect(
      within(page).getByRole('tabpanel', { name: 'Skanuj sieć' })
    ).toBeInTheDocument();
  });

  it('uses the discovered model as the default scanner name without populating the manual form', async () => {
    renderHardwareSetup();

    let page = await openShellyAddDialog('scan');
    const manualTab = within(page).getByRole('tab', { name: 'Dodaj ręcznie' });
    const scanTab = within(page).getByRole('tab', { name: 'Skanuj sieć' });
    fireEvent.click(manualTab);
    const manualName = within(page).getByRole('textbox', { name: /^Nazwa gniazdka$/ });
    const manualAddress = within(page).getByLabelText('Adres IP Shelly');
    const initialManualName = (manualName as HTMLInputElement).value;
    const initialManualAddress = (manualAddress as HTMLInputElement).value;
    fireEvent.click(scanTab);

    fireEvent.click(within(page).getByRole('button', { name: 'Rozpocznij skan' }));
    await within(page).findByText('http://192.168.0.20/');

    expect(
      within(page).getByRole('textbox', {
        name: 'Nazwa gniazdka: http://192.168.0.20/'
      })
    ).toHaveValue('S3PL-00112EU');
    fireEvent.click(
      within(page).getByRole('button', { name: 'Dodaj: http://192.168.0.20/' })
    );
    await waitFor(() =>
      expect(
        within(page).getByRole('button', { name: 'Dodane: http://192.168.0.20/' })
      ).toBeDisabled()
    );
    closeCurrentAddPage();

    const savedPlugList = await screen.findByLabelText('Dodane gniazdka');
    expect(within(savedPlugList).getByText('S3PL-00112EU')).toBeInTheDocument();

    page = await openShellyAddDialog('manual');
    expect(within(page).getByRole('textbox', { name: /^Nazwa gniazdka$/ })).toHaveValue(
      initialManualName
    );
    expect(within(page).getByLabelText('Adres IP Shelly')).toHaveValue(
      initialManualAddress
    );
  });

  it('stops an active Shelly scan from the inline task control', async () => {
    const abortableFetch = createAbortableFetchMock();
    vi.stubGlobal('fetch', abortableFetch.fetchImpl);
    renderHardwareSetup();

    const dialog = await openShellyAddDialog('scan');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));

    const stopButton = await within(dialog).findByRole('button', { name: 'Stop skanu' });
    expect(stopButton).toHaveClass('device-scan-action');
    expect(stopButton).toHaveAttribute('aria-busy', 'true');
    expect(stopButton.querySelector('.device-scan-action__spinner')).not.toBeNull();
    fireEvent.click(stopButton);

    await waitFor(() => expect(abortableFetch.getAbortCount()).toBeGreaterThan(0));
    expect(within(dialog).getByRole('button', { name: 'Rozpocznij skan' })).toBeEnabled();
    expect(
      within(dialog).queryByRole('button', { name: 'Stop skanu' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Skan zatrzymany.')).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText(/Nie znalazłem gniazdka Shelly/i)
    ).not.toBeInTheDocument();
  });

  it('stops an active Shelly scan when closing the add task', async () => {
    const abortableFetch = createAbortableFetchMock();
    vi.stubGlobal('fetch', abortableFetch.fetchImpl);
    renderHardwareSetup();

    const dialog = await openShellyAddDialog('scan');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));
    await within(dialog).findByRole('button', { name: 'Stop skanu' });

    closeCurrentAddPage();

    await waitFor(() => expect(abortableFetch.getAbortCount()).toBeGreaterThan(0));
    expect(
      screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })
    ).not.toBeInTheDocument();
  });

  it('shows a friendly message when the address does not return Shelly JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' }
      })
    );
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));
    const addDialog = await openShellyAddDialog();
    fireEvent.change(within(addDialog).getByLabelText('Adres IP Shelly'), {
      target: { value: '192.168.0.1' }
    });
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Dodaj' }));

    expect(
      screen.queryByRole('dialog', { name: 'Nie udało się sprawdzić Shelly' })
    ).not.toBeInTheDocument();
    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      within(toastRegion)
        .getByText('Nie udało się sprawdzić Shelly.')
        .closest('[role="status"]')
    ).not.toBeNull();
    expect(
      within(toastRegion)
        .getByText('Pod tym adresem nie dostałem poprawnej odpowiedzi z Shelly.')
        .closest('[role="status"]')
    ).not.toBeNull();
    expect(
      within(addDialog).queryByText('Nie udało się sprawdzić Shelly pod tym adresem.')
    ).not.toBeInTheDocument();
    expect(
      within(addDialog).queryByText(/Unexpected token|doctype|valid JSON/i)
    ).not.toBeInTheDocument();
    expect(within(addDialog).getByLabelText('Adres IP Shelly')).toHaveValue(
      '192.168.0.1'
    );
    expect(within(addDialog).getByLabelText('Adres IP Shelly')).not.toHaveAttribute(
      'aria-invalid'
    );
  });

  it('adds Shelly and Xiaomi devices, then enables rule send', async () => {
    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    await addSensorThroughUi({ name: 'Xiaomi salon' });

    expect(screen.getByText('Xiaomi salon')).toBeInTheDocument();
    const sensorCard = getSavedSensorCard('Xiaomi salon');
    const deviceMeta = sensorCard.querySelector('.sensor-card-device-meta');
    expect(deviceMeta).not.toBeNull();
    expect(within(deviceMeta as HTMLElement).getByText('BTHome v2')).toBeVisible();
    expect(
      within(deviceMeta as HTMLElement).getByText('A4:C1:38:4F:24:CD')
    ).toBeVisible();
    expect(within(sensorCard).queryByText('Szczegóły')).not.toBeInTheDocument();
    expect(within(sensorCard).queryByText('MAC')).not.toBeInTheDocument();
    expect(sensorCard.querySelector('details')).toBeNull();
    expect(within(sensorCard).getByLabelText(/^Bateria:/)).toBeVisible();
    expect(within(sensorCard).getByLabelText(/^RSSI:/)).toBeVisible();
    expect(within(sensorCard).getByLabelText(/^Ostatni pomiar:/)).toBeVisible();
    expect(
      sensorCard.querySelectorAll('.sensor-status-strip svg.tabler-icon')
    ).toHaveLength(3);
    expect(
      sensorCard.querySelectorAll('.sensor-status-strip svg:not(.tabler-icon)')
    ).toHaveLength(0);
    expect(
      within(sensorCard).getByRole('button', {
        name: 'Ustaw czas Xiaomi/PVVX zgodnie z telefonem'
      })
    ).toBeInTheDocument();
    expect(
      within(sensorCard).getByRole('button', { name: 'Usuń termometr tylko z aplikacji' })
    ).toHaveClass('icon-action--danger');
    fireEvent.click(within(sensorCard).getByRole('button', { name: 'Nazwa termometru' }));
    expect(within(sensorCard).getByLabelText('Nazwa termometru')).toHaveValue(
      'Xiaomi salon'
    );
    fireEvent.blur(within(sensorCard).getByLabelText('Nazwa termometru'));
    expect(screen.queryByText('wybrane')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wybierz' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    expect(screen.getByLabelText('Gniazdko Shelly')).toHaveAttribute(
      'value',
      'shellyplugsg3-test'
    );
    expect(screen.getByLabelText('Termometr')).toHaveAttribute(
      'value',
      'A4:C1:38:4F:24:CD'
    );
    expect(screen.getByLabelText('Tryb reguły')).toHaveAttribute('value', 'heating');
    expect(screen.getByText('Zaawansowane', { selector: 'summary' })).toBeVisible();
    openRuleDeveloperTools();
    expect(
      screen.queryByText('Narzędzia deweloperskie', { selector: 'summary' })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('VPD assist')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Tryb reguły' }));
    const ruleModeListbox = screen.getByRole('listbox', { name: 'Tryb reguły' });
    expect(
      within(ruleModeListbox).getByRole('option', { name: 'Grzanie' })
    ).toBeInTheDocument();
    expect(
      within(ruleModeListbox).getByRole('option', { name: 'Chłodzenie' })
    ).toBeInTheDocument();
    expect(
      within(ruleModeListbox).getByRole('option', { name: 'Nawilżanie' })
    ).toBeInTheDocument();
    expect(
      within(ruleModeListbox).getByRole('option', { name: 'Osuszanie' })
    ).toBeInTheDocument();
    fireEvent.click(within(ruleModeListbox).getByRole('option', { name: 'Grzanie' }));
    expect(getRuleSummary()).toHaveTextContent(
      'Gdy termometr Xiaomi salon zniknie na 2 min albo Shelly Salon uruchomi się ponownie'
    );
    expect(getRuleSummary()).toHaveTextContent(
      'Po świeżym odczycie automatyka znów zastosuje tę regułę'
    );
    expect(getRuleSummary()).not.toHaveTextContent('gniazdko przejdzie w OFF');
    expect(getRuleSummary()).not.toHaveTextContent('Shelly:');
    expect(getRuleSummary()).not.toHaveTextContent('Termometr:');
    expect(getRuleSummary()).not.toHaveTextContent('RSSI:');
    expect(
      screen.queryByText('Narzędzia deweloperskie', { selector: 'summary' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Shelly Script' })
    ).not.toBeInTheDocument();
    const advancedSection = openRuleDisclosure('Zaawansowane');
    expect(
      within(advancedSection).getByLabelText('Ponowne ON po min')
    ).toBeInTheDocument();
    expect(within(advancedSection).getByRole('button', { name: 'Domyślne' })).toHaveClass(
      'rule-advanced-defaults-link'
    );
    expect(
      screen.queryByRole('dialog', { name: 'Opcje zaawansowane' })
    ).not.toBeInTheDocument();
    openRuleDeveloperTools();
    expect(screen.getByRole('button', { name: 'Shelly Script' })).toHaveAttribute(
      'title',
      'Pokaż wygenerowany Shelly Script'
    );
    expect(
      screen.getByRole('button', { name: 'Przywróć ustawienia z gniazdka' })
    ).toHaveAttribute(
      'title',
      'Zastąp bieżący formularz konfiguracją działającą na tym gniazdku'
    );
    const developerActions = document.querySelector('.rule-developer-actions--compact');
    expect(developerActions).not.toBeNull();
    expect(developerActions).toHaveClass('rule-developer-actions');
    expect(within(developerActions as HTMLElement).getAllByRole('button')).toHaveLength(
      2
    );
    expect(
      screen.queryByRole('button', { name: 'Usuń z Shelly' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Otwórz diagnostykę techniczną' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Skrypt z Shelly' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Skrypt z Shelly' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wyślij' })).toHaveAttribute(
      'title',
      'Wyślij aktualną regułę do Shelly'
    );
    expect(
      screen.getByRole('button', { name: 'Wyślij' }).closest('.action-row')
    ).toHaveClass('rule-action-row');
    const scriptDialog = await openRuleScriptDialog();
    expect(scriptDialog).toHaveClass('lcl-modal');
    const generatedScriptPreview =
      within(scriptDialog).getByLabelText('Wygenerowany skrypt');
    expect(generatedScriptPreview).toHaveClass('lcl-script-preview--fill');
    expect(generatedScriptPreview).toHaveTextContent('A4:C1:38:4F:24:CD');
    expect(
      within(scriptDialog).getByRole('button', { name: 'Kopiuj skrypt' })
    ).toHaveAttribute('title', 'Kopiuj skrypt');
    fireEvent.click(within(scriptDialog).getByRole('button', { name: 'Zamknij' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Wyślij' })).toBeEnabled()
    );
  });

  it('removes a saved thermometer from a styled confirmation modal', async () => {
    renderHardwareSetup();

    await addSensorThroughUi({ name: 'Xiaomi salon' });

    const savedSensorList = screen.getByLabelText('Dodane termometry');
    expect(within(savedSensorList).getByText('BTHome v2')).toBeInTheDocument();

    let sensorCard = getSavedSensorCard('Xiaomi salon');
    fireEvent.click(
      within(sensorCard).getByRole('button', {
        name: 'Usuń termometr tylko z aplikacji'
      })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Usunąć termometr?' });
    expect(within(dialog).getByText('Xiaomi salon')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Termometr zostanie usunięty z konfiguracji aplikacji. Jeśli reguła była już wysłana do Shelly, wyślij ją ponownie.'
      )
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Anuluj' }));
    expect(
      screen.queryByRole('dialog', { name: 'Usunąć termometr?' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Xiaomi salon')).toBeInTheDocument();

    sensorCard = getSavedSensorCard('Xiaomi salon');
    fireEvent.click(
      within(sensorCard).getByRole('button', {
        name: 'Usuń termometr tylko z aplikacji'
      })
    );
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Usunąć termometr?' })).getByRole(
        'button',
        { name: 'Usuń' }
      )
    );

    expect(screen.getByText('Brak dodanych termometrów.')).toBeInTheDocument();
    expect(
      await screen.findByText('Usunięto termometr z aplikacji.')
    ).toBeInTheDocument();
  });

  it('shows rule threshold validation as field feedback', async () => {
    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    await addSensorThroughUi({ name: 'Xiaomi salon' });
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));

    const onThresholdInput = screen.getByLabelText('Włącz poniżej °C');
    const offThresholdInput = screen.getByLabelText('Wyłącz powyżej °C');

    fireEvent.change(onThresholdInput, {
      target: { value: '21' }
    });
    fireEvent.change(offThresholdInput, {
      target: { value: '20' }
    });

    const error = screen.getByText('Próg włączenia musi być niższy niż próg wyłączenia.');
    expect(error).toHaveClass('field__error');
    expect(onThresholdInput).toHaveAttribute('aria-invalid', 'true');
    expect(offThresholdInput).toHaveAttribute('aria-describedby', error.id);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled();
  });

  it('requires the real hardware safe relay test after script upload before ready state', async () => {
    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    await addSensorThroughUi({ name: 'Xiaomi salon' });
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));

    expect(screen.queryByRole('button', { name: 'Przetestuj' })).not.toBeInTheDocument();
    expect(screen.queryByText('Gotowe — działa lokalnie')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }));

    const relayDialog = await screen.findByRole(
      'dialog',
      {
        name: 'Przetestuj przekaźnik przed użyciem'
      },
      { timeout: 3000 }
    );
    expect(
      within(relayDialog).getByText('Dla grzania domyślny tryb bezpieczeństwa to OFF.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Gotowe — działa lokalnie')).not.toBeInTheDocument();
    expect(
      within(relayDialog).getByRole('button', { name: 'Przetestuj' })
    ).toHaveAttribute('title', 'Uruchom krótki test przekaźnika i zakończ stanem OFF');

    const relayBackdrop = document.querySelector('.lcl-modal-backdrop');
    expect(relayBackdrop).not.toBeNull();
    fireEvent.click(relayBackdrop!);
    expect(relayDialog).toBeInTheDocument();

    fireEvent.click(within(relayDialog).getByRole('button', { name: 'Przetestuj' }));

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      within(toastRegion).getByText('Gotowe — działa lokalnie').closest('[role="status"]')
    ).not.toBeNull();

    const rpcBodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]))
      .filter((body) => body.method);
    const scriptStatusIndex = rpcBodies.findIndex(
      (body) => body.method === 'Script.GetStatus'
    );
    const relayOnIndex = rpcBodies.findIndex(
      (body, index) =>
        index > scriptStatusIndex &&
        body.method === 'Switch.Set' &&
        (body.params as { on?: boolean } | undefined)?.on === true
    );
    const relayOffIndex = rpcBodies.findIndex(
      (body, index) =>
        index > relayOnIndex &&
        body.method === 'Switch.Set' &&
        (body.params as { on?: boolean } | undefined)?.on === false
    );
    const relayStatusIndex = rpcBodies.findIndex(
      (body, index) => index > relayOffIndex && body.method === 'Switch.GetStatus'
    );

    expect(scriptStatusIndex).toBeGreaterThanOrEqual(0);
    expect(relayOnIndex).toBeGreaterThan(scriptStatusIndex);
    expect(relayOffIndex).toBeGreaterThan(relayOnIndex);
    expect(relayStatusIndex).toBeGreaterThan(relayOffIndex);
  });

  it('creates neutral sensor ids for Xiaomi and TP357 configurations', () => {
    expect(formatSensorId('xiaomi_lywsd03mmc_bthome_v2', 'A4:C1:38:4F:24:CD')).toBe(
      'sensor-a4c1384f24cd'
    );
    expect(formatSensorId('tp357_custom_v1', 'F7:5F:8D:0F:76:20')).toBe(
      'sensor-f75f8d0f7620'
    );
  });

  it('shows compact Shelly plug telemetry after reading status', async () => {
    renderHardwareSetup();

    await addShellyThroughUi('Salon');

    expect(screen.getByText('0.0 W')).toBeInTheDocument();
    expect(screen.getByText('230 V')).toBeInTheDocument();
    expect(screen.getByText('1.23 kWh')).toBeInTheDocument();
    expect(screen.getByText('09:31')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia gniazdka' }));
    const infoDialog = await findShellySettingsPage('Salon');
    await waitFor(() =>
      expect(
        within(infoDialog).getByText('NTP').closest('.lcl-diagnostic-row')
      ).toHaveTextContent('zsynchronizowany')
    );
    expect(within(infoDialog).getByText('3 h 25 min')).toBeInTheDocument();
    expect(within(infoDialog).getByText('NTP')).toBeInTheDocument();
    expect(
      within(infoDialog).queryByRole('button', { name: 'Odśwież' })
    ).not.toBeInTheDocument();
  });

  it('removes a stale BLE discovery script before saving the rule', async () => {
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = requestBody(init);
        if (requestUrl(input).pathname === '/rpc' && body.method === 'Script.List') {
          return rpcResult({
            scripts: [
              {
                id: 1,
                name: 'Local Climate Link Thermostat',
                enable: true,
                running: true
              },
              {
                id: 8,
                name: 'Local Climate Link BLE Discovery',
                enable: false,
                running: true
              }
            ]
          });
        }
        return defaultFetch(input, init);
      })
    );
    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    await addSensorThroughUi({ name: 'Xiaomi salon' });
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }));

    await waitFor(
      () => {
        const rpcBodies = vi
          .mocked(fetch)
          .mock.calls.map((call) => requestBody(call[1]))
          .filter((body) => body.method);
        const discoveryDeleteIndex = rpcBodies.findIndex(
          (body) =>
            body.method === 'Script.Delete' &&
            (body.params as { id?: number } | undefined)?.id === 8
        );
        const putCodeIndex = rpcBodies.findIndex(
          (body) => body.method === 'Script.PutCode'
        );

        expect(discoveryDeleteIndex).toBeGreaterThanOrEqual(0);
        expect(putCodeIndex).toBeGreaterThanOrEqual(0);
        expect(discoveryDeleteIndex).toBeLessThan(putCodeIndex);
      },
      { timeout: 3000 }
    );
  });

  it('loads a multi-sensor Shelly script into the rule form from the selected plug', async () => {
    const defaultFetch = vi.mocked(fetch);
    const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating');
    const multiSensorCode = generateShellyThermostatScript({
      ...base,
      sensor: {
        ...base.sensor,
        sensorId: 'tp357-primary',
        runtimeAddress: 'F7:5F:8D:0F:76:20',
        displayName: 'TP357 primary'
      },
      sensorSet: {
        aggregation: 'max',
        additionalSensors: [
          {
            ...base.sensor,
            sensorId: 'tp357-shelf',
            runtimeAddress: 'C2:C0:00:30:64:02',
            displayName: 'TP357 shelf'
          }
        ]
      }
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = requestBody(init);
        if (requestUrl(input).pathname === '/rpc' && body.method === 'Script.GetCode') {
          return rpcResult({ data: multiSensorCode, left: 0 });
        }
        return defaultFetch(input, init);
      })
    );
    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));

    expect(screen.getByLabelText('Termometr')).toHaveAttribute('value', '');
    chooseSelectField('Tryb reguły', 'Chłodzenie');
    fireEvent.change(screen.getByLabelText('Włącz powyżej °C'), {
      target: { value: '24' }
    });
    fireEvent.change(screen.getByLabelText(/Wyłącz poniżej °C/), {
      target: { value: '23' }
    });
    const advancedSection = openRuleDisclosure('Zaawansowane');
    fireEvent.change(within(advancedSection).getByLabelText('Minimalny RSSI dBm'), {
      target: { value: '-60' }
    });
    fireEvent.change(within(advancedSection).getByLabelText('Brak odczytu przez min'), {
      target: { value: '30' }
    });
    fireEvent.change(within(advancedSection).getByLabelText('Ponowne ON po min'), {
      target: { value: '10' }
    });
    fireEvent.change(within(advancedSection).getByLabelText('Maksymalny czas pracy h'), {
      target: { value: '8' }
    });

    openRuleDeveloperTools();
    fireEvent.click(
      screen.getByRole('button', { name: 'Przywróć ustawienia z gniazdka' })
    );
    const restoreDialog = screen.getByRole('dialog', {
      name: 'Przywrócić ustawienia z gniazdka?'
    });
    expect(restoreDialog).toHaveTextContent(
      'Nic nie zostanie jeszcze zapisane na urządzeniu.'
    );
    fireEvent.click(
      within(restoreDialog).getByRole('button', { name: 'Przywróć ustawienia' })
    );

    expect(
      await screen.findByText('Wczytano ustawienia z Shelly do formularza.')
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('Termometr')).toHaveAttribute(
        'value',
        'F7:5F:8D:0F:76:20'
      )
    );
    expect(screen.getByRole('button', { name: 'Termometr' })).toHaveTextContent(
      'TP357 primary'
    );
    expect(screen.getByRole('checkbox', { name: 'TP357 shelf' })).toBeChecked();
    expect(screen.getByLabelText('Agregacja odczytów')).toHaveAttribute('value', 'max');
    expect(screen.getByLabelText('Tryb reguły')).toHaveAttribute('value', 'heating');
    expect(screen.getByLabelText('Włącz poniżej °C')).toHaveValue(19);
    expect(screen.getByLabelText('Wyłącz powyżej °C')).toHaveValue(20);

    expect(within(advancedSection).getByLabelText('Minimalny RSSI dBm')).toHaveValue(-85);
    expect(within(advancedSection).getByLabelText('Brak odczytu przez min')).toHaveValue(
      2
    );
    expect(within(advancedSection).getByLabelText('Ponowne ON po min')).toHaveValue(2);
    expect(within(advancedSection).getByLabelText('Maksymalny czas pracy h')).toHaveValue(
      4
    );

    const scriptDialog = await openRuleScriptDialog();
    expect(within(scriptDialog).getByLabelText('Wygenerowany skrypt')).toHaveTextContent(
      'm: climate-engine-v1'
    );
    expect(within(scriptDialog).getByLabelText('Wygenerowany skrypt')).toHaveTextContent(
      'F7:5F:8D:0F:76:20'
    );
    fireEvent.click(within(scriptDialog).getByRole('button', { name: 'Zamknij' }));
  });

  it('does not replay rule success toasts after returning to the rule page', async () => {
    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    await addSensorThroughUi({ name: 'Xiaomi salon' });
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));

    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }));
    const relayDialog = await screen.findByRole(
      'dialog',
      {
        name: 'Przetestuj przekaźnik przed użyciem'
      },
      { timeout: 3000 }
    );
    fireEvent.click(within(relayDialog).getByRole('button', { name: 'Przetestuj' }));

    expect(await screen.findByText('Gotowe — działa lokalnie')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Zamknij: Gotowe — działa lokalnie' })
    );
    await waitFor(() =>
      expect(screen.queryByText('Gotowe — działa lokalnie')).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    expect(screen.getByRole('button', { name: 'Termometry' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));

    expect(screen.queryByText('Gotowe — działa lokalnie')).not.toBeInTheDocument();
    expect(screen.queryByText('Usunięto skrypt Shelly.')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Powiadomienia' })
    ).not.toBeInTheDocument();
  });

  it('adds a TP357 thermometer and previews the minimal TP357 Shelly parser', async () => {
    renderHardwareSetup();

    await addSensorThroughUi({
      mac: 'C2:C0:00:30:64:01',
      name: 'TP357 salon',
      profile: 'tp357_custom_v1'
    });

    expect(screen.getByText('TP357 salon')).toBeInTheDocument();
    expect(
      within(getSavedSensorCard('TP357 salon')).getByText('TP357')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));

    expect(screen.getByLabelText('Termometr')).toHaveAttribute(
      'value',
      'C2:C0:00:30:64:01'
    );
    expect(getRuleSummary()).toHaveTextContent(
      'Gdy termometr TP357 salon zniknie na 2 min'
    );
    expect(getRuleSummary()).not.toHaveTextContent('TP357, C2:C0:00:30:64:01');
    const scriptDialog = await openRuleScriptDialog();
    expect(within(scriptDialog).getByLabelText('Wygenerowany skrypt')).toHaveTextContent(
      'm: climate-engine-v1'
    );
    expect(within(scriptDialog).getByLabelText('Wygenerowany skrypt')).toHaveTextContent(
      '"tm"'
    );
    expect(
      within(scriptDialog).getByLabelText('Wygenerowany skrypt')
    ).not.toHaveTextContent('BTHome.parseData');
    expect(
      within(scriptDialog).getByLabelText('Wygenerowany skrypt')
    ).not.toHaveTextContent('tp357-parser-placeholder');
  });

  it('keeps the BLE add-page scan alive across candidate rerenders', async () => {
    phoneBleScannerMock.advertisementDelayMs = 60;
    renderHardwareSetup({ sensorAddOnly: true, sensorAddMode: 'phone-scan' });

    expect(await screen.findByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
    expect(await screen.findByText('F7:5F:8D:0F:76:20')).toBeInTheDocument();
  });

  it('uses the thermometer add child page for phone BLE scan and keeps result order stable', async () => {
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    let page = await openSensorAddDialog();
    const scanTab = within(page).getByRole('tab', { name: 'Skanuj BLE' });
    expect(scanTab).toHaveAttribute('title', 'Skanuj termometry BLE telefonem');
    fireEvent.click(scanTab);

    expect(screen.queryByRole('dialog', { name: 'Skanuj BLE telefonem' })).toBeNull();
    let xiaomiAddress = await findBleScanCandidate(page);
    let xiaomiItem = xiaomiAddress.closest('article');
    expect(xiaomiItem).not.toBeNull();
    expect(xiaomiItem).toHaveClass('device-discovery-card');
    const xiaomiAddButton = within(xiaomiItem!).getByRole('button', { name: 'Dodaj' });
    expect(xiaomiAddButton).toHaveAttribute('title', 'Zapisz ten termometr w aplikacji');
    expect(xiaomiAddButton).toHaveClass('device-discovery-card__action');
    const xiaomiNameInput = within(xiaomiItem!).getByRole('textbox', {
      name: 'Nazwa termometru: A4:C1:38:4F:24:CD'
    });
    expect(xiaomiNameInput).toHaveValue('Termometr 24:CD');
    expect(xiaomiNameInput).toHaveClass('device-discovery-card__name-input');
    expect(within(xiaomiItem!).getByText('A4:C1:38:4F:24:CD')).toHaveClass(
      'device-discovery-card__identity'
    );
    expect(within(xiaomiItem!).getByText('BTHome v2')).toBeInTheDocument();
    expect(within(xiaomiItem!).getByText('21.3°C')).toBeInTheDocument();
    expect(within(xiaomiItem!).getByText('45.7%')).toBeInTheDocument();
    expect(within(xiaomiItem!).getByText('-58 dBm')).toBeInTheDocument();
    const bleScanControl = within(page).getByRole('button', { name: 'Stop skanu' });
    expect(bleScanControl).toHaveClass('device-scan-action');
    expect(bleScanControl).toHaveAttribute('aria-busy', 'true');
    expect(bleScanControl.querySelector('.device-scan-action__spinner')).not.toBeNull();

    await waitFor(() => expect(within(page).getAllByRole('article')).toHaveLength(2));
    const candidateItems = within(page).getAllByRole('article');
    expect(within(candidateItems[0]!).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
    expect(within(candidateItems[1]!).getByText('F7:5F:8D:0F:76:20')).toBeInTheDocument();
    expect(within(candidateItems[1]!).getByText('-74 dBm')).toBeInTheDocument();

    closeCurrentAddPage();
    expect(screen.queryByRole('heading', { name: 'Dodaj termometr' })).toBeNull();

    page = await openSensorAddDialog();
    fireEvent.click(within(page).getByRole('tab', { name: 'Skanuj BLE' }));
    xiaomiAddress = await findBleScanCandidate(page);
    xiaomiItem = xiaomiAddress.closest('article');
    expect(xiaomiItem).not.toBeNull();

    const scannedSensorName = within(xiaomiItem!).getByRole('textbox', {
      name: 'Nazwa termometru: A4:C1:38:4F:24:CD'
    });
    fireEvent.change(scannedSensorName, { target: { value: 'Salon półka' } });
    fireEvent.click(within(xiaomiItem!).getByRole('button', { name: 'Dodaj' }));

    expect(screen.getByRole('region', { name: 'Dodaj termometr' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Dodaj termometr' })).toBeNull();
    expect(
      within(xiaomiItem!).getByRole('button', { name: 'Już zapisany' })
    ).toBeDisabled();
    expect(await within(page).findByText('F7:5F:8D:0F:76:20')).toBeInTheDocument();
    closeCurrentAddPage();
    expect(await screen.findByText('Salon półka')).toBeInTheDocument();
    expect(screen.getByText('21.3°C')).toBeInTheDocument();
    expect(screen.getByText('45.7%')).toBeInTheDocument();
    const sensorCard = getSavedSensorCard('Salon półka');
    expect(within(sensorCard).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
  });

  it('refreshes saved thermometer cards from a foreground phone BLE scan', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      sensorDevices: [
        {
          id: 'A4:C1:38:4F:24:CD',
          name: 'Xiaomi salon',
          runtimeAddress: 'A4:C1:38:4F:24:CD',
          profileId: 'xiaomi_lywsd03mmc_bthome_v2'
        }
      ],
      selectedSensorId: 'A4:C1:38:4F:24:CD'
    });
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));

    expect(await screen.findByText('21.3°C')).toBeInTheDocument();
    expect(screen.getByText('45.7%')).toBeInTheDocument();
    const sensorCard = getSavedSensorCard('Xiaomi salon');
    await waitFor(() => expect(within(sensorCard).getByText('100%')).toBeInTheDocument());
    await waitFor(() =>
      expect(within(sensorCard).getByText('-72 dBm')).toBeInTheDocument()
    );
  });

  it('keeps rule thresholds manual and preserves the compact setup action order', () => {
    renderHardwareSetup();
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));

    const onThreshold = screen.getByLabelText('Włącz poniżej °C');
    const offThreshold = screen.getByLabelText('Wyłącz powyżej °C');
    expect(onThreshold.closest('.field-row')).toBe(offThreshold.closest('.field-row'));
    expect(onThreshold.closest('.rule-threshold-row')).toBeNull();

    fireEvent.change(onThreshold, { target: { value: '21' } });
    expect(onThreshold).toHaveValue(21);
    expect(offThreshold).toHaveValue(20);
    expect(
      screen.getByText('Próg włączenia musi być niższy niż próg wyłączenia.')
    ).toBeVisible();

    const developerActions = document.querySelector('.rule-developer-actions--compact');
    expect(developerActions).not.toBeNull();
    expect(developerActions!.querySelectorAll('button')).toHaveLength(2);
    expect(
      screen.queryByText('Narzędzia deweloperskie', { selector: 'summary' })
    ).not.toBeInTheDocument();

    const advanced = screen.getByText('Zaawansowane', { selector: 'summary' });
    const send = screen.getByRole('button', { name: 'Wyślij' });
    const follows = (first: Node, second: Node) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

    const advancedDetails = advanced.closest('details');
    expect(advancedDetails).not.toBeNull();
    expect(advancedDetails!.contains(developerActions)).toBe(true);
    expect(follows(advancedDetails!, send)).toBe(true);
  });

  it('shows compact live values on the right side of the rule thermometer options', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      sensorDevices: [
        {
          id: 'A4:C1:38:4F:24:CD',
          name: 'Xiaomi salon',
          runtimeAddress: 'A4:C1:38:4F:24:CD',
          profileId: 'xiaomi_lywsd03mmc_bthome_v2'
        }
      ],
      selectedSensorId: 'A4:C1:38:4F:24:CD'
    });
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    await waitFor(() => expect(phoneBleScannerMock.startCount).toBeGreaterThanOrEqual(1));

    const thermometerSelect = screen.getByRole('button', { name: 'Termometr' });
    await waitFor(() => expect(thermometerSelect).toHaveTextContent('Xiaomi salon'));
    expect(thermometerSelect).not.toHaveTextContent('21.3°C · 45.7%');
    expect(thermometerSelect.querySelector('.lcl-select-field__trigger-meta')).toBeNull();
    fireEvent.click(thermometerSelect);

    const option = await screen.findByRole('option', { name: 'Xiaomi salon' });
    expect(option).toHaveTextContent('21.3°C · 45.7%');
    expect(option).not.toHaveTextContent('kPa');
    expect(option.querySelector('.tabler-icon-device-mobile')).not.toBeNull();
    const metadata = option.querySelector('.lcl-select-field__option-meta');
    expect(metadata).not.toBeNull();
    expect(metadata).toHaveTextContent('21.3°C · 45.7%');
    expect(metadata).not.toHaveTextContent('kPa');
  });

  it('restarts saved thermometer live scan after app visibility resumes', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      sensorDevices: [
        {
          id: 'A4:C1:38:4F:24:CD',
          name: 'Xiaomi salon',
          runtimeAddress: 'A4:C1:38:4F:24:CD',
          profileId: 'xiaomi_lywsd03mmc_bthome_v2'
        }
      ],
      selectedSensorId: 'A4:C1:38:4F:24:CD'
    });
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    expect(await screen.findByText('21.3°C')).toBeInTheDocument();
    expect(phoneBleScannerMock.startCount).toBeGreaterThanOrEqual(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden'
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(phoneBleScannerMock.stopCount).toBeGreaterThanOrEqual(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(
      () => expect(phoneBleScannerMock.startCount).toBeGreaterThanOrEqual(2),
      { timeout: 1000 }
    );
  });

  it('restarts saved thermometer live scan after an unexpected scanner end', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      sensorDevices: [
        {
          id: 'A4:C1:38:4F:24:CD',
          name: 'Xiaomi salon',
          runtimeAddress: 'A4:C1:38:4F:24:CD',
          profileId: 'xiaomi_lywsd03mmc_bthome_v2'
        }
      ]
    });
    phoneBleScannerMock.endContinuousScanCount = 1;
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    expect(await screen.findByText('21.3°C')).toBeInTheDocument();
    await waitFor(
      () => expect(phoneBleScannerMock.startCount).toBeGreaterThanOrEqual(2),
      { timeout: 2500 }
    );
  });

  it('shows phone BLE scan startup errors as toast feedback', async () => {
    phoneBleScannerMock.failureMessage = 'Phone BLE scan is unavailable in this runtime.';
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const page = await openSensorAddDialog();
    fireEvent.click(within(page).getByRole('tab', { name: 'Skanuj BLE' }));

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      within(toastRegion)
        .getByText('Nie udało się uruchomić BLE.')
        .closest('[role="status"]')
    ).not.toBeNull();
    expect(
      within(toastRegion).getByText(
        'Skan BLE z telefonu wymaga aplikacji mobilnej. W przeglądarce nie dostanę MAC termometru.'
      )
    ).toBeInTheDocument();
    expect(
      within(toastRegion).queryByText('Skanuję BLE z telefonu.')
    ).not.toBeInTheDocument();
    expect(within(page).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Skanuj BLE telefonem' })).toBeNull();
  });

  it('shows phone BLE permission errors as actionable toast feedback', async () => {
    phoneBleScannerMock.failureMessage = 'Permission denied.';
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const page = await openSensorAddDialog();
    fireEvent.click(within(page).getByRole('tab', { name: 'Skanuj BLE' }));

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      within(toastRegion).getByText(
        'Zezwól aplikacji na Bluetooth/Urządzenia w pobliżu i Lokalizację, potem uruchom skan ponownie.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Skanuj BLE telefonem' })).toBeNull();
  });

  it('switches between humidity rule modes and copies the generated script', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    try {
      renderHardwareSetup();

      await addShellyThroughUi('Salon');
      await addSensorThroughUi({ name: 'Xiaomi salon' });

      fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
      chooseSelectField('Tryb reguły', 'Nawilżanie');

      const ruleModeField = screen.getByLabelText('Tryb reguły').closest('.field');
      expect(ruleModeField).not.toBeNull();
      const ruleModeInfoLabel = within(ruleModeField as HTMLElement)
        .getByText('Tryb reguły')
        .closest('.lcl-info-label');
      expect(ruleModeInfoLabel).not.toBeNull();
      expect(
        within(ruleModeInfoLabel as HTMLElement).getByRole('button', {
          name: 'Podsumowanie reguły'
        })
      ).toBeInTheDocument();
      const vpdSection = screen
        .getByText('VPD assist', { selector: 'strong' })
        .closest('section');
      expect(vpdSection).not.toBeNull();
      const vpdInfoLabel = screen
        .getByText('VPD assist', { selector: 'strong' })
        .closest('.lcl-info-label');
      expect(vpdInfoLabel).not.toBeNull();
      const vpdInfoButton = within(vpdInfoLabel as HTMLElement).getByRole('button', {
        name: /Opcjonalnie koryguje punkt pracy/
      });
      fireEvent.click(vpdInfoButton);
      const vpdInfoPopover = within(vpdSection as HTMLElement).getByRole('tooltip', {
        name: 'VPD assist'
      });
      expect(
        within(vpdInfoPopover).getByText(/Nie zmienia limitów bezpieczeństwa/)
      ).toBeInTheDocument();
      expect(
        within(vpdInfoPopover).getByText(/Nie rozszerza zakresu/)
      ).toBeInTheDocument();
      fireEvent.click(vpdInfoButton);
      expect(
        within(vpdSection as HTMLElement).queryByRole('tooltip', { name: 'VPD assist' })
      ).not.toBeInTheDocument();

      expect(screen.getByLabelText('Włącz poniżej %')).toHaveValue(45);
      expect(screen.getByLabelText('Wyłącz powyżej %')).toHaveValue(55);
      expect(getRuleSummary()).toHaveTextContent('Nawilżanie włączy się poniżej 45.0%');
      let scriptDialog = await openRuleScriptDialog();
      expect(
        within(scriptDialog).getByLabelText('Wygenerowany skrypt')
      ).toHaveTextContent('"m":1');
      fireEvent.click(within(scriptDialog).getByRole('button', { name: 'Zamknij' }));

      chooseSelectField('Tryb reguły', 'Osuszanie');

      expect(screen.getByLabelText('Włącz powyżej %')).toHaveValue(65);
      expect(screen.getByLabelText('Wyłącz poniżej %')).toHaveValue(55);
      expect(getRuleSummary()).toHaveTextContent('Osuszanie włączy się powyżej 65.0%');
      scriptDialog = await openRuleScriptDialog();
      expect(
        within(scriptDialog).getByLabelText('Wygenerowany skrypt')
      ).toHaveTextContent('"m":1');
      expect(
        within(scriptDialog).getByLabelText('Wygenerowany skrypt')
      ).toHaveTextContent('"d":1');
      fireEvent.click(within(scriptDialog).getByRole('button', { name: 'Zamknij' }));

      expect(screen.getByLabelText('VPD assist')).not.toBeChecked();
      fireEvent.click(screen.getByLabelText('VPD assist'));
      fireEvent.change(screen.getByLabelText(/Docelowe VPD kPa/), {
        target: { value: '1.25' }
      });

      const advancedSection = openRuleDisclosure('Zaawansowane');
      expect(
        screen.queryByRole('dialog', { name: 'Opcje zaawansowane' })
      ).not.toBeInTheDocument();
      expect(
        within(advancedSection).getByRole('button', { name: 'Domyślne' })
      ).toHaveClass('rule-advanced-defaults-link');
      expect(within(advancedSection).getByText('OFF')).toBeInTheDocument();
      expect(within(advancedSection).getByText('→')).toBeInTheDocument();
      expect(within(advancedSection).getByText('AUTO')).toBeInTheDocument();
      expect(
        within(advancedSection).getByText('po pierwszym odczycie')
      ).toBeInTheDocument();
      expect(
        within(advancedSection).getAllByText('min', {
          selector: '.field-unit-control__unit'
        })
      ).toHaveLength(2);
      expect(
        within(advancedSection).getByText('h', { selector: '.field-unit-control__unit' })
      ).toBeInTheDocument();
      expect(
        within(advancedSection).getByText('dBm', {
          selector: '.field-unit-control__unit'
        })
      ).toBeInTheDocument();
      expect(
        within(vpdSection as HTMLElement).getByText('kPa', {
          selector: '.field-unit-control__unit'
        })
      ).toBeInTheDocument();
      expect(
        screen.getAllByText('%', { selector: '.field-unit-control__unit' })
      ).toHaveLength(2);
      fireEvent.change(within(advancedSection).getByLabelText('Minimalny RSSI dBm'), {
        target: { value: '-80' }
      });
      fireEvent.change(within(advancedSection).getByLabelText('Brak odczytu przez min'), {
        target: { value: '10' }
      });
      fireEvent.change(within(advancedSection).getByLabelText(/Ponowne ON po min/), {
        target: { value: '3' }
      });
      fireEvent.change(
        within(advancedSection).getByLabelText('Maksymalny czas pracy h'),
        {
          target: { value: '3' }
        }
      );
      expect(getRuleSummary()).toHaveTextContent(
        'Gdy termometr Xiaomi salon zniknie na 10 min albo Shelly Salon uruchomi się ponownie'
      );
      expect(getRuleSummary()).toHaveTextContent('Maksymalny czas pracy: 3 h');
      expect(getRuleSummary()).toHaveTextContent('Ponowne ON najwcześniej po 3 min');
      expect(getRuleSummary()).toHaveTextContent('VPD assist uwzględni cel 1.25 kPa');
      expect(getRuleSummary()).toHaveTextContent(
        'Sygnał termometru musi mieć co najmniej -80 dBm'
      );
      expect(getRuleSummary()).not.toHaveTextContent('VPD:');
      expect(getRuleSummary()).not.toHaveTextContent('RSSI:');
      scriptDialog = await openRuleScriptDialog();
      expect(
        within(scriptDialog).getByLabelText('Wygenerowany skrypt')
      ).toHaveTextContent('"vp":1.25');
      expect(
        within(scriptDialog).getByLabelText('Wygenerowany skrypt')
      ).toHaveTextContent('"r":-80');
      expect(
        within(scriptDialog).getByLabelText('Wygenerowany skrypt')
      ).toHaveTextContent('"s":600000');
      expect(
        within(scriptDialog).getByLabelText('Wygenerowany skrypt')
      ).toHaveTextContent('"c":180000');
      expect(
        within(scriptDialog).getByLabelText('Wygenerowany skrypt')
      ).toHaveTextContent('"x":10800000');
      expect(
        within(scriptDialog).getByLabelText('Wygenerowany skrypt')
      ).toHaveTextContent('function sv(t)');
      fireEvent.click(within(scriptDialog).getByRole('button', { name: 'Zamknij' }));

      fireEvent.change(screen.getByLabelText(/Docelowe VPD kPa/), {
        target: { value: '0' }
      });
      expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled();
      expect(screen.getByText('Zakres: 0.1 do 5 kPa.')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/Docelowe VPD kPa/), {
        target: { value: '1.25' }
      });

      fireEvent.change(within(advancedSection).getByLabelText(/Ponowne ON po min/), {
        target: { value: '0' }
      });
      expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled();
      expect(
        within(advancedSection).getByText('Zakres: 0.25 do 60 min.')
      ).toBeInTheDocument();
      fireEvent.change(within(advancedSection).getByLabelText(/Ponowne ON po min/), {
        target: { value: '3' }
      });
      expect(screen.getByRole('button', { name: 'Wyślij' })).toBeEnabled();

      scriptDialog = await openRuleScriptDialog();
      fireEvent.click(
        within(scriptDialog).getByRole('button', { name: 'Kopiuj skrypt' })
      );

      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(
          expect.stringContaining('m: climate-engine-v1')
        )
      );
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"vp":1.25'));
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"r":-80'));
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"c":180000'));
      expect(await screen.findByText('Skopiowano skrypt.')).toBeInTheDocument();
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, 'clipboard', originalClipboard);
      } else {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    }
  });

  it('recognizes a thermometer restored from automation during Shelly-side BLE scan', async () => {
    renderHardwareSetup();

    await addShellyThroughUi();

    await openShellyBleScanFromSettings();
    const dialog = await findShellyBleScanPage();
    const bleInfoButton = within(dialog).getByRole('button', {
      name: 'Informacja o skanowaniu BLE'
    });
    expect(bleInfoButton.closest('.installation-section-heading')).not.toBeNull();
    expect(bleInfoButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(bleInfoButton);
    expect(bleInfoButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(dialog).getByRole('tooltip', {
        name: 'Na czas skanowania zatrzymuję automatyzację'
      })
    ).toHaveTextContent(
      'Shelly uruchomi osobny skrypt skanera BLE. Przekaźnik zostanie ustawiony na OFF, a po zakończeniu skanu wznowię automatyzację, jeśli była uruchomiona.'
    );
    fireEvent.click(bleInfoButton);
    expect(bleInfoButton).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(dialog).queryByRole('button', { name: 'Rozpocznij skan BLE' })
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText('Automatyzacja jest zatrzymana na czas skanowania.')
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Odśwież wyniki' })
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Zakończ skan' })
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Skanuj ponownie' })
    ).not.toBeInTheDocument();

    expect(document.querySelector('.lcl-modal-backdrop')).toBeNull();
    expect(dialog).toBeInTheDocument();

    expect(await findBleScanCandidate(dialog)).toBeInTheDocument();
    expect(within(dialog).getByText('31.2°C')).toBeInTheDocument();
    expect(within(dialog).getByText('-37 dBm')).toBeInTheDocument();

    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Już zapisany' })).toBeDisabled();
    expect(screen.queryByText('Zapisano termometr.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '‹ Shelly' }));
    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    expect(
      within(getSavedSensorCard('Xiaomi salon')).getByText('A4:C1:38:4F:24:CD')
    ).toBeInTheDocument();

    await waitFor(() => {
      const rpcMethods = vi
        .mocked(fetch)
        .mock.calls.map((call) => requestBody(call[1]).method)
        .filter(Boolean);

      expect(rpcMethods).toEqual(
        expect.arrayContaining([
          'Switch.Set',
          'Script.Stop',
          'Script.Create',
          'Script.Start',
          'Script.Delete'
        ])
      );
      expect(rpcMethods.filter((method) => method === 'Script.Stop')).toHaveLength(2);
      expect(rpcMethods.filter((method) => method === 'Script.Delete')).toHaveLength(1);
    });
  });

  it('removes a stale BLE discovery script before starting a new Shelly BLE scan', async () => {
    const defaultFetch = vi.mocked(fetch);
    let staleDiscoveryPresent = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = requestBody(init);
        if (
          requestUrl(input).pathname === '/rpc' &&
          body.method === 'Script.Delete' &&
          (body.params as { id?: number } | undefined)?.id === 8
        ) {
          staleDiscoveryPresent = false;
        }
        if (requestUrl(input).pathname === '/rpc' && body.method === 'Script.List') {
          return rpcResult({
            scripts: [
              {
                id: 1,
                name: 'Local Climate Link Thermostat',
                enable: true,
                running: true
              },
              ...(staleDiscoveryPresent
                ? [
                    {
                      id: 8,
                      name: 'Local Climate Link BLE Discovery',
                      enable: false,
                      running: true
                    }
                  ]
                : [])
            ]
          });
        }
        return defaultFetch(input, init);
      })
    );
    renderHardwareSetup();

    await addShellyThroughUi();

    await openShellyBleScanFromSettings();
    const dialog = await findShellyBleScanPage();
    expect(await findBleScanCandidate(dialog)).toBeInTheDocument();

    const rpcBodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]))
      .filter((body) => body.method);
    const staleStopIndex = rpcBodies.findIndex(
      (body) =>
        body.method === 'Script.Stop' &&
        (body.params as { id?: number } | undefined)?.id === 8
    );
    const staleDeleteIndex = rpcBodies.findIndex(
      (body) =>
        body.method === 'Script.Delete' &&
        (body.params as { id?: number } | undefined)?.id === 8
    );
    const createIndex = rpcBodies.findIndex((body) => body.method === 'Script.Create');

    expect(staleStopIndex).toBeGreaterThanOrEqual(0);
    expect(staleDeleteIndex).toBeGreaterThan(staleStopIndex);
    expect(createIndex).toBeGreaterThan(staleDeleteIndex);
  });

  it('cleans up Shelly BLE discovery when the user switches tabs mid-scan', async () => {
    renderHardwareSetup();

    await addShellyThroughUi();

    await openShellyBleScanFromSettings();
    const dialog = await findShellyBleScanPage();
    expect(await findBleScanCandidate(dialog)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '‹ Shelly' }));
    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));

    await waitFor(() => {
      const rpcBodies = vi
        .mocked(fetch)
        .mock.calls.map((call) => requestBody(call[1]))
        .filter((body) => body.method);
      expect(
        rpcBodies.some(
          (body) =>
            body.method === 'Script.Stop' &&
            (body.params as { id?: number } | undefined)?.id === 4
        )
      ).toBe(true);
      expect(
        rpcBodies.some(
          (body) =>
            body.method === 'Script.Delete' &&
            (body.params as { id?: number } | undefined)?.id === 4
        )
      ).toBe(true);
      expect(
        rpcBodies.some(
          (body) =>
            body.method === 'Script.Start' &&
            (body.params as { id?: number } | undefined)?.id === 1
        )
      ).toBe(true);
    });
    expect(
      screen.queryByRole('heading', { name: 'Skanuj termometry BLE' })
    ).not.toBeInTheDocument();
  });

  it('cleans up Shelly BLE discovery on pagehide', async () => {
    renderHardwareSetup();

    await addShellyThroughUi();

    await openShellyBleScanFromSettings();
    const dialog = await findShellyBleScanPage();
    expect(await findBleScanCandidate(dialog)).toBeInTheDocument();

    window.dispatchEvent(new Event('pagehide'));

    await waitFor(() => {
      const rpcBodies = vi
        .mocked(fetch)
        .mock.calls.map((call) => requestBody(call[1]))
        .filter((body) => body.method);
      expect(
        rpcBodies.some(
          (body) =>
            body.method === 'Script.Delete' &&
            (body.params as { id?: number } | undefined)?.id === 4
        )
      ).toBe(true);
      expect(
        rpcBodies.some(
          (body) =>
            body.method === 'Script.Start' &&
            (body.params as { id?: number } | undefined)?.id === 1
        )
      ).toBe(true);
    });
  });

  it('recovers Shelly BLE polling after one transient refresh failure', async () => {
    let bleScanReads = 0;
    const secondAddress = 'F7:5F:8D:0F:76:20';
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        if (url.pathname === '/script/4/ble-scan') {
          bleScanReads += 1;
          if (bleScanReads === 2) {
            return jsonResponse({ error: { code: 404, message: 'Not Found' } }, 404);
          }
          return jsonResponse({
            v: 1,
            r: true,
            sa: 1782667904992,
            so: null,
            lr: 'candidate-updated',
            c: [
              {
                a: 'A4:C1:38:4F:24:CD',
                p: 'x',
                t: 31.18,
                h: 44.06,
                r: -37,
                s: 1782667904992
              },
              ...(bleScanReads >= 3
                ? [
                    {
                      a: secondAddress,
                      p: 't',
                      t: 24.1,
                      h: 51,
                      r: -61,
                      s: 1782667908992
                    }
                  ]
                : [])
            ]
          });
        }
        return defaultFetch(input, init);
      })
    );

    renderHardwareSetup();
    await addShellyThroughUi();
    await openShellyBleScanFromSettings();

    const dialog = await findShellyBleScanPage();
    const firstAddress = await findBleScanCandidate(dialog);
    const firstItem = firstAddress.closest('article');
    expect(firstItem).not.toBeNull();
    expect(
      within(firstItem!).getByRole('button', { name: 'Już zapisany' })
    ).toBeDisabled();

    const discoveryLifecycleCount = () =>
      vi
        .mocked(fetch)
        .mock.calls.map((call) => requestBody(call[1]))
        .filter(
          (body) =>
            (body.method === 'Script.Stop' || body.method === 'Script.Start') &&
            (body.params as { id?: number } | undefined)?.id === 4
        ).length;
    const lifecycleBeforeRecovery = discoveryLifecycleCount();

    await waitFor(() => expect(bleScanReads).toBeGreaterThanOrEqual(2), {
      timeout: 7000
    });
    expect(within(dialog).queryByText(secondAddress)).not.toBeInTheDocument();

    const recoveredCandidate = await within(dialog).findByText(secondAddress, undefined, {
      timeout: 7000
    });
    const recoveredItem = recoveredCandidate.closest('article');
    expect(recoveredItem).not.toBeNull();
    expect(
      within(recoveredItem!).getByRole('button', { name: 'Zapisz termometr' })
    ).toBeEnabled();
    expect(discoveryLifecycleCount()).toBe(lifecycleBeforeRecovery);
    expect(screen.queryByText('404 Not Found')).not.toBeInTheDocument();
  }, 12_000);

  it('keeps BLE scan refresh errors out of the visible UI', async () => {
    let bleScanReads = 0;
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        if (url.pathname === '/script/4/ble-scan') {
          bleScanReads += 1;
          if (bleScanReads > 1) {
            return jsonResponse({ error: { code: 404, message: 'Not Found' } }, 404);
          }
          return jsonResponse({
            v: 1,
            r: false,
            sa: 1782667904992,
            so: 1782667934992,
            lr: 'scan-complete',
            c: [
              {
                a: 'A4:C1:38:4F:24:CD',
                p: 'x',
                t: 31.18,
                h: 44.06,
                r: -37,
                s: 1782667904992
              }
            ]
          });
        }
        return defaultFetch(input, init);
      })
    );

    renderHardwareSetup();
    await addShellyThroughUi();

    await openShellyBleScanFromSettings();
    const dialog = await findShellyBleScanPage();
    expect(await findBleScanCandidate(dialog)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Skanuj ponownie' }));

    await waitFor(() =>
      expect(within(dialog).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument()
    );
    expect(within(dialog).queryByText('404 Not Found')).not.toBeInTheDocument();
    expect(screen.queryByText('404 Not Found')).not.toBeInTheDocument();
    expect(screen.queryByText('Nie odświeżyłem wyników.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Skaner BLE chwilowo nie odpowiedział.')
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText('Nie udało się pobrać wyników.')
    ).not.toBeInTheDocument();
  });

  it('does not restart automation when the BLE scanner cannot be stopped', async () => {
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = requestBody(init);
        if (body.method === 'Script.Stop') {
          const params = body.params as { id?: number } | undefined;
          if (params?.id === 4) {
            return jsonResponse({ error: { message: 'scanner stop failed' } });
          }
        }
        return defaultFetch(input, init);
      })
    );

    renderHardwareSetup();
    await addShellyThroughUi();

    await openShellyBleScanFromSettings();
    const dialog = await findShellyBleScanPage();
    expect(await findBleScanCandidate(dialog)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '‹ Shelly' }));

    const bleStopError = await screen.findByText('Nie udało się zamknąć skanera BLE.');
    expect(bleStopError.closest('[role="status"]')).not.toBeNull();
    await waitFor(() => {
      const startAutomationCalls = vi
        .mocked(fetch)
        .mock.calls.map((call) => requestBody(call[1]))
        .filter((body) => body.method === 'Script.Start')
        .filter((body) => (body.params as { id?: number } | undefined)?.id === 1);

      expect(startAutomationCalls).toHaveLength(0);
    });
  });

  it('keeps unsaved add form values while saving rule changes', async () => {
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));
    const addDialog = await openShellyAddDialog();
    fireEvent.change(within(addDialog).getByLabelText('Nazwa gniazdka'), {
      target: { value: 'Kuchnia' }
    });
    fireEvent.change(within(addDialog).getByLabelText('Adres IP Shelly'), {
      target: { value: '192.168.0.21' }
    });
    closeCurrentAddPage();

    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    fireEvent.change(screen.getByLabelText('Włącz poniżej °C'), {
      target: { value: '18' }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));
    const reopenedAddDialog = await openShellyAddDialog();
    expect(within(reopenedAddDialog).getByLabelText('Nazwa gniazdka')).toHaveValue(
      'Kuchnia'
    );
    expect(within(reopenedAddDialog).getByLabelText('Adres IP Shelly')).toHaveValue(
      '192.168.0.21'
    );
  });

  it('saves current configuration locally across screen remounts', async () => {
    const { unmount } = renderHardwareSetup();

    await addShellyThroughUi('Salon');
    await addSensorThroughUi({ name: 'Xiaomi salon' });
    expect(window.localStorage.getItem(HARDWARE_SETUP_DRAFT_STORAGE_KEY)).toContain(
      'A4:C1:38:4F:24:CD'
    );

    unmount();
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));
    const addDialog = await openShellyAddDialog();
    expect(within(addDialog).getByLabelText('Nazwa gniazdka')).toHaveValue(
      'Shelly Plug S Gen3'
    );
    expect(within(addDialog).getByLabelText('Adres IP Shelly')).toHaveValue('');
    closeCurrentAddPage();
    expect(screen.getByText('Salon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const addSensorDialog = await openSensorAddDialog();
    expect(within(addSensorDialog).getByLabelText('Nazwa termometru')).toHaveValue('');
    expect(within(addSensorDialog).getByLabelText('MAC termometru')).toHaveValue('');
    closeCurrentAddPage();
    expect(screen.getByText('Xiaomi salon')).toBeInTheDocument();
    expect(
      within(getSavedSensorCard('Xiaomi salon')).getByText('A4:C1:38:4F:24:CD')
    ).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedBleAdvertisement } from '@lcl/ble-core';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript
} from '@lcl/script-generator';

const phoneBleScannerMock = vi.hoisted(() => ({
  failureMessage: null as string | null
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
    rule: {
      ...config.rule,
      rssiMin: -100
    }
  });
};

vi.mock('@lcl/ble-core', async () => {
  const actual = await vi.importActual('@lcl/ble-core');

  class TestCapacitorBleScanner {
    private stopped = false;

    async *startScan(): AsyncIterable<NormalizedBleAdvertisement> {
      this.stopped = false;
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
      }
    }

    async stopScan(): Promise<void> {
      this.stopped = true;
    }
  }

  return {
    ...(actual as object),
    CapacitorBleScanner: TestCapacitorBleScanner
  };
});

import {
  DEFAULT_HARDWARE_SETUP_DRAFT,
  HARDWARE_SETUP_DRAFT_STORAGE_KEY,
  resetHardwareSetupDraftStore,
  useHardwareSetupDraftStore
} from '../flows/hardware-setup/setupDraftStore.js';
import {
  cleanupStaleShellyBleDiscoveryScripts,
  fetchShellyJson,
  SHELLY_OUT_OF_MEMORY_MESSAGE
} from '../flows/hardware-setup/shellyRequests.js';
import { formatSensorId } from '../flows/hardware-setup/validation.js';
import { HardwareSetupScreen } from '../screens/hardware-setup/HardwareSetupScreen.js';

const renderHardwareSetup = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <HardwareSetupScreen />
    </QueryClientProvider>
  );
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

const openShellyAddDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));
  return screen.findByRole('dialog', { name: 'Dodaj gniazdko' });
};

const openSensorAddDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Dodaj termometr' }));
  return screen.findByRole('dialog', { name: 'Dodaj termometr' });
};

const openRuleScriptDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Pokaż skrypt' }));
  return screen.findByRole('dialog', { name: 'Podgląd Shelly Script' });
};

const openRuleAdvancedDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Zaawansowane' }));
  return screen.findByRole('dialog', { name: 'Opcje zaawansowane' });
};

const getRuleSummary = () => {
  const summary = screen.getByText('Podsumowanie reguły').closest('article');
  expect(summary).not.toBeNull();
  return summary!;
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
  fireEvent.click(within(addDialog).getByRole('button', { name: 'Sprawdź i dodaj' }));
  expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();
  expect(
    screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'http://192.168.0.20/' })
  ).toBeInTheDocument();
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
  fireEvent.change(within(addDialog).getByLabelText('Typ termometru'), {
    target: { value: profile }
  });
  fireEvent.change(within(addDialog).getByLabelText('Nazwa termometru'), {
    target: { value: name }
  });
  fireEvent.change(within(addDialog).getByLabelText('MAC termometru'), {
    target: { value: mac }
  });
  fireEvent.click(within(addDialog).getByRole('button', { name: 'Dodaj' }));
  expect(
    screen.queryByRole('dialog', { name: 'Dodaj termometr' })
  ).not.toBeInTheDocument();
};

describe('HardwareSetupScreen', () => {
  beforeEach(() => {
    resetHardwareSetupDraftStore();
    phoneBleScannerMock.failureMessage = null;
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
            q: [0, 0, 19, 20, 900, -100],
            y: ['09:31', 1782667904, 12345],
            p: [false, 0, 230.1, 0, 1234, 31.2],
            g: [
              1782667904992,
              31.18,
              44.06,
              100,
              -37,
              false,
              'ab',
              1782667768883,
              null,
              0,
              13,
              31.18,
              1.45,
              22.2,
              22.6
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
            return rpcResult({ model: 'S3PL-00112EU', gen: 3 });
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
              mem_used: 12,
              mem_free: 34
            });
          default:
            return rpcResult({});
        }
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders hardware setup as logical pages with a top menu', async () => {
    renderHardwareSetup();

    expect(screen.queryByText('MVP manual')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zestaw' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shelly' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Termometry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reguła' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Diag' })).toHaveAttribute(
      'title',
      'Diagnostyka skryptu Shelly'
    );
    expect(screen.queryByRole('button', { name: 'Skrypt' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shelly' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('region', { name: 'Gniazdka Shelly' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Gniazdka Shelly' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dodaj gniazdko' })).toHaveTextContent(
      '+ Dodaj gniazdko'
    );
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
    expect(
      within(shellyAddDialog).getByRole('button', { name: 'Skanuj sieć' })
    ).toHaveAttribute('title', 'Szukaj gniazdek Shelly w lokalnej sieci');
    expect(
      within(shellyAddDialog).getByRole('button', { name: 'Sprawdź i dodaj' })
    ).toHaveAttribute('title', 'Sprawdź adres i zapisz gniazdko w aplikacji');
    fireEvent.click(within(shellyAddDialog).getByRole('button', { name: 'Zamknij' }));

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
    expect(screen.getByRole('button', { name: 'Dodaj termometr' })).toHaveTextContent(
      '+ Dodaj termometr'
    );
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
    expect(within(sensorAddDialog).getByLabelText('Typ termometru')).toHaveValue(
      'xiaomi_lywsd03mmc_bthome_v2'
    );
    expect(
      within(sensorAddDialog).getByRole('option', {
        name: 'Xiaomi/PVVX BTHome v2'
      })
    ).toBeInTheDocument();
    expect(within(sensorAddDialog).getByRole('option', { name: 'TP357' })).toBeEnabled();
    fireEvent.change(within(sensorAddDialog).getByLabelText('Typ termometru'), {
      target: { value: 'tp357_custom_v1' }
    });
    expect(within(sensorAddDialog).getByLabelText('Typ termometru')).toHaveValue(
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
    fireEvent.click(within(sensorAddDialog).getByRole('button', { name: 'Zamknij' }));

    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    expect(screen.getByLabelText('Gniazdko Shelly')).toBeInTheDocument();
    expect(screen.getByLabelText('Termometr')).toBeInTheDocument();
    expect(
      within(getRuleSummary()).getByRole('button', { name: 'Pokaż skrypt' })
    ).toBeDisabled();
    expect(screen.queryByText('Pokaż skrypt')).not.toBeInTheDocument();
    expect(getRuleSummary()).toHaveTextContent(
      'Gdy termometr zniknie na 15 min albo Shelly uruchomi się ponownie'
    );
    expect(getRuleSummary()).toHaveTextContent(
      'Po świeżym odczycie automatyka znów zastosuje tę regułę'
    );
    expect(getRuleSummary()).not.toHaveTextContent('gniazdko przejdzie w OFF');
    expect(getRuleSummary()).not.toHaveTextContent('Termometr:');
  });

  it('keeps keyboard focus inside setup modals and restores it on close', async () => {
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const openButton = screen.getByRole('button', { name: 'Dodaj termometr' });
    openButton.focus();
    fireEvent.click(openButton);

    const dialog = await screen.findByRole('dialog', { name: 'Dodaj termometr' });
    const profileSelect = within(dialog).getByLabelText('Typ termometru');
    const closeButton = within(dialog).getByRole('button', { name: 'Zamknij' });

    await waitFor(() => expect(profileSelect).toHaveFocus());

    closeButton.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(profileSelect).toHaveFocus();

    profileSelect.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(closeButton).toHaveFocus();

    fireEvent.click(closeButton);
    await waitFor(() => expect(openButton).toHaveFocus());
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
    ).rejects.toThrow(SHELLY_OUT_OF_MEMORY_MESSAGE);
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
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Sprawdź i dodaj' }));

    expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Shelly sprawdzone' })
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('http://192.168.0.20/')).toHaveLength(1);
    expect(screen.getAllByDisplayValue('Salon').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Adres')).toBeInTheDocument();
    expect(screen.queryByText('Script ID')).not.toBeInTheDocument();
    expect(screen.queryByText('wybrane')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wybierz' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'http://192.168.0.20/' }));
    const recheckDialog = await screen.findByRole('dialog', {
      name: 'Shelly sprawdzone'
    });
    const shellyPanelLink = within(recheckDialog).getByRole('link', {
      name: 'Otwórz panel Shelly: http://192.168.0.20/'
    });
    expect(shellyPanelLink).toHaveAttribute('href', 'http://192.168.0.20/');
    expect(shellyPanelLink).toHaveAttribute('target', '_blank');
    expect(shellyPanelLink).toHaveAttribute('rel', 'noreferrer noopener');
    expect(within(recheckDialog).getByText('S3PL-00112EU, gen 3')).toBeInTheDocument();
    expect(within(recheckDialog).getByText('Scripts')).toBeInTheDocument();
    expect(within(recheckDialog).getByText('Bluetooth')).toBeInTheDocument();
    expect(within(recheckDialog).getByText('Przekaźnik')).toBeInTheDocument();

    const statusBackdrop = document.querySelector('.lcl-modal-backdrop');
    expect(statusBackdrop).not.toBeNull();
    fireEvent.click(statusBackdrop!);
    expect(recheckDialog).toBeInTheDocument();

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
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Sprawdź i dodaj' }));

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

  it('shows saved Shelly controls and sends relay ON/OFF commands', async () => {
    renderHardwareSetup();
    await addShellyThroughUi();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    expect(
      within(savedPlugList).getByRole('button', { name: 'http://192.168.0.20/' })
    ).toHaveAttribute('title', 'Sprawdź ponownie stan i kompatybilność gniazdka');
    expect(within(savedPlugList).queryByText('Przekaźnik')).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Automatyzacja')).not.toBeInTheDocument();
    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);
    const relayButton = within(actionRow).getByRole('button', { name: 'ON' });
    expect(relayButton).toHaveClass('relay-toggle--off');
    expect(relayButton).toHaveAttribute(
      'title',
      'Przekaźnik jest OFF. Kliknij ON, żeby włączyć.'
    );
    expect(
      within(actionRow)
        .getAllByRole('button')
        .map((button) => button.textContent)
        .filter(Boolean)
    ).toEqual(['ON', 'MANUAL']);
    const sideActionRow = within(actionRow).getByLabelText(/^Akcje pomocnicze /);
    expect(
      within(sideActionRow).queryByRole('button', { name: 'Odśwież' })
    ).not.toBeInTheDocument();
    expect(within(sideActionRow).getByRole('button', { name: 'Skanuj BLE' })).toHaveClass(
      'icon-action'
    );
    expect(
      within(sideActionRow).getByRole('button', { name: 'Skanuj BLE' })
    ).toHaveAttribute('title', 'Skanuj termometry BLE przez to gniazdko');
    expect(
      within(sideActionRow).getByRole('button', { name: 'Usuń gniazdko' })
    ).toHaveClass('icon-action--danger');
    expect(
      within(sideActionRow).getByRole('button', { name: 'Usuń gniazdko' })
    ).toHaveAttribute('title', 'Usuń gniazdko tylko z aplikacji');
    const controlActionRow = within(actionRow).getByLabelText(
      /^Przekaźnik i automatyzacja /
    );
    expect(within(controlActionRow).getByRole('button', { name: 'Odśwież' })).toHaveClass(
      'icon-action'
    );
    expect(
      within(controlActionRow).getByRole('button', { name: 'Odśwież' })
    ).toHaveAttribute('title', 'Odśwież stan gniazdka');
    expect(within(actionRow).getByRole('button', { name: 'MANUAL' })).toHaveClass(
      'automation-toggle--auto'
    );

    fireEvent.click(relayButton);
    await screen.findByText('Przekaźnik ON.');
    expect(within(savedPlugList).queryByText('Przekaźnik ON.')).not.toBeInTheDocument();
    const offButton = within(actionRow).getByRole('button', { name: 'OFF' });
    expect(offButton).toHaveClass('relay-toggle--on');
    expect(offButton).toHaveAttribute(
      'title',
      'Przekaźnik jest ON. Kliknij OFF, żeby wyłączyć.'
    );

    fireEvent.click(offButton);
    await screen.findByText('Przekaźnik OFF.');
    expect(within(savedPlugList).queryByText('Przekaźnik OFF.')).not.toBeInTheDocument();
    expect(within(actionRow).getByRole('button', { name: 'ON' })).toHaveClass(
      'relay-toggle--off'
    );

    const switchParams = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]))
      .filter((body) => body.method === 'Switch.Set')
      .map((body) => body.params);

    expect(switchParams).toEqual(
      expect.arrayContaining([
        { id: 0, on: true },
        { id: 0, on: false }
      ])
    );
  });

  it('does not replay Shelly control toasts after returning to the Shelly page', async () => {
    renderHardwareSetup();
    await addShellyThroughUi();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);

    fireEvent.click(within(actionRow).getByRole('button', { name: 'ON' }));
    expect(await screen.findByText('Przekaźnik ON.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zamknij: Przekaźnik ON.' }));
    await waitFor(() =>
      expect(screen.queryByText('Przekaźnik ON.')).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    expect(screen.getByRole('button', { name: 'Termometry' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));

    expect(screen.getByRole('button', { name: 'Shelly' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.queryByText('Przekaźnik ON.')).not.toBeInTheDocument();
  });

  it('switches saved Shelly automation between MANUAL and AUTO safely', async () => {
    renderHardwareSetup();
    await addShellyThroughUi();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);
    const manualButton = within(actionRow).getByRole('button', { name: 'MANUAL' });
    expect(manualButton).toHaveClass('automation-toggle--auto');

    fireEvent.click(manualButton);
    await screen.findByText('Tryb MANUAL. Przekaźnik OFF.');
    expect(
      within(savedPlugList).queryByText('Tryb MANUAL. Przekaźnik OFF.')
    ).not.toBeInTheDocument();
    const autoButton = within(actionRow).getByRole('button', { name: 'AUTO' });
    expect(autoButton).toHaveClass('automation-toggle--manual');

    fireEvent.click(autoButton);
    await screen.findByText('Tryb AUTO uruchomiony.');
    expect(
      within(savedPlugList).queryByText('Tryb AUTO uruchomiony.')
    ).not.toBeInTheDocument();

    const controlCalls = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]))
      .filter((body) =>
        ['Script.Stop', 'Script.Start', 'Switch.Set'].includes(body.method ?? '')
      );

    expect(controlCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'Script.Stop', params: { id: 1 } }),
        expect.objectContaining({
          method: 'Switch.Set',
          params: { id: 0, on: false }
        }),
        expect.objectContaining({ method: 'Script.Start', params: { id: 1 } })
      ])
    );
  });

  it('renders a saved Shelly plug in final shape and refreshes status after reload', async () => {
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
      selectedShellyId: 'http://192.168.0.20/',
      diagnosticShellyId: 'http://192.168.0.20/'
    });

    renderHardwareSetup();

    expect(screen.queryByText('nieznany')).not.toBeInTheDocument();
    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    expect(within(savedPlugList).getByText('Moc')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('Napięcie')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('Energia')).toBeInTheDocument();

    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);
    expect(within(actionRow).getByRole('button', { name: 'ON' })).toHaveClass(
      'relay-toggle--unknown'
    );
    expect(
      within(actionRow)
        .getAllByRole('button')
        .map((button) => button.textContent)
        .filter(Boolean)
    ).toEqual(['ON', 'AUTO']);
    expect(within(actionRow).getByRole('button', { name: 'AUTO' })).toHaveClass(
      'automation-toggle--unknown'
    );

    expect(await within(savedPlugList).findByText('0.0 W')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('230 V')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('1.23 kWh')).toBeInTheDocument();
  });

  it('removes a saved Shelly plug from the card action icon after confirmation', async () => {
    renderHardwareSetup();
    await addShellyThroughUi('Salon');

    fireEvent.click(screen.getByRole('button', { name: 'Usuń gniazdko' }));

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
  });

  it('keeps a saved Shelly plug when the styled removal modal is cancelled', async () => {
    renderHardwareSetup();
    await addShellyThroughUi('Salon');

    fireEvent.click(screen.getByRole('button', { name: 'Usuń gniazdko' }));
    const dialog = await screen.findByRole('dialog', { name: 'Usunąć gniazdko?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Anuluj' }));

    expect(
      screen.queryByRole('dialog', { name: 'Usunąć gniazdko?' })
    ).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Salon')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Usuń gniazdko' }));

    expect(
      await screen.findByRole('dialog', { name: 'Usunąć gniazdko?' })
    ).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('explains that rule save is required before AUTO or MANUAL controls', async () => {
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
            return rpcResult({ model: 'S3PL-00112EU', gen: 3 });
          case 'Shelly.GetStatus':
            return rpcResult({
              ble: {},
              script: {},
              'switch:0': { id: 0, output: false }
            });
          case 'Script.List':
            return rpcResult({ scripts: [] });
          case 'Switch.Set':
          case 'Script.Start':
          case 'Script.Stop':
            return rpcResult({});
          default:
            return rpcResult({});
        }
      }
    );

    renderHardwareSetup();
    await addShellyThroughUi();

    expect(screen.queryByText('brak reguły')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Najpierw zapisz regułę dla tego gniazdka.')
    ).not.toBeInTheDocument();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);
    const autoButton = within(actionRow).getByRole('button', { name: 'AUTO' });
    expect(autoButton).toHaveClass('automation-toggle--missing');

    fireEvent.click(autoButton);
    await screen.findByText('Najpierw zapisz regułę dla tego gniazdka.');
    expect(
      within(savedPlugList).queryByText('Najpierw zapisz regułę dla tego gniazdka.')
    ).not.toBeInTheDocument();

    const rpcMethods = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]).method)
      .filter(Boolean);
    expect(rpcMethods).not.toContain('Script.Start');
  });

  it('scans the local network from a modal and uses a found Shelly address', async () => {
    renderHardwareSetup();

    const addDialog = await openShellyAddDialog();
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Skanuj sieć' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skanuj sieć Shelly' });
    expect(within(dialog).getByLabelText('Od')).toHaveValue('192.168.0.1');
    expect(within(dialog).getByLabelText('Do')).toHaveValue('192.168.0.99');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));

    expect(await within(dialog).findByText('http://192.168.0.20/')).toBeInTheDocument();
    expect(within(dialog).getByText('S3PL-00112EU, gen 3')).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Dodaj' })
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Użyj adresu http://192.168.0.20/'
      })
    );

    expect(
      screen.queryByRole('dialog', { name: 'Skanuj sieć Shelly' })
    ).not.toBeInTheDocument();
    const reopenedAddDialog = await screen.findByRole('dialog', {
      name: 'Dodaj gniazdko'
    });
    expect(within(reopenedAddDialog).getByLabelText('Adres IP Shelly')).toHaveValue(
      'http://192.168.0.20/'
    );
    expect(screen.getByText('Brak dodanych gniazdek.')).toBeInTheDocument();
  });

  it('shows Shelly AP mode help as a compact tooltip', async () => {
    renderHardwareSetup();

    const addDialog = await openShellyAddDialog();
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Skanuj sieć' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skanuj sieć Shelly' });

    const tooltipButton = within(dialog).getByRole('button', {
      name: 'Informacja o trybie AP Shelly'
    });
    expect(tooltipButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(tooltipButton);
    expect(tooltipButton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(tooltipButton);
    expect(tooltipButton).toHaveAttribute('aria-expanded', 'false');

    expect(within(dialog).getByText('Shelly w trybie AP')).toBeInTheDocument();
    expect(within(dialog).getByText(/http:\/\/192\.168\.33\.1\//)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Skan zakresu: 99 adresów, max ok\. 39 s\./)
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Do'), {
      target: { value: '192.168.0.32' }
    });

    expect(
      within(dialog).getByText(/Skan zakresu: 32 adresy, max ok\. 12 s\./)
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Wpisz adres AP' })
    ).not.toBeInTheDocument();
  });

  it('uses the scan result icon to fill the Shelly address form', async () => {
    renderHardwareSetup();

    const addDialog = await openShellyAddDialog();
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Skanuj sieć' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skanuj sieć Shelly' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));
    await within(dialog).findByText('http://192.168.0.20/');

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Wpisz adres http://192.168.0.20/ do formularza'
      })
    );

    expect(
      screen.queryByRole('dialog', { name: 'Skanuj sieć Shelly' })
    ).not.toBeInTheDocument();
    const reopenedAddDialog = await screen.findByRole('dialog', {
      name: 'Dodaj gniazdko'
    });
    expect(within(reopenedAddDialog).getByLabelText('Adres IP Shelly')).toHaveValue(
      'http://192.168.0.20/'
    );
  });

  it('stops an active Shelly scan from the modal button', async () => {
    const abortableFetch = createAbortableFetchMock();
    vi.stubGlobal('fetch', abortableFetch.fetchImpl);
    renderHardwareSetup();

    const addDialog = await openShellyAddDialog();
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Skanuj sieć' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skanuj sieć Shelly' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));

    const stopButton = await within(dialog).findByRole('button', { name: 'Stop skanu' });
    fireEvent.click(stopButton);

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      within(toastRegion).getByText('Skan zatrzymany.').closest('[role="status"]')
    ).not.toBeNull();
    expect(within(dialog).queryByText('Skan zatrzymany.')).not.toBeInTheDocument();
    expect(abortableFetch.getAbortCount()).toBeGreaterThan(0);
    expect(within(dialog).getByRole('button', { name: 'Rozpocznij skan' })).toBeEnabled();
    expect(
      within(dialog).queryByRole('button', { name: 'Stop skanu' })
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText(/Nie znalazłem gniazdka Shelly/i)
    ).not.toBeInTheDocument();
  });

  it('stops an active Shelly scan when closing the modal', async () => {
    const abortableFetch = createAbortableFetchMock();
    vi.stubGlobal('fetch', abortableFetch.fetchImpl);
    renderHardwareSetup();

    const addDialog = await openShellyAddDialog();
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Skanuj sieć' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skanuj sieć Shelly' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));
    await within(dialog).findByRole('button', { name: 'Stop skanu' });

    const backdrop = document.querySelector('.lcl-modal-backdrop');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(
      screen.getByRole('dialog', { name: 'Skanuj sieć Shelly' })
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));

    await waitFor(() => expect(abortableFetch.getAbortCount()).toBeGreaterThan(0));
    expect(
      screen.queryByRole('dialog', { name: 'Skanuj sieć Shelly' })
    ).not.toBeInTheDocument();
    const reopenedAddDialog = await screen.findByRole('dialog', {
      name: 'Dodaj gniazdko'
    });
    expect(
      within(reopenedAddDialog).getByRole('button', { name: 'Skanuj sieć' })
    ).toBeEnabled();
    expect(
      within(reopenedAddDialog).getByRole('button', { name: 'Sprawdź i dodaj' })
    ).toBeEnabled();
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
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Sprawdź i dodaj' }));

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
        .getByText('Sprawdź IP w routerze albo w ustawieniach Shelly.')
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

    expect(screen.getAllByDisplayValue('Xiaomi salon').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('MAC')).toBeInTheDocument();
    expect(screen.getByText('BTHome v2')).toBeInTheDocument();
    expect(screen.queryByText('Xiaomi/PVVX BTHome v2')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Usuń termometr Xiaomi salon' })
    ).toHaveClass('icon-action--danger');
    expect(screen.queryByText('wybrane')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wybierz' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    expect(screen.getByLabelText('Gniazdko Shelly')).toHaveValue('http://192.168.0.20/');
    expect(screen.getByLabelText('Termometr')).toHaveValue('A4:C1:38:4F:24:CD');
    expect(screen.getByLabelText('Tryb reguły')).toHaveValue('heating');
    expect(screen.getByRole('button', { name: 'Zaawansowane' })).toBeEnabled();
    expect(screen.getByRole('option', { name: 'Grzanie' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Chłodzenie' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Nawilżanie' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Osuszanie' })).toBeInTheDocument();
    expect(getRuleSummary()).toHaveTextContent(
      'Gdy termometr A4:C1:38:4F:24:CD zniknie na 15 min albo Shelly http://192.168.0.20/ uruchomi się ponownie'
    );
    expect(getRuleSummary()).toHaveTextContent(
      'Po świeżym odczycie automatyka znów zastosuje tę regułę'
    );
    expect(getRuleSummary()).not.toHaveTextContent('gniazdko przejdzie w OFF');
    expect(getRuleSummary()).not.toHaveTextContent('Shelly:');
    expect(getRuleSummary()).not.toHaveTextContent('Termometr:');
    expect(getRuleSummary()).not.toHaveTextContent('RSSI:');
    const generatedScriptButton = within(getRuleSummary()).getByRole('button', {
      name: 'Pokaż skrypt'
    });
    expect(generatedScriptButton).toHaveClass('icon-action');
    expect(generatedScriptButton).toHaveAttribute(
      'title',
      'Pokaż wygenerowany Shelly Script'
    );
    expect(screen.queryByText('Pokaż skrypt')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Podgląd Shelly Script' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zaawansowane' })).toHaveAttribute(
      'title',
      'Zmień RSSI, timeout, VPD i limity bezpieczeństwa'
    );
    expect(screen.getByRole('button', { name: 'Skrypt Shelly' })).toHaveAttribute(
      'title',
      'Odczytaj albo usuń skrypt zapisany w Shelly'
    );
    expect(screen.getByRole('button', { name: 'Wyślij' })).toHaveAttribute(
      'title',
      'Wyślij aktualną regułę do Shelly'
    );
    expect(
      screen.getByRole('button', { name: 'Wyślij' }).closest('.action-row')
    ).toHaveClass('rule-action-row');
    const scriptDialog = await openRuleScriptDialog();
    expect(scriptDialog).toHaveClass('lcl-modal--workspace');
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

    fireEvent.click(
      within(savedSensorList).getByRole('button', {
        name: 'Usuń termometr Xiaomi salon'
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
    expect(screen.getByDisplayValue('Xiaomi salon')).toBeInTheDocument();

    fireEvent.click(
      within(savedSensorList).getByRole('button', {
        name: 'Usuń termometr Xiaomi salon'
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

    expect(screen.getByText('Moc')).toBeInTheDocument();
    expect(screen.getByText('0.0 W')).toBeInTheDocument();
    expect(screen.getByText('Napięcie')).toBeInTheDocument();
    expect(screen.getByText('230 V')).toBeInTheDocument();
    expect(screen.getByText('Energia')).toBeInTheDocument();
    expect(screen.getByText('1.23 kWh')).toBeInTheDocument();
    expect(screen.getByText('Czas')).toBeInTheDocument();
    const clockButton = screen.getByRole('button', { name: '09:31' });
    expect(clockButton).toHaveAttribute('title', 'Pokaż status czasu Shelly');

    fireEvent.click(clockButton);

    const clockDialog = await screen.findByRole('dialog', { name: 'Czas Shelly' });
    expect(within(clockDialog).getByText('Salon')).toBeInTheDocument();
    expect(within(clockDialog).getByText('09:31')).toBeInTheDocument();
    expect(within(clockDialog).getByText('zsynchronizowany')).toBeInTheDocument();
    expect(within(clockDialog).getByText('3 h 25 min')).toBeInTheDocument();
    expect(within(clockDialog).getByRole('button', { name: 'Odśwież' })).toHaveAttribute(
      'title',
      'Odśwież czas i status gniazdka'
    );
    expect(
      within(clockDialog).queryByRole('button', { name: 'Ustaw z telefonu' })
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

  it('opens a Shelly script management modal for fetch and delete', async () => {
    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    await addSensorThroughUi({ name: 'Xiaomi salon' });
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skrypt Shelly' }));

    const dialog = await screen.findByRole('dialog', { name: 'Skrypt Shelly' });
    expect(dialog).toHaveClass('lcl-modal--diagnostic');
    expect(dialog).not.toHaveClass('lcl-modal--workspace');
    expect(within(dialog).getByRole('button', { name: 'Usuń z Shelly' })).toHaveAttribute(
      'title',
      'Usuń skrypt Local Climate Link z Shelly'
    );
    expect(await within(dialog).findByText('id 1, działa')).toBeInTheDocument();
    expect(within(dialog).getByText('zgodne z formularzem')).toBeInTheDocument();
    expect(within(dialog).getByText('Xiaomi/PVVX BTHome v2')).toBeInTheDocument();
    expect(within(dialog).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
    expect(within(dialog).getByText('Grzanie')).toBeInTheDocument();
    expect(
      within(dialog).getByText('ON poniżej 19.0°C, OFF powyżej 20.0°C')
    ).toBeInTheDocument();
    expect(within(dialog).getByText('min. -100 dBm')).toBeInTheDocument();
    const savedScriptPreview = within(dialog).getByLabelText('Skrypt zapisany w Shelly');
    expect(savedScriptPreview).toHaveClass('lcl-script-preview--tall');
    expect(savedScriptPreview).toHaveTextContent('m: xiaomi-bthome-minimal');

    const scriptManagerBackdrop = document.querySelector('.lcl-modal-backdrop');
    expect(scriptManagerBackdrop).not.toBeNull();
    fireEvent.click(scriptManagerBackdrop!);
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Usuń z Shelly' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Potwierdź usuń' }));

    expect(await screen.findByText('Usunięto skrypt Shelly.')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(dialog).getByText('brak')).toBeInTheDocument();
      expect(
        within(dialog).queryByLabelText('Skrypt zapisany w Shelly')
      ).not.toBeInTheDocument();
    });
    expect(dialog).toHaveClass('lcl-modal--diagnostic');
    expect(dialog).not.toHaveClass('lcl-modal--workspace');
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

    fireEvent.click(screen.getByRole('button', { name: 'Skrypt Shelly' }));
    const scriptDialog = await screen.findByRole('dialog', { name: 'Skrypt Shelly' });
    expect(await within(scriptDialog).findByText('id 1, działa')).toBeInTheDocument();
    fireEvent.click(within(scriptDialog).getByRole('button', { name: 'Usuń z Shelly' }));
    fireEvent.click(within(scriptDialog).getByRole('button', { name: 'Potwierdź usuń' }));

    expect(await screen.findByText('Usunięto skrypt Shelly.')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Zamknij: Usunięto skrypt Shelly.' })
    );
    await waitFor(() =>
      expect(screen.queryByText('Usunięto skrypt Shelly.')).not.toBeInTheDocument()
    );
    fireEvent.click(within(scriptDialog).getByRole('button', { name: 'Zamknij' }));

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

  it('sets relay OFF before stopping a script during delete even when Script.Stop fails', async () => {
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = requestBody(init);
        if (body.method === 'Script.Stop') {
          const params = body.params as { id?: number } | undefined;
          if (params?.id === 1) {
            return jsonResponse({ error: { message: 'stop failed' } });
          }
        }
        return defaultFetch(input, init);
      })
    );

    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);
    fireEvent.click(within(actionRow).getByRole('button', { name: 'ON' }));
    await screen.findByText('Przekaźnik ON.');

    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skrypt Shelly' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skrypt Shelly' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usuń z Shelly' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Potwierdź usuń' }));

    expect(await screen.findByText('Usunięto skrypt Shelly.')).toBeInTheDocument();

    const rpcBodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]))
      .filter((body) => body.method);
    const deleteIndex = rpcBodies.findIndex(
      (body) =>
        body.method === 'Script.Delete' &&
        (body.params as { id?: number } | undefined)?.id === 1
    );
    let stopIndex = -1;
    for (let index = deleteIndex - 1; index >= 0; index -= 1) {
      const body = rpcBodies[index];
      if (
        body?.method === 'Script.Stop' &&
        (body.params as { id?: number } | undefined)?.id === 1
      ) {
        stopIndex = index;
        break;
      }
    }

    let offIndex = -1;
    for (let index = stopIndex - 1; index >= 0; index -= 1) {
      const body = rpcBodies[index];
      if (
        body?.method === 'Switch.Set' &&
        (body.params as { on?: boolean } | undefined)?.on === false
      ) {
        offIndex = index;
        break;
      }
    }

    expect(offIndex).toBeGreaterThanOrEqual(0);
    expect(stopIndex).toBeGreaterThan(offIndex);
    expect(deleteIndex).toBeGreaterThan(stopIndex);
  });

  it('reports delete failure separately from confirmed relay OFF safety', async () => {
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = requestBody(init);
        if (body.method === 'Script.Delete') {
          const params = body.params as { id?: number } | undefined;
          if (params?.id === 1) {
            return jsonResponse({ error: { message: 'delete failed' } });
          }
        }
        return defaultFetch(input, init);
      })
    );

    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skrypt Shelly' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skrypt Shelly' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usuń z Shelly' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Potwierdź usuń' }));

    expect(await screen.findByText('Nie udało się usunąć skryptu.')).toBeInTheDocument();
    expect(
      await screen.findByText(/Przekaźnik OFF potwierdzony, ale nie udało się usunąć/)
    ).toBeInTheDocument();
    expect(screen.queryByText('Usunięto skrypt Shelly.')).not.toBeInTheDocument();
  });

  it('adds a TP357 thermometer and previews the minimal TP357 Shelly parser', async () => {
    renderHardwareSetup();

    await addSensorThroughUi({
      mac: 'C2:C0:00:30:64:01',
      name: 'TP357 salon',
      profile: 'tp357_custom_v1'
    });

    expect(screen.getAllByDisplayValue('TP357 salon').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('TP357').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));

    expect(screen.getByLabelText('Termometr')).toHaveValue('C2:C0:00:30:64:01');
    expect(getRuleSummary()).toHaveTextContent(
      'Gdy termometr C2:C0:00:30:64:01 zniknie na 15 min'
    );
    expect(getRuleSummary()).not.toHaveTextContent('TP357, C2:C0:00:30:64:01');
    const scriptDialog = await openRuleScriptDialog();
    expect(within(scriptDialog).getByLabelText('Wygenerowany skrypt')).toHaveTextContent(
      'm: tp357-minimal'
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

  it('opens a dedicated phone BLE scan modal and keeps result order stable', async () => {
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const addDialog = await openSensorAddDialog();
    expect(within(addDialog).getByRole('button', { name: 'Skanuj BLE' })).toHaveAttribute(
      'title',
      'Skanuj termometry BLE telefonem'
    );
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Skanuj BLE' }));

    expect(
      screen.queryByRole('dialog', { name: 'Dodaj termometr' })
    ).not.toBeInTheDocument();
    const dialog = await screen.findByRole('dialog', { name: 'Skanuj BLE telefonem' });
    const xiaomiAddress = await findBleScanCandidate(dialog);
    const xiaomiItem = xiaomiAddress.closest('article');
    expect(xiaomiItem).not.toBeNull();
    expect(
      within(xiaomiItem!).getByRole('button', { name: 'Zapisz termometr' })
    ).toHaveAttribute('title', 'Zapisz ten termometr w aplikacji');
    expect(within(xiaomiItem!).getByText('BTHome v2')).toBeInTheDocument();
    expect(within(xiaomiItem!).getByText('21.3°C')).toBeInTheDocument();
    expect(within(xiaomiItem!).getByText('45.7%')).toBeInTheDocument();
    expect(within(xiaomiItem!).getByText('-72 dBm')).toBeInTheDocument();

    await waitFor(() => expect(within(dialog).getAllByRole('article')).toHaveLength(2));
    const candidateItems = within(dialog).getAllByRole('article');
    expect(within(candidateItems[0]!).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
    expect(within(candidateItems[1]!).getByText('F7:5F:8D:0F:76:20')).toBeInTheDocument();
    expect(within(candidateItems[1]!).getByText('-70 dBm')).toBeInTheDocument();

    const phoneBleBackdrop = document.querySelector('.lcl-modal-backdrop');
    expect(phoneBleBackdrop).not.toBeNull();
    fireEvent.click(phoneBleBackdrop!);
    expect(dialog).toBeInTheDocument();

    fireEvent.click(
      within(xiaomiItem!).getByRole('button', { name: 'Zapisz termometr' })
    );

    expect(
      screen.queryByRole('dialog', { name: 'Skanuj BLE telefonem' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Termometr 24:CD').length).toBeGreaterThanOrEqual(
      1
    );
  });

  it('shows phone BLE scan startup errors as toast feedback', async () => {
    phoneBleScannerMock.failureMessage = 'Phone BLE scan is unavailable in this runtime.';
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const addDialog = await openSensorAddDialog();
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Skanuj BLE' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skanuj BLE telefonem' });

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
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
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
      fireEvent.change(screen.getByLabelText('Tryb reguły'), {
        target: { value: 'humidifying' }
      });

      expect(screen.getByLabelText('Włącz poniżej %')).toHaveValue(45);
      expect(screen.getByLabelText('Wyłącz powyżej %')).toHaveValue(55);
      expect(getRuleSummary()).toHaveTextContent('Nawilżanie włączy się poniżej 45.0%');
      let scriptDialog = await openRuleScriptDialog();
      expect(
        within(scriptDialog).getByLabelText('Wygenerowany skrypt')
      ).toHaveTextContent('"m":1');
      fireEvent.click(within(scriptDialog).getByRole('button', { name: 'Zamknij' }));

      fireEvent.change(screen.getByLabelText('Tryb reguły'), {
        target: { value: 'dehumidifying' }
      });

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

      let advancedDialog = await openRuleAdvancedDialog();
      expect(
        within(advancedDialog).getByRole('button', { name: 'Domyślne' })
      ).toHaveAttribute('title', 'Przywróć domyślne opcje zaawansowane');
      expect(
        within(advancedDialog).getByRole('button', { name: 'Zastosuj' })
      ).toHaveAttribute('title', 'Zastosuj opcje zaawansowane do tej reguły');
      expect(within(advancedDialog).getByLabelText('VPD assist')).not.toBeChecked();
      expect(
        within(advancedDialog).getByText('OFF, potem AUTO po pierwszym odczycie')
      ).toBeInTheDocument();
      fireEvent.click(within(advancedDialog).getByLabelText('VPD assist'));
      fireEvent.change(within(advancedDialog).getByLabelText(/Docelowe VPD kPa/), {
        target: { value: '1.25' }
      });
      fireEvent.change(within(advancedDialog).getByLabelText('Minimalny RSSI dBm'), {
        target: { value: '-80' }
      });
      fireEvent.change(within(advancedDialog).getByLabelText('Brak odczytu przez min'), {
        target: { value: '10' }
      });
      fireEvent.change(within(advancedDialog).getByLabelText('Maksymalny czas pracy h'), {
        target: { value: '3' }
      });
      fireEvent.click(within(advancedDialog).getByRole('button', { name: 'Zastosuj' }));
      expect(getRuleSummary()).toHaveTextContent(
        'Gdy termometr A4:C1:38:4F:24:CD zniknie na 10 min albo Shelly http://192.168.0.20/ uruchomi się ponownie'
      );
      expect(getRuleSummary()).toHaveTextContent('Maksymalny czas pracy: 3 h');
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
      ).toHaveTextContent('"x":10800000');
      expect(
        within(scriptDialog).getByLabelText('Wygenerowany skrypt')
      ).toHaveTextContent('function sv(t)');
      fireEvent.click(within(scriptDialog).getByRole('button', { name: 'Zamknij' }));

      advancedDialog = await openRuleAdvancedDialog();
      fireEvent.change(within(advancedDialog).getByLabelText(/Docelowe VPD kPa/), {
        target: { value: '0' }
      });
      expect(
        within(advancedDialog).getByRole('button', { name: 'Zastosuj' })
      ).toBeDisabled();
      expect(
        within(advancedDialog).getByText('Zakres: 0.1 do 5 kPa.')
      ).toBeInTheDocument();
      fireEvent.change(within(advancedDialog).getByLabelText(/Docelowe VPD kPa/), {
        target: { value: '1.25' }
      });
      fireEvent.click(within(advancedDialog).getByRole('button', { name: 'Zastosuj' }));

      scriptDialog = await openRuleScriptDialog();
      fireEvent.click(
        within(scriptDialog).getByRole('button', { name: 'Kopiuj skrypt' })
      );

      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(
          expect.stringContaining('m: xiaomi-bthome-minimal')
        )
      );
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"vp":1.25'));
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"r":-80'));
      expect(await screen.findByText('Skopiowano skrypt.')).toBeInTheDocument();
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, 'clipboard', originalClipboard);
      } else {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    }
  });

  it('runs a Shelly-side BLE scanner from a saved plug and adds a found thermometer', async () => {
    renderHardwareSetup();

    await addShellyThroughUi();

    fireEvent.click(screen.getByRole('button', { name: 'Skanuj BLE' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Skanuj termometry BLE'
    });
    expect(
      within(dialog).getByRole('button', { name: 'Informacja o skanowaniu BLE' })
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('tooltip')).toHaveTextContent(
      'Shelly uruchomi osobny skrypt skanera BLE. Przekaźnik zostanie ustawiony na OFF, a po zakończeniu skanu wznowię automatyzację, jeśli była uruchomiona.'
    );
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

    const shellyBleBackdrop = document.querySelector('.lcl-modal-backdrop');
    expect(shellyBleBackdrop).not.toBeNull();
    fireEvent.click(shellyBleBackdrop!);
    expect(dialog).toBeInTheDocument();

    expect(await findBleScanCandidate(dialog)).toBeInTheDocument();
    expect(within(dialog).getByText('31.2°C')).toBeInTheDocument();
    expect(within(dialog).getByText('-37 dBm')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Zapisz termometr' }));

    expect(
      screen.getByRole('dialog', { name: 'Skanuj termometry BLE' })
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Już zapisany' })).toBeDisabled();
    expect(await screen.findByText('Zapisano termometr.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    expect(screen.getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();

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

    fireEvent.click(screen.getByRole('button', { name: 'Skanuj BLE' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Skanuj termometry BLE'
    });
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

    fireEvent.click(screen.getByRole('button', { name: 'Skanuj BLE' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Skanuj termometry BLE'
    });
    expect(await findBleScanCandidate(dialog)).toBeInTheDocument();

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
      screen.queryByRole('dialog', { name: 'Skanuj termometry BLE' })
    ).not.toBeInTheDocument();
  });

  it('cleans up Shelly BLE discovery on pagehide', async () => {
    renderHardwareSetup();

    await addShellyThroughUi();

    fireEvent.click(screen.getByRole('button', { name: 'Skanuj BLE' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Skanuj termometry BLE'
    });
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

    fireEvent.click(screen.getByRole('button', { name: 'Skanuj BLE' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Skanuj termometry BLE'
    });
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

    fireEvent.click(screen.getByRole('button', { name: 'Skanuj BLE' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Skanuj termometry BLE'
    });
    expect(await findBleScanCandidate(dialog)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));

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
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Zamknij' }));

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
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Zamknij' }));
    expect(screen.getAllByDisplayValue('Salon').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const addSensorDialog = await openSensorAddDialog();
    expect(within(addSensorDialog).getByLabelText('Nazwa termometru')).toHaveValue('');
    expect(within(addSensorDialog).getByLabelText('MAC termometru')).toHaveValue('');
    fireEvent.click(within(addSensorDialog).getByRole('button', { name: 'Zamknij' }));
    expect(screen.getAllByDisplayValue('Xiaomi salon').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
  });

  it('loads generated Shelly script diagnostics and displays humidity readings', async () => {
    renderHardwareSetup();

    await addShellyThroughUi('Salon');
    await addSensorThroughUi({ name: 'Xiaomi salon' });

    fireEvent.click(screen.getByRole('button', { name: 'Diag' }));
    expect(screen.getByLabelText('Gniazdko Shelly')).toHaveValue('http://192.168.0.20/');
    expect(screen.queryByLabelText('Termometr')).not.toBeInTheDocument();
    expect(screen.queryByText('Numer skryptu Shelly')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Odśwież diagnostykę' })).toHaveAttribute(
      'title',
      'Pobierz aktualny stan skryptu i przekaźnika z Shelly'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Odśwież diagnostykę' }));

    await waitFor(() =>
      expect(screen.getAllByText('31.2°C').length).toBeGreaterThanOrEqual(2)
    );
    await waitFor(() => expect(screen.getAllByText('Salon')).toHaveLength(2));
    expect(screen.getByText('Xiaomi/PVVX BTHome')).toBeInTheDocument();
    expect(screen.getByText('Skrypt')).toBeInTheDocument();
    expect(screen.getByText('działa')).toBeInTheDocument();
    expect(screen.getByText('Hash konfiguracji')).toBeInTheDocument();
    expect(screen.getByText('lcl-12345678')).toBeInTheDocument();
    expect(screen.getByText('Przekaźnik Shelly')).toBeInTheDocument();
    expect(screen.getByText('Moc')).toBeInTheDocument();
    expect(screen.getByText('Napięcie')).toBeInTheDocument();
    expect(screen.getByText('Prąd')).toBeInTheDocument();
    expect(screen.getByText('0.00 A')).toBeInTheDocument();
    expect(screen.getByText('Energia')).toBeInTheDocument();
    expect(screen.getByText('1.23 kWh')).toBeInTheDocument();
    expect(screen.getByText('Temp. gniazdka')).toBeInTheDocument();
    expect(screen.getByText('Czas Shelly')).toBeInTheDocument();
    expect(screen.getByText('09:31')).toBeInTheDocument();
    expect(screen.getByText('Zegar')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('44.1%')).toBeInTheDocument();
    expect(screen.getByText('1.45 kPa')).toBeInTheDocument();
    expect(screen.getByText('22.2°C')).toBeInTheDocument();
    expect(screen.getByText('22.6°C')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('-37 dBm')).toBeInTheDocument();
    expect(screen.getByText('Powyżej progu')).toBeInTheDocument();
    expect(screen.getByText('Przekaźnik reguły')).toBeInTheDocument();
    expect(screen.getAllByText('OFF').length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    {
      label: '404',
      response: () => new Response('missing', { status: 404, statusText: 'Not Found' }),
      hiddenText: /404|Not Found/
    },
    {
      label: '500',
      response: () => new Response('broken', { status: 500, statusText: 'Server Error' }),
      hiddenText: /500|Server Error/
    },
    {
      label: 'malformed JSON',
      response: () =>
        new Response('{', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }),
      hiddenText: /JSON|Unexpected/
    },
    {
      label: 'schema mismatch',
      response: () => jsonResponse({ version: 1, diagnostics: { relayState: false } }),
      hiddenText: /Expected|required|lastSeen/
    },
    {
      label: 'timeout',
      response: () => Promise.reject(new DOMException('Aborted', 'AbortError')),
      hiddenText: /Abort|timeout/i
    }
  ])(
    'shows safe diagnostics load errors for $label',
    async ({ response, hiddenText }) => {
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.pathname === '/script/99/diag') {
          return response();
        }
        return rpcResult({});
      });

      useHardwareSetupDraftStore.setState({
        ...DEFAULT_HARDWARE_SETUP_DRAFT,
        shellyDevices: [
          {
            id: 'http://192.168.0.20/',
            name: 'Salon',
            baseUrl: 'http://192.168.0.20/',
            scriptIdInput: '99'
          }
        ],
        selectedShellyId: 'http://192.168.0.20/',
        diagnosticShellyId: 'http://192.168.0.20/'
      });

      renderHardwareSetup();

      fireEvent.click(screen.getByRole('button', { name: 'Diag' }));
      fireEvent.click(screen.getByRole('button', { name: 'Odśwież diagnostykę' }));

      const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
      expect(within(toastRegion).getByRole('status')).toHaveTextContent(
        'Nie udało się odczytać diagnostyki ze skryptu Shelly.'
      );
      expect(within(toastRegion).getByRole('status')).toHaveTextContent(
        'Sprawdź, czy na wybranym gniazdku jest skrypt Local Climate Link.'
      );
      expect(within(toastRegion).getByRole('status')).not.toHaveTextContent(hiddenText);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    }
  );

  it('shows Shelly script out_of_memory as the diagnostics failure reason', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init) => {
      const url = requestUrl(input);
      if (url.pathname === '/script/99/diag') {
        return new Response('missing', { status: 404, statusText: 'Not Found' });
      }
      const body = requestBody(init);
      if (body.method === 'Script.GetStatus') {
        return rpcResult({
          id: 99,
          running: false,
          mem_free: 7000,
          errors: ['out_of_memory']
        });
      }
      return rpcResult({});
    });

    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      shellyDevices: [
        {
          id: 'http://192.168.0.20/',
          name: 'Salon',
          baseUrl: 'http://192.168.0.20/',
          scriptIdInput: '99'
        }
      ],
      selectedShellyId: 'http://192.168.0.20/',
      diagnosticShellyId: 'http://192.168.0.20/'
    });

    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Diag' }));
    fireEvent.click(screen.getByRole('button', { name: 'Odśwież diagnostykę' }));

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(within(toastRegion).getByRole('status')).toHaveTextContent(
      'Skrypt Local Climate Link nie działa: Shelly zgłasza out_of_memory.'
    );
    expect(within(toastRegion).getByRole('status')).toHaveTextContent(
      'Wyłącz Matter w Shelly, zrestartuj gniazdko i wyślij regułę ponownie.'
    );
  });
});

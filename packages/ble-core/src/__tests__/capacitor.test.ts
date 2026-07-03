import type { BleClientInterface, ScanResult } from '@capacitor-community/bluetooth-le';
import { CapacitorBleScanner, normalizeCapacitorScanResult } from '../index.js';

const dataView = (bytes: number[]): DataView =>
  new DataView(new Uint8Array(bytes).buffer);

const createScanResult = (patch: Partial<ScanResult> = {}): ScanResult => ({
  device: { deviceId: 'A4:C1:38:4F:24:CD', name: 'LYWSD03MMC' },
  localName: 'LYWSD03MMC BTHome',
  rssi: -58,
  uuids: ['0000fcd2-0000-1000-8000-00805f9b34fb'],
  serviceData: {
    '0000fcd2-0000-1000-8000-00805f9b34fb': dataView([0x40, 0x02, 0x56, 0x08])
  },
  manufacturerData: {
    c0c2: dataView([0x00, 0x30, 0x64, 0x01])
  },
  rawAdvertisement: dataView([0x02, 0x01, 0x06]),
  ...patch
});

describe('CapacitorBleScanner', () => {
  it('normalizes Capacitor scan results for existing parsers', () => {
    const advertisement = normalizeCapacitorScanResult(createScanResult());

    expect(advertisement.id).toBe('A4:C1:38:4F:24:CD');
    expect(advertisement.name).toBe('LYWSD03MMC BTHome');
    expect(advertisement.rssi).toBe(-58);
    expect(advertisement.serviceUuids).toContain('0000fcd2-0000-1000-8000-00805f9b34fb');
    expect(advertisement.serviceData['0000fcd2-0000-1000-8000-00805f9b34fb']).toEqual(
      new Uint8Array([0x40, 0x02, 0x56, 0x08])
    );
    expect(advertisement.manufacturerData.c0c2).toEqual(
      new Uint8Array([0x00, 0x30, 0x64, 0x01])
    );
    expect(advertisement.rawAdvertisement).toEqual(new Uint8Array([0x02, 0x01, 0x06]));
  });

  it('uses an explicit native platform hint when normalizing scan results', () => {
    const scanResult = createScanResult();
    delete scanResult.rawAdvertisement;
    const advertisement = normalizeCapacitorScanResult(scanResult, { platform: 'ios' });

    expect(advertisement.platform).toBe('ios');
  });

  it('yields scan results and filters weak RSSI values', async () => {
    const scanState: { callback: ((result: ScanResult) => void) | null } = {
      callback: null
    };
    const client: BleClientInterface = {
      initialize: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockResolvedValue({ value: true }),
      requestEnable: vi.fn().mockResolvedValue(undefined),
      requestLEScan: vi.fn(async (_options, callback) => {
        scanState.callback = callback;
      }),
      stopLEScan: vi.fn().mockResolvedValue(undefined)
    } as unknown as BleClientInterface;
    const scanner = new CapacitorBleScanner({ clientLoader: async () => client });
    const iterator = scanner.startScan({ rssiMin: -70 })[Symbol.asyncIterator]();

    const firstResult = iterator.next();
    await vi.waitFor(() => expect(scanState.callback).not.toBeNull());
    scanState.callback?.(createScanResult({ rssi: -80 }));
    scanState.callback?.(createScanResult({ rssi: -60 }));

    await expect(firstResult).resolves.toMatchObject({
      done: false,
      value: expect.objectContaining({ rssi: -60 })
    });

    await scanner.stopScan();
    await expect(iterator.next()).resolves.toMatchObject({ done: true });
    expect(client.stopLEScan).toHaveBeenCalledTimes(1);
  });

  it('requests enabling Bluetooth when Capacitor reports it disabled', async () => {
    let enabled = false;
    const client: BleClientInterface = {
      initialize: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn(async () => ({ value: enabled })),
      requestEnable: vi.fn(async () => {
        enabled = true;
      }),
      requestLEScan: vi.fn(async () => undefined),
      stopLEScan: vi.fn().mockResolvedValue(undefined)
    } as unknown as BleClientInterface;
    const scanner = new CapacitorBleScanner({ clientLoader: async () => client });
    const iterator = scanner.startScan({ timeoutMs: 1 })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({ done: true });
    expect(client.requestEnable).toHaveBeenCalledTimes(1);
    expect(client.requestLEScan).toHaveBeenCalledTimes(1);
  });

  it('reports permission denial before starting a scan', async () => {
    const client: BleClientInterface = {
      initialize: vi.fn().mockRejectedValue(new Error('Permission denied.')),
      isEnabled: vi.fn().mockResolvedValue({ value: true }),
      requestEnable: vi.fn().mockResolvedValue(undefined),
      requestLEScan: vi.fn(async () => undefined),
      stopLEScan: vi.fn().mockResolvedValue(undefined)
    } as unknown as BleClientInterface;
    const scanner = new CapacitorBleScanner({ clientLoader: async () => client });
    const iterator = scanner.startScan({ timeoutMs: 1 })[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toMatchObject({
      kind: 'permission-denied',
      message: 'Bluetooth scan permission was denied.',
      retryable: false
    });
    expect(client.requestLEScan).not.toHaveBeenCalled();
  });

  it('blocks Android scans when location services are disabled', async () => {
    const client: BleClientInterface = {
      initialize: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockResolvedValue({ value: true }),
      isLocationEnabled: vi.fn().mockResolvedValue(false),
      requestEnable: vi.fn().mockResolvedValue(undefined),
      requestLEScan: vi.fn(async () => undefined),
      stopLEScan: vi.fn().mockResolvedValue(undefined)
    } as unknown as BleClientInterface;
    const scanner = new CapacitorBleScanner({ clientLoader: async () => client });
    const iterator = scanner.startScan({ timeoutMs: 1 })[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toMatchObject({
      kind: 'permission-denied',
      message: 'Android Location services are off.',
      retryable: true
    });
    expect(client.requestLEScan).not.toHaveBeenCalled();
  });
});

import {
  ScanMode,
  type BleClientInterface,
  type RequestBleDeviceOptions,
  type ScanResult
} from '@capacitor-community/bluetooth-le';
import type {
  BleCoreError,
  BleScanner,
  NormalizedBleAdvertisement,
  ScanOptions
} from '../model.js';

type BleClientLoader = () => Promise<BleClientInterface>;
type BooleanResultLike = boolean | { value: boolean };
type ScanPlatform = NormalizedBleAdvertisement['platform'];

export interface CapacitorBleScannerOptions {
  clientLoader?: () => Promise<BleClientInterface>;
  platform?: ScanPlatform | string;
}

export interface NormalizeCapacitorScanOptions {
  platform?: ScanPlatform | string;
}

const createError = (
  kind: BleCoreError['kind'],
  message: string,
  retryable = true
): BleCoreError => ({ kind, message, retryable });

const loadBleClient: BleClientLoader = async () => {
  const { BleClient } = await import('@capacitor-community/bluetooth-le');
  return BleClient;
};

const booleanValue = (result: BooleanResultLike): boolean =>
  typeof result === 'boolean' ? result : result.value;

const formatBleStartError = (error: unknown): string => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
        ? error.message
        : String(error);

  if (
    /Web Bluetooth API not available|requestLEScan|bluetooth.*not.*available/i.test(
      message
    )
  ) {
    return 'Phone BLE scan is unavailable in this runtime.';
  }

  return message || 'BLE scan failed to start.';
};

const bytesFromDataView = (value: DataView | undefined): Uint8Array | undefined =>
  value
    ? new Uint8Array(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    : undefined;

const mapDataViews = (
  values: Record<string, DataView> | undefined
): Record<string, Uint8Array> =>
  Object.fromEntries(
    Object.entries(values ?? {}).flatMap(([key, value]) => {
      const bytes = bytesFromDataView(value);
      return bytes ? [[key, bytes]] : [];
    })
  );

const normalizeScanPlatform = (
  platform: ScanPlatform | string | undefined,
  rawAdvertisement?: Uint8Array
): ScanPlatform => {
  if (
    platform === 'android' ||
    platform === 'ios' ||
    platform === 'web' ||
    platform === 'demo'
  ) {
    return platform;
  }

  return rawAdvertisement ? 'android' : 'web';
};

export const normalizeCapacitorScanResult = (
  result: ScanResult,
  options: NormalizeCapacitorScanOptions = {}
): NormalizedBleAdvertisement => {
  const rawAdvertisement = bytesFromDataView(result.rawAdvertisement);
  const serviceUuids = Array.from(
    new Set([...(result.uuids ?? []), ...Object.keys(result.serviceData ?? {})])
  );

  return {
    id: result.device.deviceId,
    serviceUuids,
    serviceData: mapDataViews(result.serviceData),
    manufacturerData: mapDataViews(result.manufacturerData),
    seenAtMs: Date.now(),
    platform: normalizeScanPlatform(options.platform, rawAdvertisement),
    ...((result.localName ?? result.device.name)
      ? { name: result.localName ?? result.device.name }
      : {}),
    ...(typeof result.rssi === 'number' ? { rssi: result.rssi } : {}),
    ...(rawAdvertisement ? { rawAdvertisement } : {})
  };
};

export class CapacitorBleScanner implements BleScanner {
  private activeStop: (() => Promise<void>) | null = null;
  private readonly clientLoader: BleClientLoader;
  private readonly platform: ScanPlatform;

  constructor(options: CapacitorBleScannerOptions = {}) {
    this.clientLoader = options.clientLoader ?? loadBleClient;
    this.platform = normalizeScanPlatform(options.platform);
  }

  async *startScan(options: ScanOptions = {}): AsyncIterable<NormalizedBleAdvertisement> {
    const client = await this.clientLoader();
    const queue: NormalizedBleAdvertisement[] = [];
    let stopped = false;
    let notify: (() => void) | null = null;
    let scanStarted = false;

    const wake = () => {
      notify?.();
      notify = null;
    };
    const stop = async () => {
      stopped = true;
      if (this.activeStop === stop) {
        this.activeStop = null;
      }
      if (scanStarted) {
        await client.stopLEScan();
        scanStarted = false;
      }
      wake();
    };

    this.activeStop = stop;
    const timeoutId =
      options.timeoutMs && options.timeoutMs > 0
        ? setTimeout(() => {
            void stop();
          }, options.timeoutMs)
        : null;

    try {
      await client.initialize();
      if (!booleanValue(await client.isEnabled())) {
        await client.requestEnable();
      }
      if (!booleanValue(await client.isEnabled())) {
        throw createError('ble-unavailable', 'Bluetooth is disabled.', true);
      }

      const requestOptions: RequestBleDeviceOptions = {
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      };

      await client.requestLEScan(requestOptions, (result) => {
        const advertisement = normalizeCapacitorScanResult(result, {
          platform: this.platform
        });
        if (
          typeof options.rssiMin === 'number' &&
          typeof advertisement.rssi === 'number' &&
          advertisement.rssi < options.rssiMin
        ) {
          return;
        }
        queue.push(advertisement);
        wake();
      });
      scanStarted = true;

      while (!stopped || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            notify = resolve;
          });
        }

        while (queue.length > 0) {
          const advertisement = queue.shift();
          if (advertisement) {
            yield advertisement;
          }
        }
      }
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'kind' in error &&
        'message' in error
      ) {
        throw error;
      }

      throw createError('ble-unavailable', formatBleStartError(error), true);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      await stop().catch(() => undefined);
    }
  }

  async stopScan(): Promise<void> {
    await this.activeStop?.();
  }
}

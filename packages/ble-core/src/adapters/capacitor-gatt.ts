import type { BleClientInterface } from '@capacitor-community/bluetooth-le';
import type {
  BleCoreError,
  BleGattClient,
  BleGattNotification,
  BleGattSubscription,
  GattRequestOptions
} from '../model.js';

type BleClientLoader = () => Promise<BleClientInterface>;
type BooleanResultLike = boolean | { value: boolean };

export interface CapacitorBleGattClientOptions {
  clientLoader?: BleClientLoader;
}

const BLE_UUID_BASE_SUFFIX = '-0000-1000-8000-00805f9b34fb';

const loadBleClient: BleClientLoader = async () => {
  const { BleClient } = await import('@capacitor-community/bluetooth-le');
  return BleClient;
};

const createError = (
  kind: BleCoreError['kind'],
  message: string,
  retryable = true
): BleCoreError => ({ kind, message, retryable });

const booleanValue = (result: BooleanResultLike): boolean =>
  typeof result === 'boolean' ? result : result.value;

export const normalizeGattUuid = (uuid: string): string => {
  const value = uuid.trim().toLowerCase().replace(/[{}]/g, '').replace(/^0x/, '');

  if (/^[0-9a-f]{4}$/.test(value)) {
    return `0000${value}${BLE_UUID_BASE_SUFFIX}`;
  }

  if (/^[0-9a-f]{8}$/.test(value)) {
    return `${value}${BLE_UUID_BASE_SUFFIX}`;
  }

  return value;
};

const toTimeoutOptions = (
  options: GattRequestOptions | undefined
): { timeout: number } | undefined =>
  options?.timeoutMs && options.timeoutMs > 0
    ? { timeout: options.timeoutMs }
    : undefined;

const toDataView = (value: Uint8Array): DataView =>
  new DataView(new Uint8Array(value).buffer);

export const bytesFromGattValue = (value: DataView): Uint8Array =>
  new Uint8Array(
    value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
  );

const formatGattError = (error: unknown): string => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
        ? error.message
        : String(error);

  if (/bluetooth.*not.*available|not available|not supported/i.test(message)) {
    return 'Phone BLE connection is unavailable in this runtime.';
  }

  return message || 'BLE connection failed.';
};

const toGattError = (error: unknown): BleCoreError => {
  const message = formatGattError(error);

  if (/permission denied|permission/i.test(message)) {
    return createError('permission-denied', 'Bluetooth permission was denied.', false);
  }

  return createError('ble-unavailable', message, true);
};

export class CapacitorBleGattClient implements BleGattClient {
  private readonly clientLoader: BleClientLoader;

  constructor(options: CapacitorBleGattClientOptions = {}) {
    this.clientLoader = options.clientLoader ?? loadBleClient;
  }

  async initialize(): Promise<void> {
    const client = await this.clientLoader();
    await client.initialize();
    if (!booleanValue(await client.isEnabled())) {
      await client.requestEnable();
    }
    if (!booleanValue(await client.isEnabled())) {
      throw createError('ble-unavailable', 'Bluetooth is disabled.', true);
    }
  }

  async connect(
    deviceId: string,
    options: GattRequestOptions & {
      onDisconnect?(deviceId: string): void;
    } = {}
  ): Promise<void> {
    try {
      await this.initialize();
      const client = await this.clientLoader();
      await client.connect(deviceId, options.onDisconnect, toTimeoutOptions(options));
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'kind' in error &&
        'message' in error
      ) {
        throw error;
      }
      throw toGattError(error);
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const client = await this.clientLoader();
    await client.disconnect(deviceId).catch(() => undefined);
  }

  async read(
    deviceId: string,
    serviceUuid: string,
    characteristicUuid: string,
    options: GattRequestOptions = {}
  ): Promise<Uint8Array> {
    try {
      const client = await this.clientLoader();
      const value = await client.read(
        deviceId,
        normalizeGattUuid(serviceUuid),
        normalizeGattUuid(characteristicUuid),
        toTimeoutOptions(options)
      );
      return bytesFromGattValue(value);
    } catch (error) {
      throw createError('ble-unavailable', formatGattError(error), true);
    }
  }

  async write(
    deviceId: string,
    serviceUuid: string,
    characteristicUuid: string,
    value: Uint8Array,
    options: GattRequestOptions = {}
  ): Promise<void> {
    try {
      const client = await this.clientLoader();
      await client.write(
        deviceId,
        normalizeGattUuid(serviceUuid),
        normalizeGattUuid(characteristicUuid),
        toDataView(value),
        toTimeoutOptions(options)
      );
    } catch (error) {
      throw createError('ble-unavailable', formatGattError(error), true);
    }
  }

  async startNotifications(
    deviceId: string,
    serviceUuid: string,
    characteristicUuid: string,
    onNotification: (notification: BleGattNotification) => void,
    options: GattRequestOptions = {}
  ): Promise<BleGattSubscription> {
    try {
      const client = await this.clientLoader();
      const service = normalizeGattUuid(serviceUuid);
      const characteristic = normalizeGattUuid(characteristicUuid);
      await client.startNotifications(
        deviceId,
        service,
        characteristic,
        (value) =>
          onNotification({
            deviceId,
            serviceUuid: service,
            characteristicUuid: characteristic,
            value: bytesFromGattValue(value)
          }),
        toTimeoutOptions(options)
      );

      return {
        stop: async () => {
          await client.stopNotifications(deviceId, service, characteristic);
        }
      };
    } catch (error) {
      throw createError('ble-unavailable', formatGattError(error), true);
    }
  }
}

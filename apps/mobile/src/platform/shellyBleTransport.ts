import { CapacitorBleGattClient } from '@lcl/ble-core';
import { BleShellyRpcTransport, type ShellyBleGattPort } from '@lcl/shelly-client';

const DEFAULT_SHELLY_BLE_RPC_TIMEOUT_MS = 8000;

export interface ShellyBleTransportOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  maxResponseBytes?: number;
  gatt?: ShellyBleGattPort;
}

export const createShellyBleTransport = (
  deviceId: string,
  options: ShellyBleTransportOptions = {}
): BleShellyRpcTransport =>
  new BleShellyRpcTransport({
    deviceId,
    gatt: options.gatt ?? new CapacitorBleGattClient(),
    defaultTimeoutMs: options.timeoutMs ?? DEFAULT_SHELLY_BLE_RPC_TIMEOUT_MS,
    ...(options.pollIntervalMs === undefined
      ? {}
      : { pollIntervalMs: options.pollIntervalMs }),
    ...(options.maxResponseBytes === undefined
      ? {}
      : { maxResponseBytes: options.maxResponseBytes })
  });

import {
  RpcShellyClient,
  type ShellyClient,
  type ShellyRpcTransport,
  type ShellyStatus
} from '@lcl/shelly-client';
import { createShellyBleTransport } from '../../../platform/shellyBleTransport.js';
import { unwrapShellyResult } from '../../../platform/shellyResult.js';
import type { SavedBlePlug } from './savedBlePlug.js';

export type BlePlugRuntimeStatus = Pick<
  ShellyStatus,
  'relayOn' | 'telemetry' | 'clock'
>;

type BlePlugRuntimeClient = Pick<
  ShellyClient,
  'getStatus' | 'setRelayOn' | 'setRelayOff'
>;

type DisposableShellyRpcTransport = ShellyRpcTransport & {
  disconnect(): Promise<void>;
};

export type BlePlugRuntimeDependencies = {
  createTransport(deviceId: string): DisposableShellyRpcTransport;
  createClient(transport: ShellyRpcTransport): BlePlugRuntimeClient;
};

const defaultDependencies: BlePlugRuntimeDependencies = {
  createTransport: (deviceId) => createShellyBleTransport(deviceId),
  createClient: (transport) => new RpcShellyClient(transport)
};

const withBlePlugClient = async <T>(
  plug: Pick<SavedBlePlug, 'bleDeviceId'>,
  work: (client: BlePlugRuntimeClient) => Promise<T>,
  dependencies: BlePlugRuntimeDependencies
): Promise<T> => {
  const transport = dependencies.createTransport(plug.bleDeviceId);
  try {
    return await work(dependencies.createClient(transport));
  } finally {
    await transport.disconnect().catch(() => undefined);
  }
};

export const readBlePlugRuntimeStatus = async (
  plug: Pick<SavedBlePlug, 'bleDeviceId'>,
  dependencies: BlePlugRuntimeDependencies = defaultDependencies
): Promise<BlePlugRuntimeStatus> =>
  withBlePlugClient(
    plug,
    async (client) => {
      const status = unwrapShellyResult(await client.getStatus());
      return {
        relayOn: status.relayOn,
        telemetry: status.telemetry,
        clock: status.clock
      };
    },
    dependencies
  );

export const setBlePlugRelay = async (
  plug: Pick<SavedBlePlug, 'bleDeviceId'>,
  relayOn: boolean,
  dependencies: BlePlugRuntimeDependencies = defaultDependencies
): Promise<void> => {
  await withBlePlugClient(
    plug,
    async (client) => {
      unwrapShellyResult(
        relayOn ? await client.setRelayOn() : await client.setRelayOff()
      );
    },
    dependencies
  );
};

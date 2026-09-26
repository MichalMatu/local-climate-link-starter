import {
  normalizeShellyDeviceId,
  RpcShellyClient,
  type ShellyClient,
  type ShellyRpcTransport
} from '@lcl/shelly-client';
import { createShellyBleTransport } from '../../../platform/shellyBleTransport.js';
import { unwrapShellyResult } from '../../../platform/shellyResult.js';
import {
  createVerifiedPlugSettingsTransport,
  type PlugSettingsTarget
} from './plugSettingsTarget.js';

export type PlugReadOnlyManagementTarget =
  | {
      transport: 'wifi';
      physicalId: string;
      baseUrl: string;
    }
  | {
      transport: 'bluetooth';
      physicalId: string;
      bleDeviceId: string;
    };

type ReadOnlyShellyClient = Pick<ShellyClient, 'getDeviceInfo' | 'getStatus'>;

type DisposableShellyRpcTransport = ShellyRpcTransport & {
  disconnect(): Promise<void>;
};

export type PlugReadOnlyManagementDependencies = {
  createWifiTransport(target: PlugSettingsTarget): Promise<ShellyRpcTransport>;
  createBleTransport(deviceId: string): DisposableShellyRpcTransport;
  createClient(transport: ShellyRpcTransport): ReadOnlyShellyClient;
};

const defaultDependencies: PlugReadOnlyManagementDependencies = {
  createWifiTransport: createVerifiedPlugSettingsTransport,
  createBleTransport: (deviceId) => createShellyBleTransport(deviceId),
  createClient: (transport) => new RpcShellyClient(transport)
};

const assertMatchingPhysicalIdentity = async (
  target: Extract<PlugReadOnlyManagementTarget, { transport: 'bluetooth' }>,
  client: ReadOnlyShellyClient
): Promise<void> => {
  const info = unwrapShellyResult(await client.getDeviceInfo());
  const remoteDeviceId = info.id?.trim();
  if (!remoteDeviceId) {
    throw new Error('Shelly did not expose a stable device id.');
  }
  if (
    normalizeShellyDeviceId(remoteDeviceId) !== normalizeShellyDeviceId(target.physicalId)
  ) {
    throw new Error('Shelly identity does not match the saved Plug.');
  }
};

export const withVerifiedPlugReadOnlyClient = async <T>(
  target: PlugReadOnlyManagementTarget,
  work: (client: ReadOnlyShellyClient) => Promise<T>,
  dependencies: PlugReadOnlyManagementDependencies = defaultDependencies
): Promise<T> => {
  if (target.transport === 'wifi') {
    const transport = await dependencies.createWifiTransport({
      deviceId: target.physicalId,
      baseUrl: target.baseUrl
    });
    return work(dependencies.createClient(transport));
  }

  const transport = dependencies.createBleTransport(target.bleDeviceId);
  try {
    const client = dependencies.createClient(transport);
    await assertMatchingPhysicalIdentity(target, client);
    return await work(client);
  } finally {
    await transport.disconnect().catch(() => undefined);
  }
};

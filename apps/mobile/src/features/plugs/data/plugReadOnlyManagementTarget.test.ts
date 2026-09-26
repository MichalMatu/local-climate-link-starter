import { FakeShellyClient, type ShellyRpcTransport } from '@lcl/shelly-client';
import { describe, expect, it, vi } from 'vitest';
import {
  withVerifiedPlugReadOnlyClient,
  type PlugReadOnlyManagementDependencies
} from './plugReadOnlyManagementTarget.js';

const createDependencies = (client: FakeShellyClient) => {
  const wifiTransport = { call: vi.fn() } as unknown as ShellyRpcTransport;
  const disconnect = vi.fn(async () => undefined);
  const bleTransport = {
    call: vi.fn(),
    disconnect
  } as unknown as ShellyRpcTransport & { disconnect(): Promise<void> };
  const dependencies: PlugReadOnlyManagementDependencies = {
    createWifiTransport: vi.fn(async () => wifiTransport),
    createBleTransport: vi.fn(() => bleTransport),
    createClient: vi.fn(() => client)
  };
  return { dependencies, disconnect };
};

const physicalIdFor = async (client: FakeShellyClient): Promise<string> => {
  const result = await client.getDeviceInfo();
  if (!result.ok || !result.value.id) throw new Error('Fake Shelly id is missing.');
  return result.value.id;
};

describe('Plug read-only management target', () => {
  it('keeps the existing verified Wi-Fi target boundary intact', async () => {
    const client = new FakeShellyClient();
    const { dependencies } = createDependencies(client);

    await expect(
      withVerifiedPlugReadOnlyClient(
        {
          transport: 'wifi',
          physicalId: 'shellyplugsg3-demo',
          baseUrl: 'http://192.168.1.20'
        },
        async () => 'ok',
        dependencies
      )
    ).resolves.toBe('ok');

    expect(dependencies.createWifiTransport).toHaveBeenCalledWith({
      deviceId: 'shellyplugsg3-demo',
      baseUrl: 'http://192.168.1.20'
    });
    expect(dependencies.createBleTransport).not.toHaveBeenCalled();
  });

  it('verifies canonical identity before a BLE read and disconnects afterward', async () => {
    const client = new FakeShellyClient();
    const physicalId = await physicalIdFor(client);
    const { dependencies, disconnect } = createDependencies(client);

    const result = await withVerifiedPlugReadOnlyClient(
      {
        transport: 'bluetooth',
        physicalId,
        bleDeviceId: 'BLE-LOCATOR'
      },
      async (verifiedClient) => verifiedClient.getStatus(),
      dependencies
    );

    expect(result.ok).toBe(true);
    expect(dependencies.createBleTransport).toHaveBeenCalledWith('BLE-LOCATOR');
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('rejects the wrong BLE physical identity and still disconnects', async () => {
    const client = new FakeShellyClient();
    const { dependencies, disconnect } = createDependencies(client);

    await expect(
      withVerifiedPlugReadOnlyClient(
        {
          transport: 'bluetooth',
          physicalId: 'shellyplugsg3-not-this-device',
          bleDeviceId: 'BLE-WRONG'
        },
        async () => 'unreachable',
        dependencies
      )
    ).rejects.toThrow('Shelly identity does not match the saved Plug.');

    expect(disconnect).toHaveBeenCalledOnce();
  });
});

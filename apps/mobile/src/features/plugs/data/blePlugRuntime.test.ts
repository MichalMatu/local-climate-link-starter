import {
  FakeShellyClient,
  type ShellyRpcTransport
} from '@lcl/shelly-client';
import { describe, expect, it, vi } from 'vitest';
import {
  readBlePlugRuntimeStatus,
  setBlePlugRelay,
  type BlePlugRuntimeDependencies
} from './blePlugRuntime.js';

const createDependencies = (client = new FakeShellyClient()) => {
  const disconnect = vi.fn(async () => undefined);
  const createTransport = vi.fn(
    () =>
      ({
        call: vi.fn(),
        disconnect
      }) as unknown as ShellyRpcTransport & { disconnect(): Promise<void> }
  );
  const dependencies: BlePlugRuntimeDependencies = {
    createTransport,
    createClient: () => client
  };
  return { client, createTransport, disconnect, dependencies };
};

describe('BLE Plug runtime boundary', () => {
  it('reads normalized runtime status using the saved BLE locator and disconnects', async () => {
    const { createTransport, disconnect, dependencies } = createDependencies();

    const status = await readBlePlugRuntimeStatus(
      { bleDeviceId: 'BLE-LOCATOR-1' },
      dependencies
    );

    expect(createTransport).toHaveBeenCalledWith('BLE-LOCATOR-1');
    expect(status).toMatchObject({
      relayOn: false,
      telemetry: { powerW: 0, voltageV: 230.1, energyWh: 42.8 },
      clock: { localTime: '12:00', timeSynced: true }
    });
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('uses one-shot relay RPC calls without hiding the final state', async () => {
    const { client, disconnect, dependencies } = createDependencies();
    const plug = { bleDeviceId: 'BLE-LOCATOR-2' };

    await setBlePlugRelay(plug, true, dependencies);
    expect((await client.getStatus()).value).toMatchObject({ relayOn: true });

    await setBlePlugRelay(plug, false, dependencies);
    expect((await client.getStatus()).value).toMatchObject({ relayOn: false });
    expect(disconnect).toHaveBeenCalledTimes(2);
  });
});

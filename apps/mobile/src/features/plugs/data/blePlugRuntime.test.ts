import { FakeShellyClient, type ShellyRpcTransport } from '@lcl/shelly-client';
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
    const afterOn = await client.getStatus();
    expect(afterOn.ok).toBe(true);
    if (!afterOn.ok) throw new Error(afterOn.error.technicalMessage);
    expect(afterOn.value.relayOn).toBe(true);

    await setBlePlugRelay(plug, false, dependencies);
    const afterOff = await client.getStatus();
    expect(afterOff.ok).toBe(true);
    if (!afterOff.ok) throw new Error(afterOff.error.technicalMessage);
    expect(afterOff.value.relayOn).toBe(false);
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it('serializes overlapping operations for the same BLE locator', async () => {
    const client = new FakeShellyClient();
    const originalGetStatus = client.getStatus.bind(client);
    const originalSetRelayOn = client.setRelayOn.bind(client);
    const events: string[] = [];
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });

    vi.spyOn(client, 'getStatus').mockImplementation(async () => {
      events.push('read:start');
      markReadStarted();
      await readGate;
      events.push('read:end');
      return originalGetStatus();
    });
    vi.spyOn(client, 'setRelayOn').mockImplementation(async () => {
      events.push('write:start');
      const result = await originalSetRelayOn();
      events.push('write:end');
      return result;
    });

    const { dependencies } = createDependencies(client);
    const plug = { bleDeviceId: 'BLE-LOCATOR-SERIAL' };
    const readPromise = readBlePlugRuntimeStatus(plug, dependencies);
    await readStarted;

    const relayPromise = setBlePlugRelay(plug, true, dependencies);
    await Promise.resolve();
    expect(events).toEqual(['read:start']);

    releaseRead();
    await Promise.all([readPromise, relayPromise]);
    expect(events).toEqual(['read:start', 'read:end', 'write:start', 'write:end']);
  });
});

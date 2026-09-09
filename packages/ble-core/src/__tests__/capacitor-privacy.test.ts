import type { BleClientInterface } from '@capacitor-community/bluetooth-le';
import { CapacitorBleScanner } from '../index.js';

describe('CapacitorBleScanner Android privacy', () => {
  it('initializes BLE scanning as never-for-location', async () => {
    const client: BleClientInterface = {
      initialize: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockResolvedValue({ value: true }),
      requestEnable: vi.fn().mockResolvedValue(undefined),
      requestLEScan: vi.fn(async () => undefined),
      stopLEScan: vi.fn().mockResolvedValue(undefined)
    } as unknown as BleClientInterface;
    const scanner = new CapacitorBleScanner({ clientLoader: async () => client });
    const iterator = scanner.startScan({ timeoutMs: 1 })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({ done: true });
    expect(client.initialize).toHaveBeenCalledWith({ androidNeverForLocation: true });
  });
});

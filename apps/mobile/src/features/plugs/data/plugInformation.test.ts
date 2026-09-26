import { FakeShellyClient, type ShellyRpcTransport } from '@lcl/shelly-client';
import { describe, expect, it, vi } from 'vitest';
import { BlePlugReadOnlyError } from './blePlugReadOnlyError.js';
import { readPlugInformationFromTarget } from './plugInformation.js';
import type { PlugReadOnlyManagementDependencies } from './plugReadOnlyManagementTarget.js';

describe('Plug information transport errors', () => {
  it('preserves retryable BLE status read errors for locator recovery', async () => {
    const client = new FakeShellyClient();
    const info = await client.getDeviceInfo();
    if (!info.ok || !info.value.id) throw new Error('Fake Shelly id is missing.');

    vi.spyOn(client, 'getStatus').mockResolvedValue({
      ok: false,
      error: {
        kind: 'timeout',
        userMessageKey: 'errors.timeout',
        technicalMessage: 'BLE read timed out',
        retryable: true
      }
    });

    const disconnect = vi.fn(async () => undefined);
    const dependencies: PlugReadOnlyManagementDependencies = {
      createWifiTransport: vi.fn(),
      createBleTransport: vi.fn(
        () =>
          ({
            call: vi.fn(),
            disconnect
          }) as unknown as ShellyRpcTransport & { disconnect(): Promise<void> }
      ),
      createClient: vi.fn(() => client)
    };

    const error = await readPlugInformationFromTarget(
      {
        transport: 'bluetooth',
        physicalId: info.value.id,
        bleDeviceId: 'BLE-LOCATOR'
      },
      dependencies
    ).then(
      () => null,
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(BlePlugReadOnlyError);
    expect(error).toMatchObject({ kind: 'timeout', retryable: true });
    expect(disconnect).toHaveBeenCalledOnce();
  });
});

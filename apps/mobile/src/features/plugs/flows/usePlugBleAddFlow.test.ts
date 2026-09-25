import { act, renderHook, waitFor } from '@testing-library/react';
import type { BleScanner, NormalizedBleAdvertisement } from '@lcl/ble-core';
import { describe, expect, it, vi } from 'vitest';
import type { VerifiedPlugBleCandidate } from '../data/plugBleOnboarding.js';
import { usePlugBleAddFlow } from './usePlugBleAddFlow.js';

const advertisement = (
  id: string,
  name: string,
  rssi: number
): NormalizedBleAdvertisement => ({
  id,
  name,
  rssi,
  serviceUuids: [],
  serviceData: {},
  manufacturerData: {},
  seenAtMs: 1,
  platform: 'android'
});

class FakeScanner implements BleScanner {
  stopCalls = 0;

  constructor(private readonly items: NormalizedBleAdvertisement[]) {}

  async *startScan(): AsyncIterable<NormalizedBleAdvertisement> {
    for (const item of this.items) {
      yield item;
    }
  }

  async stopScan(): Promise<void> {
    this.stopCalls += 1;
  }
}

const verified = (deviceId: string): VerifiedPlugBleCandidate => ({
  bleDeviceId: deviceId,
  advertisementName: 'ShellyPlugSG3-AABBCCDDEEFF',
  rssi: -40,
  physicalId: 'shellyplugsg3-aabbccddeeff',
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false,
  network: {
    state: 'needs-wifi',
    configuredSsids: [],
    connectionStatus: 'disconnected',
    connectedSsid: null,
    stationIp: null
  }
});

describe('usePlugBleAddFlow', () => {
  it('discovers Shelly Plugs and sorts them by signal strength', async () => {
    const scanner = new FakeScanner([
      advertisement('weak', 'ShellyPlugSG3-WEAK', -70),
      advertisement('sensor', 'LYWSD03MMC', -20),
      advertisement('strong', 'ShellyPlugSG3-STRONG', -35)
    ]);
    const { result } = renderHook(() =>
      usePlugBleAddFlow({ createScanner: () => scanner })
    );

    act(() => result.current.startScan());

    await waitFor(() => expect(result.current.scanning).toBe(false));
    expect(result.current.candidates.map((item) => item.deviceId)).toEqual([
      'strong',
      'weak'
    ]);
    expect(scanner.stopCalls).toBe(1);
  });

  it('stops phone scanning before inspecting a selected candidate', async () => {
    let releaseScan: (() => void) | undefined;
    const scanner: BleScanner = {
      async *startScan() {
        yield advertisement('plug', 'ShellyPlugSG3-AABBCCDDEEFF', -40);
        await new Promise<void>((resolve) => {
          releaseScan = resolve;
        });
      },
      stopScan: vi.fn(async () => {
        releaseScan?.();
      })
    };
    const inspectCandidate = vi.fn(async () => verified('plug'));
    const { result } = renderHook(() =>
      usePlugBleAddFlow({ createScanner: () => scanner, inspectCandidate })
    );

    act(() => result.current.startScan());
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));

    await act(async () => {
      await result.current.inspectCandidate(result.current.candidates[0]!);
    });

    expect(scanner.stopScan).toHaveBeenCalled();
    expect(inspectCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'plug' })
    );
    expect(result.current.verifiedCandidate?.physicalId).toBe(
      'shellyplugsg3-aabbccddeeff'
    );
  });

  it('surfaces inspection errors without leaving an inspecting state', async () => {
    const inspectCandidate = vi.fn(async () => {
      throw new Error('GATT unavailable');
    });
    const { result } = renderHook(() => usePlugBleAddFlow({ inspectCandidate }));

    await act(async () => {
      await result.current.inspectCandidate({
        deviceId: 'plug',
        name: 'ShellyPlugSG3-AABBCCDDEEFF',
        rssi: -40
      });
    });

    expect(result.current.error).toBe('GATT unavailable');
    expect(result.current.inspectingDeviceId).toBeNull();
    expect(result.current.verifiedCandidate).toBeNull();
  });

  it('stops an active scanner when the hook unmounts', async () => {
    let releaseScan: (() => void) | undefined;
    const scanner: BleScanner = {
      async *startScan() {
        await new Promise<void>((resolve) => {
          releaseScan = resolve;
        });
      },
      stopScan: vi.fn(async () => {
        releaseScan?.();
      })
    };
    const { result, unmount } = renderHook(() =>
      usePlugBleAddFlow({ createScanner: () => scanner })
    );

    act(() => result.current.startScan());
    await waitFor(() => expect(result.current.scanning).toBe(true));
    unmount();

    await waitFor(() => expect(scanner.stopScan).toHaveBeenCalled());
  });
});

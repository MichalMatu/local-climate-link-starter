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
  startCalls = 0;
  stopCalls = 0;

  constructor(private readonly items: NormalizedBleAdvertisement[]) {}

  async *startScan(): AsyncIterable<NormalizedBleAdvertisement> {
    this.startCalls += 1;
    for (const item of this.items) yield item;
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
  preview: null
});

describe('usePlugBleAddFlow', () => {
  it('auto-starts exactly once and preserves first-seen candidate order', async () => {
    const scanner = new FakeScanner([
      advertisement('first', 'ShellyPlugSG3-FIRST', -70),
      advertisement('second', 'ShellyPlugSG3-SECOND', -35),
      advertisement('FIRST', 'ShellyPlugSG3-FIRST', -20)
    ]);
    const createScanner = vi.fn(() => scanner);
    const { result, rerender } = renderHook(() => usePlugBleAddFlow({ createScanner }));

    await waitFor(() => expect(result.current.scanning).toBe(false));
    rerender();

    expect(createScanner).toHaveBeenCalledTimes(1);
    expect(scanner.startCalls).toBe(1);
    expect(result.current.candidates.map((item) => item.deviceId)).toEqual([
      'FIRST',
      'second'
    ]);
    expect(result.current.candidates[0]?.rssi).toBe(-20);
  });

  it('does not start an overlapping scan', async () => {
    let releaseScan: (() => void) | undefined;
    const scanner: BleScanner = {
      async *startScan() {
        yield advertisement('plug', 'ShellyPlugSG3-AABBCCDDEEFF', -40);
        await new Promise<void>((resolve) => {
          releaseScan = resolve;
        });
      },
      stopScan: vi.fn(async () => releaseScan?.())
    };
    const createScanner = vi.fn(() => scanner);
    const { result } = renderHook(() => usePlugBleAddFlow({ createScanner }));

    await waitFor(() => expect(result.current.scanning).toBe(true));
    act(() => result.current.startScan());
    expect(createScanner).toHaveBeenCalledTimes(1);

    act(() => result.current.stopScan());
    await waitFor(() => expect(result.current.scanning).toBe(false));
  });

  it('stops phone scanning before verifying a selected candidate', async () => {
    let releaseScan: (() => void) | undefined;
    const scanner: BleScanner = {
      async *startScan() {
        yield advertisement('plug', 'ShellyPlugSG3-AABBCCDDEEFF', -40);
        await new Promise<void>((resolve) => {
          releaseScan = resolve;
        });
      },
      stopScan: vi.fn(async () => releaseScan?.())
    };
    const inspectCandidate = vi.fn(async () => verified('plug'));
    const createScanner = vi.fn(() => scanner);
    const { result } = renderHook(() =>
      usePlugBleAddFlow({ createScanner, inspectCandidate })
    );

    await waitFor(() => expect(result.current.candidates).toHaveLength(1));

    await act(async () => {
      await result.current.verifyCandidate(result.current.candidates[0]!);
    });

    expect(scanner.stopScan).toHaveBeenCalled();
    expect(inspectCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'plug' })
    );
    expect(result.current.verifiedCandidates[0]?.physicalId).toBe(
      'shellyplugsg3-aabbccddeeff'
    );
    expect(result.current.verifiedCandidates).toHaveLength(1);
  });

  it('returns null for verification failure so an unverified candidate cannot be saved', async () => {
    const inspectCandidate = vi.fn(async () => {
      throw new Error('GATT unavailable');
    });
    const { result } = renderHook(() =>
      usePlugBleAddFlow({ autoStart: false, inspectCandidate })
    );

    let resolved: VerifiedPlugBleCandidate | null = verified('unexpected');
    await act(async () => {
      resolved = await result.current.verifyCandidate({
        deviceId: 'plug',
        name: 'ShellyPlugSG3-AABBCCDDEEFF',
        rssi: -40
      });
    });

    expect(resolved).toBeNull();
    expect(result.current.error).toBe('GATT unavailable');
    expect(result.current.verifiedCandidates).toHaveLength(0);
  });

  it('stops an active scanner when the hook unmounts', async () => {
    let releaseScan: (() => void) | undefined;
    const scanner: BleScanner = {
      async *startScan() {
        yield advertisement('plug', 'ShellyPlugSG3-AABBCCDDEEFF', -40);
        await new Promise<void>((resolve) => {
          releaseScan = resolve;
        });
      },
      stopScan: vi.fn(async () => releaseScan?.())
    };
    const createScanner = vi.fn(() => scanner);
    const { result, unmount } = renderHook(() => usePlugBleAddFlow({ createScanner }));

    await waitFor(() => expect(result.current.scanning).toBe(true));
    unmount();

    await waitFor(() => expect(scanner.stopScan).toHaveBeenCalled());
  });
});

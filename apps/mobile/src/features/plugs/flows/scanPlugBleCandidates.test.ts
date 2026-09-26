import type { BleScanner, NormalizedBleAdvertisement } from '@lcl/ble-core';
import { scanPlugBleCandidates } from './scanPlugBleCandidates.js';

class FakeScanner implements BleScanner {
  stopCalls = 0;

  constructor(private readonly advertisements: NormalizedBleAdvertisement[]) {}

  async *startScan(): AsyncIterable<NormalizedBleAdvertisement> {
    for (const advertisement of this.advertisements) yield advertisement;
  }

  async stopScan(): Promise<void> {
    this.stopCalls += 1;
  }
}

const advertisement = (
  id: string,
  name: string | undefined,
  rssi: number | undefined
): NormalizedBleAdvertisement => ({
  id,
  serviceUuids: [],
  serviceData: {},
  manufacturerData: {},
  seenAtMs: 1,
  platform: 'android',
  ...(name === undefined ? {} : { name }),
  ...(rssi === undefined ? {} : { rssi })
});

describe('scanPlugBleCandidates', () => {
  it('returns only Shelly Plug advertisements in first-seen order', async () => {
    const scanner = new FakeScanner([
      advertisement('sensor', 'LYWSD03MMC', -30),
      advertisement('plug-weak', 'ShellyPlugSG3-AAAA', -60),
      advertisement('plug-strong', 'ShellyPlugSG3-BBBB', -40)
    ]);

    const candidates = await scanPlugBleCandidates({ scanner });

    expect(candidates.map((candidate) => candidate.deviceId)).toEqual([
      'plug-weak',
      'plug-strong'
    ]);
    expect(scanner.stopCalls).toBe(1);
  });

  it('updates repeated advertisements in place without changing first-seen order', async () => {
    const scanner = new FakeScanner([
      advertisement('plug-a', 'ShellyPlugSG3-A', -70),
      advertisement('plug-b', 'ShellyPlugSG3-B', -40),
      advertisement('PLUG-A', 'ShellyPlugSG3-A', -20)
    ]);

    const candidates = await scanPlugBleCandidates({ scanner });

    expect(candidates.map((candidate) => candidate.deviceId)).toEqual([
      'PLUG-A',
      'plug-b'
    ]);
    expect(candidates[0]?.rssi).toBe(-20);
  });

  it('streams discovered candidates to the caller', async () => {
    const scanner = new FakeScanner([
      advertisement('plug-a', 'ShellyPlugSG3-A', -50),
      advertisement('plug-b', 'ShellyPlugSG3-B', -51)
    ]);
    const onCandidate = vi.fn();

    await scanPlugBleCandidates({ scanner, onCandidate });

    expect(onCandidate).toHaveBeenCalledTimes(2);
    expect(onCandidate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ deviceId: 'plug-a' })
    );
  });

  it('always stops scanning when iteration throws', async () => {
    const scanner: BleScanner = {
      async *startScan() {
        yield advertisement('plug-a', 'ShellyPlugSG3-A', -50);
        throw new Error('scan failed');
      },
      stopScan: vi.fn(async () => undefined)
    };

    await expect(scanPlugBleCandidates({ scanner })).rejects.toThrow('scan failed');
    expect(scanner.stopScan).toHaveBeenCalledTimes(1);
  });
});

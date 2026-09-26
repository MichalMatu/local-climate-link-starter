import { describe, expect, it, vi } from 'vitest';
import {
  BlePlugRuntimeReadError,
  type BlePlugRuntimeStatus
} from '../data/blePlugRuntime.js';
import type {
  PlugBleAdvertisement,
  VerifiedPlugBleCandidate
} from '../data/plugBleOnboarding.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import {
  PLUG_BLE_LOCATOR_RECOVERY_MAX_CANDIDATES,
  readSavedBlePlugRuntimeStatus
} from './readSavedBlePlugRuntimeStatus.js';

const plug: SavedBlePlug = {
  physicalId: 'shellyplugsg3-aabbccddeeff',
  name: 'Growbox fan',
  bleDeviceId: 'stale-locator',
  advertisementName: 'ShellyPlugSG3-AABBCCDDEEFF',
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false
};

const status: BlePlugRuntimeStatus = {
  relayOn: false,
  telemetry: { powerW: 4.2, voltageV: 230, energyWh: 42 },
  clock: { localTime: '12:34', timeSynced: true }
};

const advertisement = (
  deviceId: string,
  name = `ShellyPlugSG3-${deviceId}`,
  rssi = -50
): PlugBleAdvertisement => ({ deviceId, name, rssi });

const verified = (
  bleDeviceId: string,
  physicalId = plug.physicalId
): VerifiedPlugBleCandidate => ({
  bleDeviceId,
  advertisementName: `ShellyPlugSG3-${bleDeviceId}`,
  rssi: -45,
  physicalId,
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false
});

const readError = (
  kind: 'shelly-offline' | 'timeout' | 'unknown' | 'validation-failed' = 'shelly-offline',
  retryable = true
): BlePlugRuntimeReadError =>
  new BlePlugRuntimeReadError({
    kind,
    userMessageKey: kind === 'timeout' ? 'errors.timeout' : 'errors.shellyOffline',
    technicalMessage: `${kind} read failure`,
    retryable
  });

describe('readSavedBlePlugRuntimeStatus', () => {
  it('uses a healthy saved locator without scanning', async () => {
    const readStatus = vi.fn(async () => status);
    const scanCandidates = vi.fn(async () => [] as PlugBleAdvertisement[]);
    const inspectCandidate = vi.fn();
    const persistLocator = vi.fn();

    await expect(
      readSavedBlePlugRuntimeStatus(
        plug,
        { persistLocator },
        { readStatus, scanCandidates, inspectCandidate }
      )
    ).resolves.toEqual(status);

    expect(readStatus).toHaveBeenCalledOnce();
    expect(scanCandidates).not.toHaveBeenCalled();
    expect(inspectCandidate).not.toHaveBeenCalled();
    expect(persistLocator).not.toHaveBeenCalled();
  });

  it('recovers a stale locator only after canonical physical identity matches', async () => {
    const events: string[] = [];
    const misleading = advertisement('wrong-locator', plug.advertisementName, -30);
    const matching = advertisement('fresh-locator', 'ShellyPlugSG3-FRESH', -60);
    const readStatus = vi.fn(async (target: Pick<SavedBlePlug, 'bleDeviceId'>) => {
      events.push(`read:${target.bleDeviceId}`);
      if (target.bleDeviceId === plug.bleDeviceId) throw readError();
      return status;
    });
    const scanCandidates = vi.fn(async () => {
      events.push('scan');
      return [matching, misleading];
    });
    const inspectCandidate = vi.fn(async (candidate: PlugBleAdvertisement) => {
      events.push(`inspect:${candidate.deviceId}`);
      return candidate.deviceId === misleading.deviceId
        ? verified(candidate.deviceId, 'shellyplugsg3-not-the-saved-device')
        : verified(candidate.deviceId);
    });
    const persistLocator = vi.fn((physicalId: string, bleDeviceId: string) => {
      events.push(`persist:${physicalId}:${bleDeviceId}`);
    });

    await expect(
      readSavedBlePlugRuntimeStatus(
        plug,
        { persistLocator },
        { readStatus, scanCandidates, inspectCandidate }
      )
    ).resolves.toEqual(status);

    expect(events).toEqual([
      'read:stale-locator',
      'scan',
      'inspect:wrong-locator',
      'inspect:fresh-locator',
      `persist:${plug.physicalId}:fresh-locator`,
      'read:fresh-locator'
    ]);
    expect(persistLocator).toHaveBeenCalledOnce();
  });

  it('leaves the locator unchanged when no candidate matches canonical identity', async () => {
    const readStatus = vi.fn(async () => {
      throw readError();
    });
    const scanCandidates = vi.fn(async () => [advertisement('wrong')]);
    const inspectCandidate = vi.fn(async () =>
      verified('wrong', 'shellyplugsg3-another-device')
    );
    const persistLocator = vi.fn();

    await expect(
      readSavedBlePlugRuntimeStatus(
        plug,
        { persistLocator },
        { readStatus, scanCandidates, inspectCandidate }
      )
    ).rejects.toThrow('could not be rediscovered');

    expect(persistLocator).not.toHaveBeenCalled();
    expect(readStatus).toHaveBeenCalledOnce();
  });

  it('leaves the locator unchanged when scanning fails', async () => {
    const readStatus = vi.fn(async () => {
      throw readError('timeout');
    });
    const scanCandidates = vi.fn(async () => {
      throw new Error('scan unavailable');
    });
    const persistLocator = vi.fn();

    await expect(
      readSavedBlePlugRuntimeStatus(
        plug,
        { persistLocator },
        { readStatus, scanCandidates, inspectCandidate: vi.fn() }
      )
    ).rejects.toThrow('scan unavailable');

    expect(persistLocator).not.toHaveBeenCalled();
  });

  it('continues conservatively after one candidate identity inspection fails', async () => {
    const broken = advertisement('broken', plug.advertisementName);
    const matching = advertisement('fresh-locator', 'ShellyPlugSG3-FRESH');
    const readStatus = vi.fn(async (target: Pick<SavedBlePlug, 'bleDeviceId'>) => {
      if (target.bleDeviceId === plug.bleDeviceId) throw readError();
      return status;
    });
    const inspectCandidate = vi.fn(async (candidate: PlugBleAdvertisement) => {
      if (candidate.deviceId === broken.deviceId) throw new Error('GATT inspect failed');
      return verified(candidate.deviceId);
    });
    const persistLocator = vi.fn();

    await expect(
      readSavedBlePlugRuntimeStatus(
        plug,
        { persistLocator },
        {
          readStatus,
          scanCandidates: async () => [matching, broken],
          inspectCandidate
        }
      )
    ).resolves.toEqual(status);

    expect(inspectCandidate).toHaveBeenCalledTimes(2);
    expect(persistLocator).toHaveBeenCalledWith(plug.physicalId, 'fresh-locator');
  });

  it.each([
    ['unknown', true],
    ['validation-failed', false],
    ['timeout', false]
  ] as const)(
    'does not rediscover for non-locator read error %s retryable=%s',
    async (kind, retryable) => {
      const error = readError(kind, retryable);
      const scanCandidates = vi.fn(async () => [] as PlugBleAdvertisement[]);

      await expect(
        readSavedBlePlugRuntimeStatus(
          plug,
          { persistLocator: vi.fn() },
          {
            readStatus: async () => {
              throw error;
            },
            scanCandidates,
            inspectCandidate: vi.fn()
          }
        )
      ).rejects.toBe(error);

      expect(scanCandidates).not.toHaveBeenCalled();
    }
  );

  it('retries the read once after a match without starting a second recovery cycle', async () => {
    const readStatus = vi.fn(async () => {
      throw readError();
    });
    const scanCandidates = vi.fn(async () => [advertisement('fresh-locator')]);
    const inspectCandidate = vi.fn(async () => verified('fresh-locator'));
    const persistLocator = vi.fn();

    await expect(
      readSavedBlePlugRuntimeStatus(
        plug,
        { persistLocator },
        { readStatus, scanCandidates, inspectCandidate }
      )
    ).rejects.toBeInstanceOf(BlePlugRuntimeReadError);

    expect(readStatus).toHaveBeenCalledTimes(2);
    expect(scanCandidates).toHaveBeenCalledOnce();
    expect(inspectCandidate).toHaveBeenCalledOnce();
    expect(persistLocator).toHaveBeenCalledOnce();
  });

  it('single-flights concurrent rediscovery for the same physical Plug', async () => {
    const readStatus = vi.fn(async (target: Pick<SavedBlePlug, 'bleDeviceId'>) => {
      if (target.bleDeviceId === plug.bleDeviceId) throw readError();
      return status;
    });
    const scanCandidates = vi.fn(async () => [advertisement('fresh-locator')]);
    const inspectCandidate = vi.fn(async () => verified('fresh-locator'));
    const persistLocator = vi.fn();
    const dependencies = { readStatus, scanCandidates, inspectCandidate };
    const options = { persistLocator };

    const [first, second] = await Promise.all([
      readSavedBlePlugRuntimeStatus(plug, options, dependencies),
      readSavedBlePlugRuntimeStatus(plug, options, dependencies)
    ]);

    expect(first).toEqual(status);
    expect(second).toEqual(status);
    expect(scanCandidates).toHaveBeenCalledOnce();
    expect(inspectCandidate).toHaveBeenCalledOnce();
    expect(persistLocator).toHaveBeenCalledOnce();
    expect(readStatus).toHaveBeenCalledTimes(3);
  });

  it('bounds identity inspection even when many Shelly advertisements are present', async () => {
    const candidates = Array.from(
      { length: PLUG_BLE_LOCATOR_RECOVERY_MAX_CANDIDATES + 3 },
      (_, index) =>
        advertisement(`candidate-${index}`, `ShellyPlugSG3-${index}`, -40 - index)
    );
    const inspectCandidate = vi.fn(async (candidate: PlugBleAdvertisement) =>
      verified(candidate.deviceId, `shellyplugsg3-wrong-${candidate.deviceId}`)
    );

    await expect(
      readSavedBlePlugRuntimeStatus(
        plug,
        { persistLocator: vi.fn() },
        {
          readStatus: async () => {
            throw readError();
          },
          scanCandidates: async () => candidates,
          inspectCandidate
        }
      )
    ).rejects.toThrow('could not be rediscovered');

    expect(inspectCandidate).toHaveBeenCalledTimes(
      PLUG_BLE_LOCATOR_RECOVERY_MAX_CANDIDATES
    );
  });
});

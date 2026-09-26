import { describe, expect, it, vi } from 'vitest';
import { BlePlugReadOnlyError } from '../data/blePlugReadOnlyError.js';
import type { PlugInformation } from '../data/plugInformation.js';
import type {
  PlugBleAdvertisement,
  VerifiedPlugBleCandidate
} from '../data/plugBleOnboarding.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import { readSavedBlePlugInformation } from './readSavedBlePlugInformation.js';

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

const information = {
  deviceInfo: { id: plug.physicalId },
  status: {}
} as PlugInformation;

const advertisement: PlugBleAdvertisement = {
  deviceId: 'fresh-locator',
  name: plug.advertisementName,
  rssi: -42
};

const verified: VerifiedPlugBleCandidate = {
  bleDeviceId: advertisement.deviceId,
  advertisementName: advertisement.name,
  rssi: advertisement.rssi,
  physicalId: plug.physicalId,
  model: plug.model,
  generation: plug.generation,
  firmwareId: plug.firmwareId,
  matterEnabled: plug.matterEnabled
};

const readError = (
  kind: 'shelly-offline' | 'timeout' | 'unknown' = 'shelly-offline',
  retryable = true
) =>
  new BlePlugReadOnlyError({
    kind,
    userMessageKey: kind === 'timeout' ? 'errors.timeout' : 'errors.shellyOffline',
    technicalMessage: `${kind} read failure`,
    retryable
  });

describe('readSavedBlePlugInformation', () => {
  it('uses a healthy saved locator without scanning', async () => {
    const readInformation = vi.fn(async () => information);
    const scanCandidates = vi.fn(async () => [] as PlugBleAdvertisement[]);

    await expect(
      readSavedBlePlugInformation(
        plug,
        { persistLocator: vi.fn() },
        { readInformation, scanCandidates, inspectCandidate: vi.fn() }
      )
    ).resolves.toBe(information);

    expect(readInformation).toHaveBeenCalledOnce();
    expect(scanCandidates).not.toHaveBeenCalled();
  });

  it('recovers a stale locator and retries Info exactly once with the verified locator', async () => {
    const readInformation = vi.fn(
      async (target: Pick<SavedBlePlug, 'physicalId' | 'bleDeviceId'>) => {
        if (target.bleDeviceId === plug.bleDeviceId) throw readError();
        return information;
      }
    );
    const scanCandidates = vi.fn(async () => [advertisement]);
    const inspectCandidate = vi.fn(async () => verified);
    const persistLocator = vi.fn();

    await expect(
      readSavedBlePlugInformation(
        plug,
        { persistLocator },
        { readInformation, scanCandidates, inspectCandidate }
      )
    ).resolves.toBe(information);

    expect(readInformation).toHaveBeenNthCalledWith(1, plug);
    expect(readInformation).toHaveBeenNthCalledWith(2, {
      physicalId: plug.physicalId,
      bleDeviceId: verified.bleDeviceId
    });
    expect(scanCandidates).toHaveBeenCalledOnce();
    expect(inspectCandidate).toHaveBeenCalledOnce();
    expect(persistLocator).toHaveBeenCalledWith(plug.physicalId, verified.bleDeviceId);
  });

  it('does not rediscover for non-recoverable read errors', async () => {
    const error = readError('unknown', false);
    const scanCandidates = vi.fn(async () => [advertisement]);

    await expect(
      readSavedBlePlugInformation(
        plug,
        { persistLocator: vi.fn() },
        {
          readInformation: async () => {
            throw error;
          },
          scanCandidates,
          inspectCandidate: vi.fn()
        }
      )
    ).rejects.toBe(error);

    expect(scanCandidates).not.toHaveBeenCalled();
  });
});

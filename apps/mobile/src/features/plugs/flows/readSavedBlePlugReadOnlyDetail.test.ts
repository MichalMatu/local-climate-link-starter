import { describe, expect, it, vi } from 'vitest';
import { BlePlugReadOnlyError } from '../data/blePlugReadOnlyError.js';
import type { PlugReadOnlyDetail } from '../data/plugReadOnlyDetail.js';
import type {
  PlugBleAdvertisement,
  VerifiedPlugBleCandidate
} from '../data/plugBleOnboarding.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import { readSavedBlePlugReadOnlyDetail } from './readSavedBlePlugReadOnlyDetail.js';

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

const detail = {
  information: {
    deviceInfo: { id: plug.physicalId },
    status: {}
  },
  deviceSettings: { supported: false },
  cloud: { supported: false }
} as PlugReadOnlyDetail;

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

const staleReadError = () =>
  new BlePlugReadOnlyError({
    kind: 'shelly-offline',
    userMessageKey: 'errors.shellyOffline',
    technicalMessage: 'stale GATT locator',
    retryable: true
  });

describe('readSavedBlePlugReadOnlyDetail', () => {
  it('uses a healthy saved locator without scanning', async () => {
    const readDetail = vi.fn(async () => detail);
    const scanCandidates = vi.fn(async () => [] as PlugBleAdvertisement[]);

    await expect(
      readSavedBlePlugReadOnlyDetail(
        plug,
        { persistLocator: vi.fn() },
        { readDetail, scanCandidates, inspectCandidate: vi.fn() }
      )
    ).resolves.toBe(detail);

    expect(readDetail).toHaveBeenCalledOnce();
    expect(scanCandidates).not.toHaveBeenCalled();
  });

  it('recovers a stale locator and retries the combined read exactly once', async () => {
    const readDetail = vi.fn(
      async (target: Pick<SavedBlePlug, 'physicalId' | 'bleDeviceId'>) => {
        if (target.bleDeviceId === plug.bleDeviceId) throw staleReadError();
        return detail;
      }
    );
    const persistLocator = vi.fn();

    await expect(
      readSavedBlePlugReadOnlyDetail(
        plug,
        { persistLocator },
        {
          readDetail,
          scanCandidates: vi.fn(async () => [advertisement]),
          inspectCandidate: vi.fn(async () => verified)
        }
      )
    ).resolves.toBe(detail);

    expect(readDetail).toHaveBeenCalledTimes(2);
    expect(readDetail).toHaveBeenLastCalledWith({
      physicalId: plug.physicalId,
      bleDeviceId: verified.bleDeviceId
    });
    expect(persistLocator).toHaveBeenCalledWith(plug.physicalId, verified.bleDeviceId);
  });
});

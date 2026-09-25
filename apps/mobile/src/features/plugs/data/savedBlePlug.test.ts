import { describe, expect, it } from 'vitest';
import type { VerifiedPlugBleCandidate } from './plugBleOnboarding.js';
import { savedBlePlugFromCandidate } from './savedBlePlug.js';

const candidate = (patch: Partial<VerifiedPlugBleCandidate> = {}): VerifiedPlugBleCandidate => ({
  bleDeviceId: 'temporary-handle-a',
  advertisementName: 'ShellyPlugSG3-AABB',
  rssi: -42,
  physicalId: ' ShellyPlugSG3-AABB ',
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false,
  ...patch
});

describe('savedBlePlugFromCandidate', () => {
  it('uses canonical physical identity and keeps BLE locator separate', () => {
    expect(savedBlePlugFromCandidate(candidate())).toEqual({
      physicalId: 'shellyplugsg3-aabb',
      name: 'ShellyPlugSG3-AABB',
      bleDeviceId: 'temporary-handle-a',
      advertisementName: 'ShellyPlugSG3-AABB',
      model: 'S3PL-00112EU',
      generation: 3,
      firmwareId: '1.7.5',
      matterEnabled: false
    });
  });

  it('preserves the saved name while refreshing transport locator and metadata', () => {
    const first = savedBlePlugFromCandidate(candidate());
    const renamed = { ...first, name: 'Growbox fan' };

    expect(
      savedBlePlugFromCandidate(
        candidate({
          bleDeviceId: 'temporary-handle-b',
          firmwareId: '1.8.0',
          matterEnabled: true
        }),
        renamed
      )
    ).toMatchObject({
      physicalId: 'shellyplugsg3-aabb',
      name: 'Growbox fan',
      bleDeviceId: 'temporary-handle-b',
      firmwareId: '1.8.0',
      matterEnabled: true
    });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import type { VerifiedPlugBleCandidate } from '../data/plugBleOnboarding.js';
import {
  resetSavedBlePlugStore,
  useSavedBlePlugStore
} from './savedBlePlugStore.js';

const candidate = (patch: Partial<VerifiedPlugBleCandidate> = {}): VerifiedPlugBleCandidate => ({
  bleDeviceId: 'temporary-handle-a',
  advertisementName: 'ShellyPlugSG3-AABB',
  rssi: -42,
  physicalId: 'shellyplugsg3-aabb',
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false,
  ...patch
});

describe('saved BLE plug store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSavedBlePlugStore();
  });

  it('upserts by physical identity rather than BLE locator', () => {
    useSavedBlePlugStore.getState().saveCandidate(candidate());
    useSavedBlePlugStore.getState().renamePlug('shellyplugsg3-aabb', 'Growbox fan');
    useSavedBlePlugStore.getState().saveCandidate(
      candidate({ bleDeviceId: 'temporary-handle-b', firmwareId: '1.8.0' })
    );

    expect(useSavedBlePlugStore.getState().plugs).toHaveLength(1);
    expect(useSavedBlePlugStore.getState().plugs[0]).toMatchObject({
      physicalId: 'shellyplugsg3-aabb',
      name: 'Growbox fan',
      bleDeviceId: 'temporary-handle-b',
      firmwareId: '1.8.0'
    });
  });

  it('removes a BLE-only plug by physical identity', () => {
    useSavedBlePlugStore.getState().saveCandidate(candidate());

    useSavedBlePlugStore.getState().removePlug('SHELLYPLUGSG3-AABB');

    expect(useSavedBlePlugStore.getState().plugs).toEqual([]);
  });
});

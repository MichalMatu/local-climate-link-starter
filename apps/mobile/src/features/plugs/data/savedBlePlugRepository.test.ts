import { describe, expect, it, vi } from 'vitest';
import {
  createSavedBlePlugRepository,
  SAVED_BLE_PLUGS_STORAGE_KEY,
  type SavedBlePlugStorageAdapter
} from './savedBlePlugRepository.js';
import type { SavedBlePlug } from './savedBlePlug.js';

const savedPlug: SavedBlePlug = {
  physicalId: 'shellyplugsg3-aabb',
  name: 'Growbox fan',
  bleDeviceId: 'temporary-handle',
  advertisementName: 'ShellyPlugSG3-AABB',
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false
};

const createStorage = (initial: string | null = null) => {
  let value = initial;
  const storage: SavedBlePlugStorageAdapter = {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key, nextValue) => {
      value = nextValue;
    }),
    removeItem: vi.fn(() => {
      value = null;
    })
  };
  return { storage, read: () => value };
};

describe('saved BLE plug repository', () => {
  it('round-trips a versioned BLE-only registry', () => {
    const memory = createStorage();
    const repository = createSavedBlePlugRepository(memory.storage);

    repository.save([savedPlug]);

    expect(memory.storage.setItem).toHaveBeenCalledWith(
      SAVED_BLE_PLUGS_STORAGE_KEY,
      expect.any(String)
    );
    expect(repository.load()).toEqual([savedPlug]);
    expect(JSON.parse(memory.read() ?? '{}')).toMatchObject({
      version: 1,
      plugs: [savedPlug]
    });
  });

  it('rejects malformed persisted data without leaking it into state', () => {
    const memory = createStorage(
      JSON.stringify({ version: 1, plugs: [{ baseUrl: 'x' }] })
    );
    const repository = createSavedBlePlugRepository(memory.storage);

    expect(repository.load()).toEqual([]);
  });

  it('clears only the BLE registry key', () => {
    const memory = createStorage('stored');
    const repository = createSavedBlePlugRepository(memory.storage);

    repository.clear();

    expect(memory.storage.removeItem).toHaveBeenCalledWith(SAVED_BLE_PLUGS_STORAGE_KEY);
  });
});

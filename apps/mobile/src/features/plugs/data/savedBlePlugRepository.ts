import { z } from 'zod';
import {
  SAVED_BLE_PLUG_VERSION,
  savedBlePlugSchema,
  type SavedBlePlug
} from './savedBlePlug.js';

export const SAVED_BLE_PLUGS_STORAGE_KEY = 'lcl.savedBlePlugs.v1';

const persistedSavedBlePlugsSchema = z.object({
  version: z.literal(SAVED_BLE_PLUG_VERSION),
  plugs: z.array(savedBlePlugSchema)
});

export type SavedBlePlugStorageAdapter = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>;

export interface SavedBlePlugRepository {
  load(): SavedBlePlug[];
  save(plugs: SavedBlePlug[]): void;
  clear(): void;
}

const resolveBrowserStorage = (): SavedBlePlugStorageAdapter | null =>
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;

const warnStorageFailure = (operation: string, error: unknown): void => {
  if (typeof console !== 'undefined') {
    console.warn(`Saved BLE plugs storage ${operation} failed.`, error);
  }
};

export const createSavedBlePlugRepository = (
  storage: SavedBlePlugStorageAdapter | null = resolveBrowserStorage()
): SavedBlePlugRepository => ({
  load: () => {
    if (!storage) return [];

    try {
      const stored = storage.getItem(SAVED_BLE_PLUGS_STORAGE_KEY);
      if (!stored) return [];
      const parsed = persistedSavedBlePlugsSchema.safeParse(JSON.parse(stored));
      return parsed.success ? parsed.data.plugs : [];
    } catch (error) {
      warnStorageFailure('read', error);
      return [];
    }
  },
  save: (plugs) => {
    if (!storage) return;

    try {
      const payload = persistedSavedBlePlugsSchema.parse({
        version: SAVED_BLE_PLUG_VERSION,
        plugs
      });
      storage.setItem(SAVED_BLE_PLUGS_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      warnStorageFailure('write', error);
    }
  },
  clear: () => {
    if (!storage) return;

    try {
      storage.removeItem(SAVED_BLE_PLUGS_STORAGE_KEY);
    } catch (error) {
      warnStorageFailure('clear', error);
    }
  }
});

import { z } from 'zod';
import {
  INSTALLED_AUTOMATION_VERSION,
  installedAutomationSchema,
  type InstalledAutomation
} from './model.js';

export const INSTALLED_AUTOMATIONS_STORAGE_KEY = 'lcl.installedAutomations.v1';

const persistedInstalledAutomationsSchema = z.object({
  version: z.literal(INSTALLED_AUTOMATION_VERSION),
  installations: z.array(installedAutomationSchema)
});

export interface InstalledAutomationRepository {
  load(): InstalledAutomation[];
  save(installations: InstalledAutomation[]): void;
  clear(): void;
}

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const resolveBrowserStorage = (): StorageAdapter | null =>
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;

const warnStorageFailure = (operation: string, error: unknown): void => {
  if (typeof console !== 'undefined') {
    console.warn(`Installed automations storage ${operation} failed.`, error);
  }
};

export const createInstalledAutomationRepository = (
  storage: StorageAdapter | null = resolveBrowserStorage()
): InstalledAutomationRepository => ({
  load: () => {
    if (!storage) {
      return [];
    }

    try {
      const stored = storage.getItem(INSTALLED_AUTOMATIONS_STORAGE_KEY);
      if (!stored) {
        return [];
      }
      const parsed = persistedInstalledAutomationsSchema.safeParse(JSON.parse(stored));
      return parsed.success ? parsed.data.installations : [];
    } catch (error) {
      warnStorageFailure('read', error);
      return [];
    }
  },
  save: (installations) => {
    if (!storage) {
      return;
    }

    try {
      const payload = persistedInstalledAutomationsSchema.parse({
        version: INSTALLED_AUTOMATION_VERSION,
        installations
      });
      storage.setItem(INSTALLED_AUTOMATIONS_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      warnStorageFailure('write', error);
    }
  },
  clear: () => {
    if (!storage) {
      return;
    }

    try {
      storage.removeItem(INSTALLED_AUTOMATIONS_STORAGE_KEY);
    } catch (error) {
      warnStorageFailure('clear', error);
    }
  }
});

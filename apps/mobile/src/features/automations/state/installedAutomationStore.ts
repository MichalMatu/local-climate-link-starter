import { create } from 'zustand';
import type { InstalledAutomation } from '../data/installedAutomation.js';
import {
  createInstalledAutomationRepository,
  type InstalledAutomationRepository
} from '../data/installedAutomationRepository.js';

type InstalledAutomationState = {
  installations: InstalledAutomation[];
  upsertInstallation(installation: InstalledAutomation): void;
  renameShellyDevice(deviceId: string, name: string): void;
  removeInstallation(id: string): void;
};

const repository: InstalledAutomationRepository = createInstalledAutomationRepository();

const sortInstallations = (installations: InstalledAutomation[]): InstalledAutomation[] =>
  [...installations].sort((first, second) => second.updatedAtMs - first.updatedAtMs);

export const useInstalledAutomationStore = create<InstalledAutomationState>((set) => ({
  installations: sortInstallations(repository.load()),
  upsertInstallation: (installation) =>
    set((state) => {
      const existing = state.installations.find((item) => item.id === installation.id);
      const nextInstallation = existing
        ? {
            ...installation,
            installedAtMs: existing.installedAtMs
          }
        : installation;
      const installations = sortInstallations([
        nextInstallation,
        ...state.installations.filter((item) => item.id !== installation.id)
      ]);
      repository.save(installations);
      return { installations };
    }),
  renameShellyDevice: (deviceId, name) =>
    set((state) => {
      const normalizedDeviceId = deviceId.trim().toLowerCase();
      const normalizedName = name.trim();
      if (!normalizedName) {
        return state;
      }

      let changed = false;
      const installations = state.installations.map((installation) => {
        if (
          installation.shelly.deviceId.trim().toLowerCase() !== normalizedDeviceId ||
          installation.shelly.name === normalizedName
        ) {
          return installation;
        }
        changed = true;
        return {
          ...installation,
          shelly: { ...installation.shelly, name: normalizedName }
        };
      });
      if (!changed) {
        return state;
      }
      repository.save(installations);
      return { installations };
    }),
  removeInstallation: (id) =>
    set((state) => {
      const installations = state.installations.filter((item) => item.id !== id);
      repository.save(installations);
      return { installations };
    })
}));

export const resetInstalledAutomationStore = (): void => {
  repository.clear();
  useInstalledAutomationStore.setState({ installations: [] });
};

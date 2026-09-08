import { create } from 'zustand';
import type { InstalledAutomation } from './model.js';
import {
  createInstalledAutomationRepository,
  type InstalledAutomationRepository
} from './repository.js';

type InstalledAutomationState = {
  installations: InstalledAutomation[];
  upsertInstallation(installation: InstalledAutomation): void;
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

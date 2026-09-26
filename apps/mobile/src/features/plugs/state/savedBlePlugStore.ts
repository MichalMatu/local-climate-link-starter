import { create } from 'zustand';
import type { VerifiedPlugBleCandidate } from '../data/plugBleOnboarding.js';
import {
  createSavedBlePlugRepository,
  type SavedBlePlugRepository
} from '../data/savedBlePlugRepository.js';
import { savedBlePlugFromCandidate, type SavedBlePlug } from '../data/savedBlePlug.js';

export type SavedBlePlugState = {
  plugs: SavedBlePlug[];
  saveCandidate(candidate: VerifiedPlugBleCandidate): void;
  replaceLocator(physicalId: string, bleDeviceId: string): void;
  renamePlug(physicalId: string, name: string): void;
  removePlug(physicalId: string): void;
};

const repository: SavedBlePlugRepository = createSavedBlePlugRepository();

const normalizeId = (value: string): string => value.trim().toLowerCase();

export const useSavedBlePlugStore = create<SavedBlePlugState>((set) => ({
  plugs: repository.load(),
  saveCandidate: (candidate) =>
    set((state) => {
      const normalizedId = normalizeId(candidate.physicalId);
      const existing = state.plugs.find(
        (plug) => normalizeId(plug.physicalId) === normalizedId
      );
      const saved = savedBlePlugFromCandidate(candidate, existing);
      const plugs = [
        saved,
        ...state.plugs.filter((plug) => normalizeId(plug.physicalId) !== normalizedId)
      ];
      repository.save(plugs);
      return { plugs };
    }),
  replaceLocator: (physicalId, bleDeviceId) =>
    set((state) => {
      const normalizedId = normalizeId(physicalId);
      const normalizedLocator = bleDeviceId.trim();
      if (!normalizedLocator) return state;

      let changed = false;
      const plugs = state.plugs.map((plug) => {
        if (
          normalizeId(plug.physicalId) !== normalizedId ||
          plug.bleDeviceId === normalizedLocator
        ) {
          return plug;
        }
        changed = true;
        return { ...plug, bleDeviceId: normalizedLocator };
      });
      if (!changed) return state;
      repository.save(plugs);
      return { plugs };
    }),
  renamePlug: (physicalId, name) =>
    set((state) => {
      const normalizedId = normalizeId(physicalId);
      const normalizedName = name.trim();
      if (!normalizedName) return state;

      let changed = false;
      const plugs = state.plugs.map((plug) => {
        if (
          normalizeId(plug.physicalId) !== normalizedId ||
          plug.name === normalizedName
        ) {
          return plug;
        }
        changed = true;
        return { ...plug, name: normalizedName };
      });
      if (!changed) return state;
      repository.save(plugs);
      return { plugs };
    }),
  removePlug: (physicalId) =>
    set((state) => {
      const normalizedId = normalizeId(physicalId);
      const plugs = state.plugs.filter(
        (plug) => normalizeId(plug.physicalId) !== normalizedId
      );
      if (plugs.length === state.plugs.length) return state;
      repository.save(plugs);
      return { plugs };
    })
}));

export const resetSavedBlePlugStore = (): void => {
  repository.clear();
  useSavedBlePlugStore.setState({ plugs: [] });
};

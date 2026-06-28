import { create } from 'zustand';

export type DemoSensorChoice = 'xiaomi_lywsd03mmc_bthome_v2' | 'tp357_custom_v1';

interface SetupDraftState {
  selectedSensorProfileId: DemoSensorChoice;
  onThreshold: number;
  offThreshold: number;
  setSelectedSensorProfileId(profileId: DemoSensorChoice): void;
  setOnThreshold(value: number): void;
  setOffThreshold(value: number): void;
}

export const useSetupDraftStore = create<SetupDraftState>((set) => ({
  selectedSensorProfileId: 'xiaomi_lywsd03mmc_bthome_v2',
  onThreshold: 19,
  offThreshold: 20,
  setSelectedSensorProfileId: (selectedSensorProfileId) =>
    set({ selectedSensorProfileId }),
  setOnThreshold: (onThreshold) => set({ onThreshold }),
  setOffThreshold: (offThreshold) => set({ offThreshold })
}));

import { defaultRuleForPreset, type RulePresetId } from '@lcl/automation-core';
import type { SensorProfileId } from '@lcl/device-profiles';
import { create } from 'zustand';
import {
  createClimateAutomationEditDraftPatch,
  DEFAULT_RULE_ADVANCED_SETTINGS,
  removeSensorSelection,
  selectSensorSelection,
  setAdditionalSensorSelection,
  toggleAdditionalSensorSelection,
  upsertSensorSelection,
  type ClimateInstalledAutomation,
  type SensorDraftActions
} from '../../features/automations/index.js';
import {
  clearStoredHardwareSetupDraft,
  persistHardwareSetupDraftPatch,
  readStoredHardwareSetupDraft,
  type HardwareSetupDraft,
  type SensorDraftDevice,
  type ShellyDraftDevice
} from '../../features/hardware-setup/index.js';

export { HARDWARE_SETUP_DRAFT_STORAGE_KEY } from '../../features/hardware-setup/index.js';
export type {
  HardwareSetupDraft,
  SensorDraftDevice,
  ShellyDraftDevice
} from '../../features/hardware-setup/index.js';

export const DEFAULT_HARDWARE_SETUP_DRAFT: HardwareSetupDraft = {
  shellyNameInput: 'Shelly Plug S Gen3',
  shellyUrlInput: '',
  sensorProfileInput: 'xiaomi_lywsd03mmc_bthome_v2',
  sensorMacInput: '',
  sensorNameInput: '',
  shellyDevices: [],
  sensorDevices: [],
  selectedShellyId: null,
  selectedSensorId: null,
  additionalSensorIds: [],
  inheritedSensorIds: [],
  sensorAggregation: 'avg',
  rulePreset: 'heating',
  onThresholdInput: '19',
  offThresholdInput: '20',
  ...DEFAULT_RULE_ADVANCED_SETTINGS
};

const defaultThresholdInputsForPreset = (
  preset: RulePresetId
): { onThresholdInput: string; offThresholdInput: string } => {
  const rule = defaultRuleForPreset(preset);
  return {
    onThresholdInput: String(rule.control.onThreshold),
    offThresholdInput: String(rule.control.offThreshold)
  };
};

type HardwareSetupDraftState = HardwareSetupDraft &
  SensorDraftActions<SensorDraftDevice> & {
    setShellyNameInput(value: string): void;
    setShellyUrlInput(value: string): void;
    upsertShellyDevice(device: ShellyDraftDevice): void;
    selectShellyDevice(id: string): void;
    setShellyDeviceName(id: string, name: string): void;
    setShellyDeviceMetadata(id: string, metadata: { model: string; gen: number }): void;
    setShellyScriptId(id: string, scriptIdInput: string): void;
    removeShellyDevice(id: string): void;
    setSensorProfileInput(value: SensorProfileId): void;
    setSensorMacInput(value: string): void;
    setSensorNameInput(value: string): void;
    setRulePreset(value: RulePresetId): void;
    setOnThresholdInput(value: string): void;
    setOffThresholdInput(value: string): void;
    setVpdAssistEnabled(value: boolean): void;
    setVpdTargetInput(value: string): void;
    setRssiMinInput(value: string): void;
    setStaleTimeoutMinInput(value: string): void;
    setMinChangeMinInput(value: string): void;
    setMaxOnHoursInput(value: string): void;
    loadClimateAutomationDraft(installation: ClimateInstalledAutomation): void;
  };

const persistPatch = (
  state: HardwareSetupDraftState,
  patch: Partial<HardwareSetupDraft>
): Partial<HardwareSetupDraftState> =>
  persistHardwareSetupDraftPatch(state, patch, DEFAULT_HARDWARE_SETUP_DRAFT);

const persistExplicitSensorPatch = (
  state: HardwareSetupDraftState,
  patch: Partial<HardwareSetupDraft>
): Partial<HardwareSetupDraftState> => {
  const inheritedSensorIds = new Set(state.inheritedSensorIds);
  const explicitPatch =
    patch.additionalSensorIds === undefined
      ? patch
      : {
          ...patch,
          additionalSensorIds: patch.additionalSensorIds.filter(
            (id) => !inheritedSensorIds.has(id)
          )
        };
  return persistPatch(state, {
    ...explicitPatch,
    inheritedSensorIds: []
  });
};

const updateListItem = <TItem extends { id: string }>(
  items: TItem[],
  id: string,
  patch: Partial<TItem>
): TItem[] => items.map((item) => (item.id === id ? { ...item, ...patch } : item));

const normalizeSavedShellyEndpoint = (baseUrl: string): string =>
  baseUrl.trim().replace(/\/+$/, '').toLowerCase();

const isReplacedShellyDevice = (
  current: ShellyDraftDevice,
  verified: ShellyDraftDevice
): boolean =>
  current.id.trim().toLowerCase() === verified.id.trim().toLowerCase() ||
  normalizeSavedShellyEndpoint(current.baseUrl) ===
    normalizeSavedShellyEndpoint(verified.baseUrl);

export const useHardwareSetupDraftStore = create<HardwareSetupDraftState>((set) => {
  const storedDraft = readStoredHardwareSetupDraft(DEFAULT_HARDWARE_SETUP_DRAFT);
  const initialDraft = {
    ...storedDraft,
    shellyNameInput: DEFAULT_HARDWARE_SETUP_DRAFT.shellyNameInput,
    shellyUrlInput: DEFAULT_HARDWARE_SETUP_DRAFT.shellyUrlInput,
    sensorProfileInput: storedDraft.sensorProfileInput,
    sensorMacInput: DEFAULT_HARDWARE_SETUP_DRAFT.sensorMacInput,
    sensorNameInput: DEFAULT_HARDWARE_SETUP_DRAFT.sensorNameInput
  };

  const updateDraft = (patch: Partial<HardwareSetupDraft>) =>
    set((state) => persistPatch(state, patch));

  return {
    ...initialDraft,
    setShellyNameInput: (shellyNameInput) => set({ shellyNameInput }),
    setShellyUrlInput: (shellyUrlInput) => set({ shellyUrlInput }),
    upsertShellyDevice: (device) =>
      set((state) => {
        const patch = {
          shellyNameInput: DEFAULT_HARDWARE_SETUP_DRAFT.shellyNameInput,
          shellyUrlInput: DEFAULT_HARDWARE_SETUP_DRAFT.shellyUrlInput,
          shellyDevices: [
            device,
            ...state.shellyDevices.filter((item) => !isReplacedShellyDevice(item, device))
          ],
          selectedShellyId: device.id
        };
        return persistPatch(state, patch);
      }),
    selectShellyDevice: (id) =>
      set((state) => {
        const device = state.shellyDevices.find((item) => item.id === id);
        if (!device) {
          return state;
        }
        const patch = {
          selectedShellyId: id
        };
        return persistPatch(state, patch);
      }),
    setShellyDeviceName: (id, name) =>
      set((state) => {
        const shellyDevices = updateListItem(state.shellyDevices, id, { name });
        return persistPatch(state, { shellyDevices });
      }),
    setShellyDeviceMetadata: (id, metadata) =>
      set((state) => {
        const shellyDevices = updateListItem(state.shellyDevices, id, metadata);
        return persistPatch(state, { shellyDevices });
      }),
    setShellyScriptId: (id, scriptIdInput) =>
      set((state) => {
        const shellyDevices = updateListItem(state.shellyDevices, id, {
          scriptIdInput
        });
        return persistPatch(state, { shellyDevices });
      }),
    removeShellyDevice: (id) =>
      set((state) => {
        const shellyDevices = state.shellyDevices.filter((item) => item.id !== id);
        if (shellyDevices.length === state.shellyDevices.length) {
          return state;
        }

        const nextSelectedShellyId =
          state.selectedShellyId === id
            ? (shellyDevices[0]?.id ?? null)
            : state.selectedShellyId;

        return persistPatch(state, {
          shellyDevices,
          selectedShellyId: nextSelectedShellyId
        });
      }),
    setSensorProfileInput: (sensorProfileInput) => set({ sensorProfileInput }),
    setSensorMacInput: (sensorMacInput) => set({ sensorMacInput }),
    setSensorNameInput: (sensorNameInput) => set({ sensorNameInput }),
    upsertSensorDevice: (device) =>
      set((state) =>
        persistExplicitSensorPatch(state, {
          sensorMacInput: DEFAULT_HARDWARE_SETUP_DRAFT.sensorMacInput,
          sensorNameInput: DEFAULT_HARDWARE_SETUP_DRAFT.sensorNameInput,
          ...upsertSensorSelection(state, device)
        })
      ),
    selectSensorDevice: (id) =>
      set((state) => {
        const patch = selectSensorSelection(state, id);
        return patch ? persistExplicitSensorPatch(state, patch) : state;
      }),
    setAdditionalSensorIds: (ids) =>
      set((state) =>
        persistPatch(state, {
          ...setAdditionalSensorSelection(state, ids),
          inheritedSensorIds: []
        })
      ),
    toggleAdditionalSensorDevice: (id) =>
      set((state) => {
        const patch = toggleAdditionalSensorSelection(state, id);
        return patch ? persistExplicitSensorPatch(state, patch) : state;
      }),
    setSensorAggregation: (sensorAggregation) => updateDraft({ sensorAggregation }),
    setSensorDeviceName: (id, name) =>
      set((state) => {
        const sensorDevices = updateListItem(state.sensorDevices, id, { name });
        return persistPatch(state, { sensorDevices });
      }),
    removeSensorDevice: (id) =>
      set((state) => {
        const patch = removeSensorSelection(state, id);
        return patch ? persistExplicitSensorPatch(state, patch) : state;
      }),
    setRulePreset: (rulePreset) => {
      const thresholds = defaultThresholdInputsForPreset(rulePreset);
      updateDraft({ rulePreset, ...thresholds });
    },
    setOnThresholdInput: (onThresholdInput) => updateDraft({ onThresholdInput }),
    setOffThresholdInput: (offThresholdInput) => updateDraft({ offThresholdInput }),
    setVpdAssistEnabled: (vpdAssistEnabled) => updateDraft({ vpdAssistEnabled }),
    setVpdTargetInput: (vpdTargetInput) => updateDraft({ vpdTargetInput }),
    setRssiMinInput: (rssiMinInput) => updateDraft({ rssiMinInput }),
    setStaleTimeoutMinInput: (staleTimeoutMinInput) =>
      updateDraft({ staleTimeoutMinInput }),
    setMinChangeMinInput: (minChangeMinInput) => updateDraft({ minChangeMinInput }),
    setMaxOnHoursInput: (maxOnHoursInput) => updateDraft({ maxOnHoursInput }),
    loadClimateAutomationDraft: (installation) =>
      set((state) =>
        persistPatch(state, createClimateAutomationEditDraftPatch(state, installation))
      )
  };
});

export const resetHardwareSetupDraftStore = () => {
  clearStoredHardwareSetupDraft();
  useHardwareSetupDraftStore.setState(DEFAULT_HARDWARE_SETUP_DRAFT);
};

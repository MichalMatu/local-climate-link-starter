import { defaultRuleForPreset, type RulePresetId } from '@lcl/automation-core';
import { sensorProfileIdSchema, type SensorProfileId } from '@lcl/device-profiles';
import { create } from 'zustand';
import { z } from 'zod';
import { DEFAULT_RULE_ADVANCED_SETTINGS } from './ruleAdvancedSettings.js';

export const HARDWARE_SETUP_DRAFT_STORAGE_KEY = 'lcl.hardwareSetupDraft.v7';

const rulePresetSchema = z.enum(['heating', 'cooling', 'humidifying', 'dehumidifying']);

const defaultThresholdInputsForPreset = (
  preset: RulePresetId
): { onThresholdInput: string; offThresholdInput: string } => {
  const rule = defaultRuleForPreset(preset);
  return {
    onThresholdInput: String(rule.control.onThreshold),
    offThresholdInput: String(rule.control.offThreshold)
  };
};

const shellyDraftDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  scriptIdInput: z.string()
});

const sensorDraftDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  runtimeAddress: z.string(),
  profileId: sensorProfileIdSchema
});

const hardwareSetupDraftSchema = z.object({
  shellyNameInput: z.string(),
  shellyUrlInput: z.string(),
  sensorProfileInput: sensorProfileIdSchema,
  sensorMacInput: z.string(),
  sensorNameInput: z.string(),
  shellyDevices: z.array(shellyDraftDeviceSchema),
  sensorDevices: z.array(sensorDraftDeviceSchema),
  selectedShellyId: z.string().nullable(),
  selectedSensorId: z.string().nullable(),
  diagnosticShellyId: z.string().nullable(),
  rulePreset: rulePresetSchema,
  onThresholdInput: z.string(),
  offThresholdInput: z.string(),
  vpdAssistEnabled: z.boolean(),
  vpdTargetInput: z.string(),
  rssiMinInput: z.string(),
  staleTimeoutMinInput: z.string(),
  minChangeMinInput: z.string(),
  maxOnHoursInput: z.string()
});

export type ShellyDraftDevice = z.infer<typeof shellyDraftDeviceSchema>;
export type SensorDraftDevice = z.infer<typeof sensorDraftDeviceSchema>;
export type HardwareSetupDraft = z.infer<typeof hardwareSetupDraftSchema>;

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
  diagnosticShellyId: null,
  rulePreset: 'heating',
  onThresholdInput: '19',
  offThresholdInput: '20',
  ...DEFAULT_RULE_ADVANCED_SETTINGS
};

type HardwareSetupDraftState = HardwareSetupDraft & {
  setShellyNameInput(value: string): void;
  setShellyUrlInput(value: string): void;
  upsertShellyDevice(device: ShellyDraftDevice): void;
  selectShellyDevice(id: string): void;
  setShellyDeviceName(id: string, name: string): void;
  setShellyScriptId(id: string, scriptIdInput: string): void;
  removeShellyDevice(id: string): void;
  setDiagnosticShellyId(id: string): void;
  setSensorProfileInput(value: SensorProfileId): void;
  setSensorMacInput(value: string): void;
  setSensorNameInput(value: string): void;
  upsertSensorDevice(device: SensorDraftDevice): void;
  selectSensorDevice(id: string): void;
  setSensorDeviceName(id: string, name: string): void;
  removeSensorDevice(id: string): void;
  setRulePreset(value: RulePresetId): void;
  setOnThresholdInput(value: string): void;
  setOffThresholdInput(value: string): void;
  setVpdAssistEnabled(value: boolean): void;
  setVpdTargetInput(value: string): void;
  setRssiMinInput(value: string): void;
  setStaleTimeoutMinInput(value: string): void;
  setMinChangeMinInput(value: string): void;
  setMaxOnHoursInput(value: string): void;
};

const isStorageAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readStoredDraft = (): HardwareSetupDraft => {
  if (!isStorageAvailable()) {
    return DEFAULT_HARDWARE_SETUP_DRAFT;
  }

  try {
    const stored = window.localStorage.getItem(HARDWARE_SETUP_DRAFT_STORAGE_KEY);
    return stored
      ? hardwareSetupDraftSchema.parse(JSON.parse(stored))
      : DEFAULT_HARDWARE_SETUP_DRAFT;
  } catch {
    return DEFAULT_HARDWARE_SETUP_DRAFT;
  }
};

const saveDraft = (draft: HardwareSetupDraft): void => {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.setItem(HARDWARE_SETUP_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    return;
  }
};

const createStoredDraft = (
  state: HardwareSetupDraftState,
  patch: Partial<HardwareSetupDraft> = {}
): HardwareSetupDraft => ({
  shellyNameInput: DEFAULT_HARDWARE_SETUP_DRAFT.shellyNameInput,
  shellyUrlInput: DEFAULT_HARDWARE_SETUP_DRAFT.shellyUrlInput,
  sensorProfileInput:
    patch.sensorProfileInput ?? DEFAULT_HARDWARE_SETUP_DRAFT.sensorProfileInput,
  sensorMacInput: DEFAULT_HARDWARE_SETUP_DRAFT.sensorMacInput,
  sensorNameInput: DEFAULT_HARDWARE_SETUP_DRAFT.sensorNameInput,
  shellyDevices: patch.shellyDevices ?? state.shellyDevices,
  sensorDevices: patch.sensorDevices ?? state.sensorDevices,
  selectedShellyId:
    'selectedShellyId' in patch
      ? (patch.selectedShellyId ?? null)
      : state.selectedShellyId,
  selectedSensorId:
    'selectedSensorId' in patch
      ? (patch.selectedSensorId ?? null)
      : state.selectedSensorId,
  diagnosticShellyId:
    'diagnosticShellyId' in patch
      ? (patch.diagnosticShellyId ?? null)
      : state.diagnosticShellyId,
  rulePreset: patch.rulePreset ?? state.rulePreset,
  onThresholdInput: patch.onThresholdInput ?? state.onThresholdInput,
  offThresholdInput: patch.offThresholdInput ?? state.offThresholdInput,
  vpdAssistEnabled: patch.vpdAssistEnabled ?? state.vpdAssistEnabled,
  vpdTargetInput: patch.vpdTargetInput ?? state.vpdTargetInput,
  rssiMinInput: patch.rssiMinInput ?? state.rssiMinInput,
  staleTimeoutMinInput: patch.staleTimeoutMinInput ?? state.staleTimeoutMinInput,
  minChangeMinInput: patch.minChangeMinInput ?? state.minChangeMinInput,
  maxOnHoursInput: patch.maxOnHoursInput ?? state.maxOnHoursInput
});

const persistPatch = (
  state: HardwareSetupDraftState,
  patch: Partial<HardwareSetupDraft>
): Partial<HardwareSetupDraftState> => {
  saveDraft(createStoredDraft(state, patch));
  return patch;
};

const updateListItem = <TItem extends { id: string }>(
  items: TItem[],
  id: string,
  patch: Partial<TItem>
): TItem[] => items.map((item) => (item.id === id ? { ...item, ...patch } : item));

export const useHardwareSetupDraftStore = create<HardwareSetupDraftState>((set) => {
  const storedDraft = readStoredDraft();
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
            ...state.shellyDevices.filter((item) => item.id !== device.id)
          ],
          selectedShellyId: device.id,
          diagnosticShellyId: device.id
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
          selectedShellyId: id,
          diagnosticShellyId: id
        };
        return persistPatch(state, patch);
      }),
    setShellyDeviceName: (id, name) =>
      set((state) => {
        const shellyDevices = updateListItem(state.shellyDevices, id, { name });
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
        const nextDiagnosticShellyId =
          state.diagnosticShellyId === id
            ? (nextSelectedShellyId ?? shellyDevices[0]?.id ?? null)
            : state.diagnosticShellyId;

        return persistPatch(state, {
          shellyDevices,
          selectedShellyId: nextSelectedShellyId,
          diagnosticShellyId: nextDiagnosticShellyId
        });
      }),
    setDiagnosticShellyId: (diagnosticShellyId) => updateDraft({ diagnosticShellyId }),
    setSensorProfileInput: (sensorProfileInput) => set({ sensorProfileInput }),
    setSensorMacInput: (sensorMacInput) => set({ sensorMacInput }),
    setSensorNameInput: (sensorNameInput) => set({ sensorNameInput }),
    upsertSensorDevice: (device) =>
      set((state) => {
        const patch = {
          sensorMacInput: DEFAULT_HARDWARE_SETUP_DRAFT.sensorMacInput,
          sensorNameInput: DEFAULT_HARDWARE_SETUP_DRAFT.sensorNameInput,
          sensorDevices: [
            device,
            ...state.sensorDevices.filter((item) => item.id !== device.id)
          ],
          selectedSensorId: device.id
        };
        return persistPatch(state, patch);
      }),
    selectSensorDevice: (id) =>
      set((state) => {
        const device = state.sensorDevices.find((item) => item.id === id);
        if (!device) {
          return state;
        }
        const patch = {
          selectedSensorId: id
        };
        return persistPatch(state, patch);
      }),
    setSensorDeviceName: (id, name) =>
      set((state) => {
        const sensorDevices = updateListItem(state.sensorDevices, id, { name });
        return persistPatch(state, { sensorDevices });
      }),
    removeSensorDevice: (id) =>
      set((state) => {
        const sensorDevices = state.sensorDevices.filter((item) => item.id !== id);
        if (sensorDevices.length === state.sensorDevices.length) {
          return state;
        }

        const selectedSensorId =
          state.selectedSensorId === id
            ? (sensorDevices[0]?.id ?? null)
            : state.selectedSensorId;

        return persistPatch(state, { sensorDevices, selectedSensorId });
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
    setMaxOnHoursInput: (maxOnHoursInput) => updateDraft({ maxOnHoursInput })
  };
});

export const resetHardwareSetupDraftStore = () => {
  if (isStorageAvailable()) {
    window.localStorage.removeItem(HARDWARE_SETUP_DRAFT_STORAGE_KEY);
  }

  useHardwareSetupDraftStore.setState({
    ...DEFAULT_HARDWARE_SETUP_DRAFT
  });
};

import { sensorProfileIdSchema } from '@lcl/device-profiles';
import {
  climateSensorAggregationSchema,
  MAX_CLIMATE_SENSORS
} from '@lcl/script-generator';
import { z } from 'zod';
import { DEFAULT_RULE_ADVANCED_SETTINGS } from '../../features/automations/index.js';

export const HARDWARE_SETUP_DRAFT_STORAGE_KEY = 'lcl.hardwareSetupDraft.v9';

const rulePresetSchema = z.enum(['heating', 'cooling', 'humidifying', 'dehumidifying']);

const shellyDraftDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  scriptIdInput: z.string(),
  model: z.string().optional(),
  gen: z.number().int().nonnegative().optional()
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
  additionalSensorIds: z.array(z.string()).max(MAX_CLIMATE_SENSORS - 1),
  sensorAggregation: climateSensorAggregationSchema,
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
  additionalSensorIds: [],
  sensorAggregation: 'avg',
  rulePreset: 'heating',
  onThresholdInput: '19',
  offThresholdInput: '20',
  ...DEFAULT_RULE_ADVANCED_SETTINGS
};

const isStorageAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const readStoredHardwareSetupDraft = (): HardwareSetupDraft => {
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

const saveHardwareSetupDraft = (draft: HardwareSetupDraft): void => {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.setItem(HARDWARE_SETUP_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    return;
  }
};

const createStoredHardwareSetupDraft = (
  state: HardwareSetupDraft,
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
  additionalSensorIds: patch.additionalSensorIds ?? state.additionalSensorIds,
  sensorAggregation: patch.sensorAggregation ?? state.sensorAggregation,
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

export const persistHardwareSetupDraftPatch = (
  state: HardwareSetupDraft,
  patch: Partial<HardwareSetupDraft>
): Partial<HardwareSetupDraft> => {
  saveHardwareSetupDraft(createStoredHardwareSetupDraft(state, patch));
  return patch;
};

export const clearStoredHardwareSetupDraft = (): void => {
  if (isStorageAvailable()) {
    window.localStorage.removeItem(HARDWARE_SETUP_DRAFT_STORAGE_KEY);
  }
};

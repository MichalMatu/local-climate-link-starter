import { sensorProfileIdSchema } from '@lcl/device-profiles';
import {
  climateSensorAggregationSchema,
  MAX_CLIMATE_SENSORS
} from '@lcl/script-generator';
import { z } from 'zod';

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
  inheritedSensorIds: z.array(z.string()).max(MAX_CLIMATE_SENSORS).default([]),
  inheritedSensorSourceId: z.string().nullable().default(null),
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

const isStorageAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const readStoredHardwareSetupDraft = (
  fallback: HardwareSetupDraft
): HardwareSetupDraft => {
  if (!isStorageAvailable()) {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(HARDWARE_SETUP_DRAFT_STORAGE_KEY);
    return stored ? hardwareSetupDraftSchema.parse(JSON.parse(stored)) : fallback;
  } catch {
    return fallback;
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
  patch: Partial<HardwareSetupDraft>,
  fallback: HardwareSetupDraft
): HardwareSetupDraft => ({
  shellyNameInput: fallback.shellyNameInput,
  shellyUrlInput: fallback.shellyUrlInput,
  sensorProfileInput: patch.sensorProfileInput ?? fallback.sensorProfileInput,
  sensorMacInput: fallback.sensorMacInput,
  sensorNameInput: fallback.sensorNameInput,
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
  inheritedSensorIds: patch.inheritedSensorIds ?? state.inheritedSensorIds,
  inheritedSensorSourceId: patch.inheritedSensorSourceId ?? state.inheritedSensorSourceId,
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
  patch: Partial<HardwareSetupDraft>,
  fallback: HardwareSetupDraft
): Partial<HardwareSetupDraft> => {
  saveHardwareSetupDraft(createStoredHardwareSetupDraft(state, patch, fallback));
  return patch;
};

export const clearStoredHardwareSetupDraft = (): void => {
  if (isStorageAvailable()) {
    window.localStorage.removeItem(HARDWARE_SETUP_DRAFT_STORAGE_KEY);
  }
};

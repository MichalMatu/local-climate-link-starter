export {
  HARDWARE_SETUP_DRAFT_STORAGE_KEY,
  clearStoredHardwareSetupDraft,
  persistHardwareSetupDraftPatch,
  readStoredHardwareSetupDraft
} from './data/setupDraftPersistence.js';
export { mergeRecoveredSensorRegistry } from './data/recoveredSensorRegistry.js';
export type {
  HardwareSetupDraft,
  SensorDraftDevice,
  ShellyDraftDevice
} from './data/setupDraftPersistence.js';

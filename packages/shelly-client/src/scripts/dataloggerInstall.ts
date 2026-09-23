import {
  LOCAL_CLIMATE_LINK_DATALOGGER_SCRIPT_NAME,
  type ShellyInstallPlan
} from '../model.js';
import { DEFAULT_PUT_CODE_CHUNK_SIZE_BYTES } from './installLifecycle.js';

export const createDataloggerInstallPlan = (code: string): ShellyInstallPlan => ({
  scriptName: LOCAL_CLIMATE_LINK_DATALOGGER_SCRIPT_NAME,
  code,
  runOnBoot: true,
  backupExisting: false,
  chunkSizeBytes: DEFAULT_PUT_CODE_CHUNK_SIZE_BYTES,
  cleanupBleScannerBeforeStop: false
});

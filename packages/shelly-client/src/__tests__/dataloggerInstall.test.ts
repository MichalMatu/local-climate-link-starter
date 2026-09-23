import { describe, expect, it } from 'vitest';
import {
  LOCAL_CLIMATE_LINK_DATALOGGER_SCRIPT_NAME,
  createDataloggerInstallPlan
} from '../index.js';

describe('datalogger install plan', () => {
  it('creates an isolated run-on-boot managed script plan', () => {
    expect(createDataloggerInstallPlan('// logger')).toEqual({
      scriptName: LOCAL_CLIMATE_LINK_DATALOGGER_SCRIPT_NAME,
      code: '// logger',
      runOnBoot: true,
      backupExisting: false,
      chunkSizeBytes: 1024,
      cleanupBleScannerBeforeStop: false
    });
  });
});

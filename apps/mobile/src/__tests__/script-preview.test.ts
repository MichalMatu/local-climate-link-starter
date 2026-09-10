import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstalledAutomation } from '../flows/installations/model.js';
import { loadInstalledAutomationScriptSource } from '../flows/installations/scriptPreview.js';

const readShellyAutomationScriptState = vi.hoisted(() => vi.fn());

vi.mock('../flows/hardware-setup/shellyRequests.js', () => ({
  readShellyAutomationScriptState
}));

const installation = () => {
  const config = createDefaultShellyThermostatConfig(
    'xiaomi_lywsd03mmc_bthome_v2',
    'heating'
  );

  return createInstalledAutomation({
    shelly: { id: 'shelly-preview', model: 'S3PL-00112EU', gen: 3 },
    shellyName: 'Salon',
    baseUrl: 'http://192.168.0.20/',
    scriptId: 7,
    scriptHash: 'lcl-preview',
    config,
    nowMs: 1000
  });
};

const scriptState = (scriptId: number | null, code: string | null) => ({
  script:
    scriptId === null
      ? null
      : {
          id: scriptId,
          name: 'Local Climate Link Thermostat',
          enable: true,
          running: true
        },
  code,
  status: {
    relayOn: false,
    automationMode: scriptId === null ? 'missing' : 'auto',
    automationScriptId: scriptId,
    firmwareId: null,
    telemetry: {},
    clock: { timeSynced: true }
  }
});

describe('loadInstalledAutomationScriptSource', () => {
  beforeEach(() => {
    readShellyAutomationScriptState.mockReset();
  });

  it('returns source only when Shelly reports the exact stored script id', async () => {
    const saved = installation();
    readShellyAutomationScriptState.mockResolvedValue(
      scriptState(saved.script.id, '// deployed source')
    );

    await expect(loadInstalledAutomationScriptSource(saved)).resolves.toBe(
      '// deployed source'
    );
    expect(readShellyAutomationScriptState).toHaveBeenCalledWith(saved.shelly.baseUrl);
  });

  it('rejects source from a different Local Climate Link script id', async () => {
    const saved = installation();
    readShellyAutomationScriptState.mockResolvedValue(
      scriptState(saved.script.id + 1, '// wrong source')
    );

    await expect(loadInstalledAutomationScriptSource(saved)).rejects.toThrow(
      'exact managed automation script'
    );
  });

  it('rejects a missing deployed script', async () => {
    const saved = installation();
    readShellyAutomationScriptState.mockResolvedValue(scriptState(null, null));

    await expect(loadInstalledAutomationScriptSource(saved)).rejects.toThrow(
      'exact managed automation script'
    );
  });
});

import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstalledAutomation } from '../flows/installations/model.js';
import { loadInstalledAutomationScriptSource } from '../flows/installations/scriptPreview.js';

const readShellyManagedAutomationScriptCode = vi.hoisted(() => vi.fn());

vi.mock('../flows/hardware-setup/shellyRequests.js', () => ({
  readShellyManagedAutomationScriptCode
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

describe('loadInstalledAutomationScriptSource', () => {
  beforeEach(() => {
    readShellyManagedAutomationScriptCode.mockReset();
  });

  it('reads source using the exact stored Shelly script id', async () => {
    const saved = installation();
    readShellyManagedAutomationScriptCode.mockResolvedValue('// deployed source');

    await expect(loadInstalledAutomationScriptSource(saved)).resolves.toBe(
      '// deployed source'
    );
    expect(readShellyManagedAutomationScriptCode).toHaveBeenCalledWith(
      saved.shelly.baseUrl,
      saved.script.id
    );
  });
});

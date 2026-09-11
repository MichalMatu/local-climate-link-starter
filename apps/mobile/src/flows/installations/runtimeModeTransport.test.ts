import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import type * as ShellyRequestsModule from '../hardware-setup/shellyRequests.js';
import { createInstalledAutomation } from './model.js';

const mocks = vi.hoisted(() => ({ call: vi.fn() }));

vi.mock('../hardware-setup/shellyRequests.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyRequestsModule>();
  return {
    ...actual,
    createShellyTransport: vi.fn(() => ({ call: mocks.call }))
  };
});

import {
  readInstalledAutomationRuntimeMode,
  setInstalledAutomationRuntimeMode
} from './runtimeModeTransport.js';

const installation = createInstalledAutomation({
  shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Salon',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: 'hash',
  config: createDefaultShellyThermostatConfig(),
  nowMs: 1000
});

describe('runtime mode Script.Eval transport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets MANUAL inside the running script and verifies the eval result', async () => {
    mocks.call.mockResolvedValue({ ok: true, value: { result: '1' } });

    await setInstalledAutomationRuntimeMode(installation, 'manual');

    expect(mocks.call).toHaveBeenCalledWith({
      method: 'Script.Eval',
      params: {
        id: 7,
        code: expect.stringContaining('R.m=1')
      }
    });
  });

  it('reads live MANUAL/AUTO state without using Script.Stop', async () => {
    mocks.call.mockResolvedValueOnce({ ok: true, value: { result: '1' } });
    await expect(readInstalledAutomationRuntimeMode(installation)).resolves.toEqual({
      mode: 'manual',
      supported: true
    });

    mocks.call.mockResolvedValueOnce({ ok: true, value: { result: '0' } });
    await expect(readInstalledAutomationRuntimeMode(installation)).resolves.toEqual({
      mode: 'auto',
      supported: true
    });
  });

  it('marks an older running runtime as unsupported instead of calling it MANUAL', async () => {
    mocks.call.mockResolvedValue({ ok: true, value: { result: '-1' } });

    await expect(readInstalledAutomationRuntimeMode(installation)).resolves.toEqual({
      mode: 'auto',
      supported: false
    });
  });
});

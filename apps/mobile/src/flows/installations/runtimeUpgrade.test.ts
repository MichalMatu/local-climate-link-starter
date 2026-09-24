import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import type * as ShellyClientModule from '@lcl/shelly-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RuntimeStatusModule from './runtimeStatus.js';
import { createInstalledAutomation } from './model.js';

const mocks = vi.hoisted(() => ({
  getDeviceInfo: vi.fn(),
  installScript: vi.fn(),
  setRelayOff: vi.fn(),
  getStatus: vi.fn(),
  readInstalledStatus: vi.fn()
}));

vi.mock('@lcl/shelly-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyClientModule>();
  return {
    ...actual,
    RpcShellyClient: vi.fn(() => ({
      getDeviceInfo: mocks.getDeviceInfo,
      installScript: mocks.installScript,
      setRelayOff: mocks.setRelayOff,
      getStatus: mocks.getStatus
    }))
  };
});

vi.mock('./runtimeStatus.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeStatusModule>();
  return { ...actual, readInstalledAutomationControlStatus: mocks.readInstalledStatus };
});

import {
  ensureInstalledAutomationRuntimeCurrent,
  recoverInstalledAutomationRuntime
} from './runtimeUpgrade.js';

const installation = createInstalledAutomation({
  shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Salon',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: 'stale-development-hash',
  config: createDefaultShellyThermostatConfig(),
  nowMs: 1000
});

const runtimeStatus = (scriptId: number | null, mode: 'auto' | 'manual' | 'missing') => ({
  relayOn: false,
  automationMode: mode,
  automationScriptId: scriptId,
  firmwareId: '1.0.0',
  telemetry: {},
  clock: { timeSynced: false },
  runtimeModeSupported: mode === 'auto' || mode === 'manual'
});

describe('installed automation runtime replacement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDeviceInfo.mockResolvedValue({
      ok: true,
      value: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 }
    });
    mocks.setRelayOff.mockResolvedValue({ ok: true, value: null });
    mocks.getStatus.mockResolvedValue({ ok: true, value: { relayOn: false } });
    mocks.installScript.mockResolvedValue({
      ok: true,
      value: { scriptId: 11, scriptHash: 'fresh-code-hash', running: true }
    });
  });

  it('rejects runtime preparation before any mutation on a different physical Shelly', async () => {
    mocks.getDeviceInfo.mockResolvedValue({
      ok: true,
      value: { id: 'shelly-b', model: 'S3PL-00112EU', gen: 3 }
    });

    await expect(ensureInstalledAutomationRuntimeCurrent(installation)).rejects.toThrow(
      'Shelly identity does not match the installed automation.'
    );
    expect(mocks.readInstalledStatus).not.toHaveBeenCalled();
    expect(mocks.setRelayOff).not.toHaveBeenCalled();
    expect(mocks.installScript).not.toHaveBeenCalled();
  });

  it('rejects explicit recovery before any mutation on a different physical Shelly', async () => {
    mocks.getDeviceInfo.mockResolvedValue({
      ok: true,
      value: { id: 'shelly-b', model: 'S3PL-00112EU', gen: 3 }
    });

    await expect(recoverInstalledAutomationRuntime(installation)).rejects.toThrow(
      'Shelly identity does not match the installed automation.'
    );
    expect(mocks.setRelayOff).not.toHaveBeenCalled();
    expect(mocks.installScript).not.toHaveBeenCalled();
  });

  it('keeps a healthy current runtime without replacing it', async () => {
    mocks.readInstalledStatus.mockResolvedValue(runtimeStatus(7, 'auto'));

    const result = await ensureInstalledAutomationRuntimeCurrent(installation);

    expect(result).toEqual({
      installation,
      status: runtimeStatus(7, 'auto'),
      upgraded: false
    });
    expect(mocks.installScript).not.toHaveBeenCalled();
  });

  it('replaces stale script identity instead of refusing recovery', async () => {
    mocks.readInstalledStatus
      .mockResolvedValueOnce(runtimeStatus(99, 'auto'))
      .mockResolvedValueOnce(runtimeStatus(11, 'auto'));

    const result = await ensureInstalledAutomationRuntimeCurrent(installation);

    expect(mocks.installScript).toHaveBeenCalledWith(
      expect.objectContaining({
        replaceAllScripts: true,
        scriptName: 'Shelly Link Thermostat'
      })
    );
    expect(result.upgraded).toBe(true);
    expect(result.installation.script).toEqual({ id: 11, hash: 'fresh-code-hash' });
    expect(result.status.automationScriptId).toBe(11);
    expect(mocks.setRelayOff).toHaveBeenCalledTimes(2);
  });

  it('explicit recovery replaces the runtime even when the stored id is obsolete', async () => {
    mocks.readInstalledStatus.mockResolvedValue(runtimeStatus(11, 'auto'));

    const result = await recoverInstalledAutomationRuntime({
      ...installation,
      script: { id: 999, hash: 'obsolete' }
    });

    expect(result.installation.script).toEqual({ id: 11, hash: 'fresh-code-hash' });
    expect(mocks.installScript).toHaveBeenCalledTimes(1);
  });
});

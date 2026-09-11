import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import type * as ShellyClientModule from '@lcl/shelly-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RuntimeModeModule from './runtimeModeTransport.js';
import type * as RuntimeStatusModule from './runtimeStatus.js';
import type * as RuntimeUpgradeModule from './runtimeUpgrade.js';
import { createInstalledAutomation } from './model.js';

const mocks = vi.hoisted(() => ({
  setRelayOn: vi.fn(),
  setRelayOff: vi.fn(),
  getStatus: vi.fn(),
  readStatus: vi.fn(),
  setRuntimeMode: vi.fn(),
  ensureCurrent: vi.fn(),
  recoverRuntime: vi.fn()
}));

vi.mock('@lcl/shelly-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyClientModule>();
  return {
    ...actual,
    RpcShellyClient: vi.fn(() => ({
      setRelayOn: mocks.setRelayOn,
      setRelayOff: mocks.setRelayOff,
      getStatus: mocks.getStatus
    }))
  };
});

vi.mock('./runtimeModeTransport.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeModeModule>();
  return { ...actual, setInstalledAutomationRuntimeMode: mocks.setRuntimeMode };
});

vi.mock('./runtimeStatus.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeStatusModule>();
  return { ...actual, readInstalledAutomationControlStatus: mocks.readStatus };
});

vi.mock('./runtimeUpgrade.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeUpgradeModule>();
  return {
    ...actual,
    ensureInstalledAutomationRuntimeCurrent: mocks.ensureCurrent,
    recoverInstalledAutomationRuntime: mocks.recoverRuntime
  };
});

import {
  installedAutomationScriptMatch,
  pauseInstalledAutomation,
  resumeInstalledAutomation,
  setInstalledAutomationRelayState
} from './runtimeControl.js';

const installation = createInstalledAutomation({
  shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Salon',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: 'hash',
  config: createDefaultShellyThermostatConfig(),
  nowMs: 1000
});

const status = (mode: 'auto' | 'manual' | 'stopped' | 'missing', relayOn = false) => ({
  relayOn,
  automationMode: mode,
  automationScriptId: mode === 'missing' ? null : 7,
  firmwareId: '1.0.0',
  telemetry: {},
  clock: { timeSynced: false },
  runtimeModeSupported: mode === 'auto' || mode === 'manual'
});

describe('installed automation runtime control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setRelayOn.mockResolvedValue({ ok: true, value: null });
    mocks.setRelayOff.mockResolvedValue({ ok: true, value: null });
    mocks.getStatus.mockResolvedValue({ ok: true, value: { relayOn: false } });
  });

  it('matches ownership only by the stored script id', () => {
    expect(installedAutomationScriptMatch(installation, status('auto'))).toBe('matched');
    expect(installedAutomationScriptMatch(installation, status('missing'))).toBe(
      'missing'
    );
  });

  it('enters MANUAL through the live runtime without Script.Stop', async () => {
    mocks.ensureCurrent.mockResolvedValue({
      installation,
      status: status('auto'),
      upgraded: false
    });
    mocks.readStatus.mockResolvedValue(status('manual'));

    const result = await pauseInstalledAutomation(installation);

    expect(mocks.setRuntimeMode).toHaveBeenCalledWith(installation, 'manual');
    expect(result.status.automationMode).toBe('manual');
    expect(result.status.relayOn).toBe(false);
  });

  it('returns to AUTO through the live runtime without Script.Start', async () => {
    mocks.ensureCurrent.mockResolvedValue({
      installation,
      status: status('manual'),
      upgraded: false
    });
    mocks.readStatus.mockResolvedValue(status('auto'));

    const result = await resumeInstalledAutomation(installation);

    expect(mocks.setRuntimeMode).toHaveBeenCalledWith(installation, 'auto');
    expect(result.status.automationMode).toBe('auto');
    expect(result.status.relayOn).toBe(false);
  });

  it('keeps direct relay control gated by a live MANUAL runtime', async () => {
    mocks.readStatus
      .mockResolvedValueOnce(status('manual', false))
      .mockResolvedValueOnce(status('manual', true));

    const result = await setInstalledAutomationRelayState(installation, true);

    expect(mocks.setRelayOn).toHaveBeenCalledWith({ relayId: 0 });
    expect(result.status.relayOn).toBe(true);
  });

  it('rejects direct relay control when the process is actually stopped', async () => {
    mocks.readStatus.mockResolvedValue(status('stopped'));

    await expect(setInstalledAutomationRelayState(installation, true)).rejects.toThrow(
      'live MANUAL automation runtime'
    );
    expect(mocks.setRelayOn).not.toHaveBeenCalled();
  });
});

import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import type * as ShellyClientModule from '@lcl/shelly-client';
import type * as ShellyRequestsModule from '../hardware-setup/shellyRequests.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstalledAutomation } from './model.js';

const mocks = vi.hoisted(() => ({
  stopScript: vi.fn(),
  startScript: vi.fn(),
  setRelayOn: vi.fn(),
  setRelayOff: vi.fn(),
  getStatus: vi.fn(),
  readControlStatus: vi.fn()
}));

vi.mock('@lcl/shelly-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyClientModule>();
  return {
    ...actual,
    RpcShellyClient: vi.fn(() => ({
      stopScript: mocks.stopScript,
      startScript: mocks.startScript,
      setRelayOn: mocks.setRelayOn,
      setRelayOff: mocks.setRelayOff,
      getStatus: mocks.getStatus
    }))
  };
});

vi.mock('../hardware-setup/shellyRequests.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyRequestsModule>();
  return {
    ...actual,
    createShellyTransport: vi.fn(() => ({})),
    readShellyControlStatus: mocks.readControlStatus
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
  config: createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2', 'heating'),
  nowMs: 1000
});

const controlStatus = (
  automationMode: 'auto' | 'manual' | 'missing',
  automationScriptId: number | null,
  relayOn = false
) => ({
  relayOn,
  automationMode,
  automationScriptId,
  firmwareId: '1.0.0',
  telemetry: {},
  clock: { timeSynced: false }
});

describe('installed automation runtime control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stopScript.mockResolvedValue({ ok: true, value: null });
    mocks.startScript.mockResolvedValue({ ok: true, value: null });
    mocks.setRelayOn.mockResolvedValue({ ok: true, value: null });
    mocks.setRelayOff.mockResolvedValue({ ok: true, value: null });
    mocks.getStatus.mockResolvedValue({ ok: true, value: { relayOn: false } });
  });

  it('matches control state by the stored script id', () => {
    expect(installedAutomationScriptMatch(installation, controlStatus('auto', 7))).toBe(
      'matched'
    );
    expect(
      installedAutomationScriptMatch(installation, controlStatus('missing', null))
    ).toBe('missing');
    expect(installedAutomationScriptMatch(installation, controlStatus('auto', 8))).toBe(
      'mismatch'
    );
  });

  it('pauses by stopping the exact script, forcing relay OFF and confirming manual state', async () => {
    mocks.readControlStatus.mockResolvedValue(controlStatus('manual', 7, false));

    const result = await pauseInstalledAutomation(installation);

    expect(mocks.stopScript).toHaveBeenCalledWith(7);
    expect(mocks.setRelayOff).toHaveBeenCalledTimes(2);
    expect(mocks.setRelayOff).toHaveBeenCalledWith({ relayId: 0 });
    expect(mocks.getStatus).toHaveBeenCalledTimes(2);
    expect(result.automationMode).toBe('manual');
    expect(result.relayOn).toBe(false);
  });

  it('still attempts and confirms relay OFF when Script.Stop fails', async () => {
    mocks.stopScript.mockResolvedValue({
      ok: false,
      error: { kind: 'rpc', message: 'stop failed' }
    });
    mocks.readControlStatus.mockResolvedValue(controlStatus('auto', 7, false));

    await expect(pauseInstalledAutomation(installation)).rejects.toThrow();
    expect(mocks.setRelayOff).toHaveBeenCalledTimes(2);
    expect(mocks.setRelayOff).toHaveBeenCalledWith({ relayId: 0 });
    expect(mocks.getStatus).toHaveBeenCalledTimes(2);
  });

  it('does not stop the script when relay OFF cannot be confirmed first', async () => {
    mocks.getStatus.mockResolvedValueOnce({ ok: true, value: { relayOn: true } });

    await expect(pauseInstalledAutomation(installation)).rejects.toThrow(
      'Shelly relay did not confirm OFF.'
    );
    expect(mocks.stopScript).not.toHaveBeenCalled();
    expect(mocks.setRelayOff).toHaveBeenCalledTimes(1);
  });

  it('resumes from a known OFF state and confirms the stored script is running', async () => {
    mocks.readControlStatus
      .mockResolvedValueOnce(controlStatus('manual', 7, false))
      .mockResolvedValueOnce(controlStatus('auto', 7, false));

    const result = await resumeInstalledAutomation(installation);

    expect(mocks.setRelayOff).toHaveBeenCalledWith({ relayId: 0 });
    expect(mocks.startScript).toHaveBeenCalledWith(7);
    expect(result.automationMode).toBe('auto');
  });

  it('rejects pause when the stored script id no longer matches Shelly', async () => {
    mocks.readControlStatus.mockResolvedValue(controlStatus('auto', 8, false));

    await expect(pauseInstalledAutomation(installation)).rejects.toThrow(
      'Stored automation script does not match Shelly.'
    );
    expect(mocks.stopScript).not.toHaveBeenCalled();
    expect(mocks.setRelayOff).not.toHaveBeenCalled();
  });

  it('rejects resume when the stored script id no longer matches Shelly', async () => {
    mocks.readControlStatus.mockResolvedValue(controlStatus('manual', 8, false));

    await expect(resumeInstalledAutomation(installation)).rejects.toThrow(
      'Stored automation script does not match Shelly.'
    );
    expect(mocks.startScript).not.toHaveBeenCalled();
    expect(mocks.setRelayOff).not.toHaveBeenCalled();
  });

  it('allows direct relay ON only while the matched automation is manual and verifies it', async () => {
    mocks.readControlStatus
      .mockResolvedValueOnce(controlStatus('manual', 7, false))
      .mockResolvedValueOnce(controlStatus('manual', 7, true));

    const result = await setInstalledAutomationRelayState(installation, true);

    expect(mocks.setRelayOn).toHaveBeenCalledWith({ relayId: 0 });
    expect(result.relayOn).toBe(true);
    expect(result.automationMode).toBe('manual');
  });

  it('rejects direct relay control while automation is running', async () => {
    mocks.readControlStatus.mockResolvedValue(controlStatus('auto', 7, false));

    await expect(setInstalledAutomationRelayState(installation, true)).rejects.toThrow(
      'Manual relay control requires a paused automation.'
    );
    expect(mocks.setRelayOn).not.toHaveBeenCalled();
  });
});

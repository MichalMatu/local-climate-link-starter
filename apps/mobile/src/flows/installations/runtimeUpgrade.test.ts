import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import type * as ShellyClientModule from '@lcl/shelly-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AutomationsModule from '../../features/automations/index.js';
import type * as RuntimeStatusModule from './runtimeStatus.js';
import { createInstalledAutomation } from './model.js';

const mocks = vi.hoisted(() => ({
  getDeviceInfo: vi.fn(),
  installScript: vi.fn(),
  setRelayOff: vi.fn(),
  getStatus: vi.fn(),
  readControlStatus: vi.fn(),
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

vi.mock('../../features/automations/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AutomationsModule>();
  return { ...actual, readShellyControlStatus: mocks.readControlStatus };
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
  scriptHash: 'hash',
  config: createDefaultShellyThermostatConfig(),
  nowMs: 1000
});

describe('installed automation runtime identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDeviceInfo.mockResolvedValue({
      ok: true,
      value: { id: 'shelly-b', model: 'S3PL-00112EU', gen: 3 }
    });
  });

  it('rejects runtime preparation before any mutation on a different Shelly', async () => {
    await expect(ensureInstalledAutomationRuntimeCurrent(installation)).rejects.toThrow(
      'Shelly identity does not match the installed automation.'
    );
    expect(mocks.readInstalledStatus).not.toHaveBeenCalled();
    expect(mocks.setRelayOff).not.toHaveBeenCalled();
    expect(mocks.installScript).not.toHaveBeenCalled();
  });

  it('rejects explicit recovery before any mutation on a different Shelly', async () => {
    await expect(recoverInstalledAutomationRuntime(installation)).rejects.toThrow(
      'Shelly identity does not match the installed automation.'
    );
    expect(mocks.setRelayOff).not.toHaveBeenCalled();
    expect(mocks.installScript).not.toHaveBeenCalled();
  });
});

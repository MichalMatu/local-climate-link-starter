import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ShellyRequestsModule from '../hardware-setup/shellyRequests.js';
import type * as RuntimeModeModule from './runtimeModeTransport.js';
import { createInstalledAutomation } from './model.js';

const mocks = vi.hoisted(() => ({
  readControlStatus: vi.fn(),
  readRuntimeMode: vi.fn()
}));

vi.mock('../hardware-setup/shellyRequests.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyRequestsModule>();
  return { ...actual, readShellyControlStatus: mocks.readControlStatus };
});

vi.mock('./runtimeModeTransport.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeModeModule>();
  return { ...actual, readInstalledAutomationRuntimeMode: mocks.readRuntimeMode };
});

import { readInstalledAutomationControlStatus } from './runtimeStatus.js';

const installation = createInstalledAutomation({
  shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Salon',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: 'hash',
  config: createDefaultShellyThermostatConfig(),
  nowMs: 1000
});

const baseStatus = (
  automationMode: 'auto' | 'manual' | 'missing',
  scriptId: number | null
) => ({
  relayOn: false,
  automationMode,
  automationScriptId: scriptId,
  firmwareId: '1.0.0',
  telemetry: {},
  clock: { timeSynced: false }
});

describe('installed automation runtime status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads MANUAL from the state of a still-running runtime', async () => {
    mocks.readControlStatus.mockResolvedValue(baseStatus('auto', 7));
    mocks.readRuntimeMode.mockResolvedValue({ mode: 'manual', supported: true });

    const status = await readInstalledAutomationControlStatus(installation);

    expect(status.automationMode).toBe('manual');
    expect(status.runtimeModeSupported).toBe(true);
  });

  it('recognises an old running runtime as AUTO but upgradeable', async () => {
    mocks.readControlStatus.mockResolvedValue(baseStatus('auto', 7));
    mocks.readRuntimeMode.mockResolvedValue({ mode: 'auto', supported: false });

    const status = await readInstalledAutomationControlStatus(installation);

    expect(status.automationMode).toBe('auto');
    expect(status.runtimeModeSupported).toBe(false);
  });

  it('separates an actually stopped script from intentional MANUAL', async () => {
    mocks.readControlStatus.mockResolvedValue(baseStatus('manual', 7));

    const status = await readInstalledAutomationControlStatus(installation);

    expect(status.automationMode).toBe('stopped');
    expect(status.runtimeModeSupported).toBe(false);
    expect(mocks.readRuntimeMode).not.toHaveBeenCalled();
  });
});

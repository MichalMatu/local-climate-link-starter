import { describe, expect, it, vi } from 'vitest';
import { createTimeInstalledAutomation } from '../data/installedAutomation.js';
import type { TimeAutomationRuntimeSnapshot } from '../data/timeAutomationRuntimeState.js';
import {
  updateTimeInstalledAutomation,
  type TimeAutomationEditServices
} from './updateTimeInstalledAutomation.js';

const installation = createTimeInstalledAutomation({
  shelly: { id: 'shelly-abc', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Grow plug',
  baseUrl: 'http://192.168.0.20/',
  onJobId: 7,
  offJobId: 8,
  config: { relayId: 0, onTime: '08:00', offTime: '20:00' },
  nowMs: 1000
});

const editedConfig = { relayId: 0, onTime: '18:00', offTime: '23:00' } as const;
const runtime: TimeAutomationRuntimeSnapshot = {
  relayOn: false,
  clock: { localTime: '12:00', unixTimeSec: 1_800_000_000, timeSynced: true },
  scheduleState: 'running',
  onJob: null,
  offJob: null
};

const services = (
  overrides: Partial<TimeAutomationEditServices> = {}
): TimeAutomationEditServices => ({
  readDeviceId: vi.fn(async () => 'SHELLY-ABC'),
  hasManagedClimateScript: vi.fn(async () => false),
  updateRuntime: vi.fn(async () => runtime),
  nowMs: vi.fn(() => 2000),
  ...overrides
});

describe('updateTimeInstalledAutomation', () => {
  it('updates the owned runtime while preserving durable identity and schedule ids', async () => {
    const mocked = services();
    const result = await updateTimeInstalledAutomation({
      installation,
      config: editedConfig,
      installations: [installation],
      services: mocked
    });

    expect(result.runtime).toBe(runtime);
    expect(result.installation.id).toBe(installation.id);
    expect(result.installation.installedAtMs).toBe(1000);
    expect(result.installation.updatedAtMs).toBe(2000);
    expect(result.installation.schedule).toEqual({ onJobId: 7, offJobId: 8 });
    expect(result.installation.config).toEqual(editedConfig);
    expect(mocked.updateRuntime).toHaveBeenCalledWith(installation, editedConfig);
  });

  it('refuses to mutate a different physical Shelly', async () => {
    const mocked = services({ readDeviceId: vi.fn(async () => 'other-device') });
    await expect(
      updateTimeInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('identity');
    expect(mocked.updateRuntime).not.toHaveBeenCalled();
  });

  it('refuses another durable relay owner before touching the runtime', async () => {
    const otherOwner = { ...installation, id: 'time:shelly-abc:other' };
    const mocked = services();
    await expect(
      updateTimeInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation, otherOwner],
        services: mocked
      })
    ).rejects.toThrow('owns this relay');
    expect(mocked.updateRuntime).not.toHaveBeenCalled();
  });

  it('refuses to edit Time while a managed climate script is present', async () => {
    const mocked = services({ hasManagedClimateScript: vi.fn(async () => true) });
    await expect(
      updateTimeInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('climate script');
    expect(mocked.updateRuntime).not.toHaveBeenCalled();
  });

  it('does not produce an edited durable record when runtime update fails', async () => {
    const mocked = services({
      updateRuntime: vi.fn(async () => {
        throw new Error('runtime update failed');
      })
    });
    await expect(
      updateTimeInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('runtime update failed');
  });
});

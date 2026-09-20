import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { hashScriptCode, LOCAL_CLIMATE_LINK_SCRIPT_NAME } from '@lcl/shelly-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInstalledAutomation,
  createTimeInstalledAutomation
} from '../data/installedAutomation.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../state/installedAutomationStore.js';
import {
  reconcileInstalledAutomationsForShelly,
  type InstalledAutomationReconciliationServices
} from './reconcileInstalledAutomation.js';

const climateInstallation = (relayId = 0) => {
  const config = createDefaultShellyThermostatConfig(
    'xiaomi_lywsd03mmc_bthome_v2',
    'heating'
  );
  return createInstalledAutomation({
    shelly: { id: 'SHELLY-ABC', model: 'Old model', gen: 3 },
    shellyName: 'Old name',
    baseUrl: 'http://192.168.0.10/',
    scriptId: 7,
    scriptHash: hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:owned-code`),
    config: { ...config, output: { ...config.output, relayId } },
    nowMs: 1000
  });
};

const services = (
  overrides: Partial<InstalledAutomationReconciliationServices> = {}
): InstalledAutomationReconciliationServices => ({
  readClimateRuntime: vi.fn(async () => ({
    scriptId: 7,
    running: true,
    code: 'owned-code'
  })),
  readTimeScheduleState: vi.fn(async () => 'running' as const),
  ...overrides
});

const target = {
  deviceId: 'shelly-abc',
  name: 'Grow plug',
  baseUrl: 'http://192.168.0.77/',
  model: 'S3PL-00112EU',
  gen: 3
};

describe('reconcileInstalledAutomationsForShelly', () => {
  beforeEach(() => resetInstalledAutomationStore());

  it('returns none when Local Climate Link has no durable ownership record', async () => {
    await expect(
      reconcileInstalledAutomationsForShelly(target, services())
    ).resolves.toEqual({
      status: 'none',
      installationIds: []
    });
  });

  it('refreshes reachability and verifies the exact managed climate runtime', async () => {
    const installation = climateInstallation();
    useInstalledAutomationStore.getState().upsertInstallation(installation);

    const result = await reconcileInstalledAutomationsForShelly(target, services());
    const stored = useInstalledAutomationStore.getState().installations[0];

    expect(result).toEqual({ status: 'verified', installationIds: [installation.id] });
    expect(stored?.shelly).toMatchObject({
      deviceId: 'SHELLY-ABC',
      name: 'Grow plug',
      baseUrl: 'http://192.168.0.77/',
      model: 'S3PL-00112EU',
      gen: 3
    });
    expect(stored?.installedAtMs).toBe(1000);
    expect(stored?.updatedAtMs).toBe(1000);
  });

  it('reports changed when the managed climate code no longer matches ownership', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(climateInstallation());
    const result = await reconcileInstalledAutomationsForShelly(
      target,
      services({
        readClimateRuntime: vi.fn(async () => ({
          scriptId: 7,
          running: true,
          code: 'different-code'
        }))
      })
    );
    expect(result.status).toBe('changed');
  });

  it('reports unavailable while retaining the verified new endpoint', async () => {
    useInstalledAutomationStore.getState().upsertInstallation(climateInstallation());
    const result = await reconcileInstalledAutomationsForShelly(
      target,
      services({
        readClimateRuntime: vi.fn(async () => {
          throw new Error('offline');
        })
      })
    );
    expect(result.status).toBe('unavailable');
    expect(useInstalledAutomationStore.getState().installations[0]?.shelly.baseUrl).toBe(
      target.baseUrl
    );
  });

  it('uses the existing exact Time schedule verification contract', async () => {
    const installation = createTimeInstalledAutomation({
      shelly: { id: 'shelly-abc', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Lamp',
      baseUrl: 'http://192.168.0.10/',
      onJobId: 4,
      offJobId: 5,
      config: { relayId: 0, onTime: '08:00', offTime: '20:00' },
      nowMs: 1000
    });
    useInstalledAutomationStore.getState().upsertInstallation(installation);
    const readTimeScheduleState = vi.fn(async () => 'paused' as const);

    const result = await reconcileInstalledAutomationsForShelly(
      target,
      services({ readTimeScheduleState })
    );

    expect(result.status).toBe('verified');
    expect(readTimeScheduleState).toHaveBeenCalledWith(
      expect.objectContaining({
        shelly: expect.objectContaining({ baseUrl: target.baseUrl })
      })
    );
  });

  it('reports conflicting durable owners before trusting remote runtime', async () => {
    const climate = climateInstallation();
    const time = createTimeInstalledAutomation({
      shelly: { id: 'shelly-abc', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Lamp',
      baseUrl: 'http://192.168.0.10/',
      onJobId: 4,
      offJobId: 5,
      config: { relayId: 0, onTime: '08:00', offTime: '20:00' },
      nowMs: 1001
    });
    useInstalledAutomationStore.getState().upsertInstallation(climate);
    useInstalledAutomationStore.getState().upsertInstallation(time);
    const mockedServices = services();

    const result = await reconcileInstalledAutomationsForShelly(target, mockedServices);

    expect(result.status).toBe('conflict');
    expect(mockedServices.readClimateRuntime).not.toHaveBeenCalled();
    expect(mockedServices.readTimeScheduleState).not.toHaveBeenCalled();
  });
});

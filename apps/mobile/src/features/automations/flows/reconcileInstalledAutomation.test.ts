import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  serializeShellyRuntimeConfig
} from '@lcl/script-generator';
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
    scriptName: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
    running: true,
    code: 'owned-code',
    persistedRuntimeConfigJson: null
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

  it('recovers durable climate ownership from a verified managed runtime after local state loss', async () => {
    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    config.sensor = {
      ...config.sensor,
      sensorId: 'old-local-sensor-id',
      runtimeAddress: 'A4:C1:38:4F:24:CD',
      displayName: 'Recovered sensor',
      parserValidated: true
    };
    const code = generateShellyThermostatScript(config);

    const result = await reconcileInstalledAutomationsForShelly(
      target,
      services({
        readClimateRuntime: vi.fn(async () => ({
          scriptId: 9,
          scriptName: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
          running: true,
          code,
          persistedRuntimeConfigJson: null
        }))
      })
    );
    const stored = useInstalledAutomationStore.getState().installations[0];

    expect(result).toEqual({
      status: 'recovered',
      installationIds: ['climate:shelly-abc:0']
    });
    expect(stored).toMatchObject({
      id: 'climate:shelly-abc:0',
      kind: 'climate',
      shelly: {
        deviceId: 'shelly-abc',
        name: 'Grow plug',
        baseUrl: 'http://192.168.0.77/',
        model: 'S3PL-00112EU',
        gen: 3
      },
      script: {
        id: 9,
        hash: hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${code}`)
      },
      config: {
        sensor: {
          sensorId: 'A4:C1:38:4F:24:CD',
          runtimeAddress: 'A4:C1:38:4F:24:CD',
          displayName: 'Recovered sensor',
          parserValidated: true
        },
        output: { relayId: 0 },
        rule: { mode: 'heating' }
      }
    });
  });

  it('recovers the persisted config instead of stale embedded fallback', async () => {
    const embedded = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    const persistedBase = createDefaultShellyThermostatConfig('tp357_custom_v1', 'cooling');
    const persisted = {
      ...persistedBase,
      sensor: {
        ...persistedBase.sensor,
        runtimeAddress: 'C2:C0:00:30:64:01',
        displayName: 'Persisted TP357'
      },
      rule: {
        ...persistedBase.rule,
        control: {
          ...persistedBase.rule.control,
          onThreshold: 27,
          offThreshold: 26
        }
      }
    };
    const code = generateShellyThermostatScript(embedded);

    const result = await reconcileInstalledAutomationsForShelly(
      target,
      services({
        readClimateRuntime: vi.fn(async () => ({
          scriptId: 9,
          scriptName: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
          running: true,
          code,
          persistedRuntimeConfigJson: serializeShellyRuntimeConfig(persisted)
        }))
      })
    );
    const stored = useInstalledAutomationStore.getState().installations[0];

    expect(result.status).toBe('recovered');
    expect(stored).toMatchObject({
      kind: 'climate',
      config: {
        sensor: {
          profileId: 'tp357_custom_v1',
          runtimeAddress: 'C2:C0:00:30:64:01',
          displayName: 'Persisted TP357'
        },
        rule: {
          mode: 'cooling',
          control: {
            onThreshold: 27,
            offThreshold: 26
          }
        }
      }
    });
  });

  it('does not claim ownership of metadata-shaped code without the LCL marker', async () => {
    const generated = generateShellyThermostatScript(
      createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating')
    );
    const firstLineEnd = generated.indexOf(String.fromCharCode(10));
    const code = generated.slice(firstLineEnd + 1);

    await expect(
      reconcileInstalledAutomationsForShelly(
        target,
        services({
          readClimateRuntime: vi.fn(async () => ({
            scriptId: 9,
            scriptName: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
            running: true,
            code,
            persistedRuntimeConfigJson: null
          }))
        })
      )
    ).resolves.toEqual({ status: 'none', installationIds: [] });
    expect(useInstalledAutomationStore.getState().installations).toEqual([]);
  });

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
          scriptName: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
          running: true,
          code: 'different-code',
          persistedRuntimeConfigJson: null
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

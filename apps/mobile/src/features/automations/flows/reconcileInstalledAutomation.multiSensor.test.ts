import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  normalizeConfig,
  serializeShellyRuntimeConfig
} from '@lcl/script-generator';
import { LOCAL_CLIMATE_LINK_SCRIPT_NAME } from '@lcl/shelly-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../state/installedAutomationStore.js';
import {
  reconcileInstalledAutomationsForShelly,
  type InstalledAutomationReconciliationServices
} from './reconcileInstalledAutomation.js';

const target = {
  deviceId: 'shelly-abc',
  name: 'Grow plug',
  baseUrl: 'http://192.168.0.77/',
  model: 'S3PL-00112EU',
  gen: 3
};

describe('multi-sensor climate recovery', () => {
  beforeEach(() => resetInstalledAutomationStore());

  it('recovers every persisted sensor profile, address, display name and aggregation', async () => {
    const embedded = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating');
    const persisted = normalizeConfig({
      ...base,
      sensor: {
        ...base.sensor,
        sensorId: 'phone-local-primary',
        runtimeAddress: 'C2:C0:00:30:64:01',
        displayName: 'TP357 Primary'
      },
      sensorSet: {
        aggregation: 'max',
        additionalSensors: [
          {
            ...embedded.sensor,
            sensorId: 'phone-local-xiaomi',
            runtimeAddress: 'A4:C1:38:4F:24:CD',
            displayName: 'Xiaomi Room'
          },
          {
            ...base.sensor,
            sensorId: 'phone-local-second-tp357',
            runtimeAddress: 'C2:C0:00:30:64:02',
            displayName: 'TP357 Shelf'
          }
        ]
      }
    });
    const code = generateShellyThermostatScript(embedded);
    const services: InstalledAutomationReconciliationServices = {
      readClimateRuntime: vi.fn(async () => ({
        scriptId: 1,
        scriptName: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
        running: true,
        code,
        persistedRuntimeConfigJson: serializeShellyRuntimeConfig(persisted)
      })),
      readTimeScheduleState: vi.fn(async () => 'running' as const)
    };

    const result = await reconcileInstalledAutomationsForShelly(target, services);
    const stored = useInstalledAutomationStore.getState().installations[0];

    expect(result.status).toBe('recovered');
    expect(result.recoveredSensors).toEqual([
      {
        profileId: 'tp357_custom_v1',
        runtimeAddress: 'C2:C0:00:30:64:01',
        displayName: 'TP357 Primary'
      },
      {
        profileId: 'xiaomi_lywsd03mmc_bthome_v2',
        runtimeAddress: 'A4:C1:38:4F:24:CD',
        displayName: 'Xiaomi Room'
      },
      {
        profileId: 'tp357_custom_v1',
        runtimeAddress: 'C2:C0:00:30:64:02',
        displayName: 'TP357 Shelf'
      }
    ]);
    expect(stored).toMatchObject({
      kind: 'climate',
      config: {
        sensor: {
          profileId: 'tp357_custom_v1',
          sensorId: 'C2:C0:00:30:64:01',
          runtimeAddress: 'C2:C0:00:30:64:01',
          displayName: 'TP357 Primary'
        },
        sensorSet: {
          aggregation: 'max',
          additionalSensors: [
            {
              profileId: 'xiaomi_lywsd03mmc_bthome_v2',
              sensorId: 'A4:C1:38:4F:24:CD',
              runtimeAddress: 'A4:C1:38:4F:24:CD',
              displayName: 'Xiaomi Room'
            },
            {
              profileId: 'tp357_custom_v1',
              sensorId: 'C2:C0:00:30:64:02',
              runtimeAddress: 'C2:C0:00:30:64:02',
              displayName: 'TP357 Shelf'
            }
          ]
        }
      }
    });
  });
});

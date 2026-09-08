import {
  createDefaultShellyThermostatConfig,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstalledAutomation } from './model.js';

const configFor = (
  runtimeAddress: string,
  mode: ShellyThermostatConfig['rule']['mode'],
  onThreshold: number,
  offThreshold: number
): ShellyThermostatConfig => {
  const config = createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2', mode);
  return {
    ...config,
    sensor: {
      ...config.sensor,
      sensorId: `sensor-${runtimeAddress.replaceAll(':', '').toLowerCase()}`,
      runtimeAddress,
      displayName: `Sensor ${runtimeAddress}`
    },
    rule: {
      ...config.rule,
      control: {
        ...config.rule.control,
        onThreshold,
        offThreshold
      }
    }
  };
};

describe('installed automation store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it('persists two independent Shelly installations with different sensors and rules', async () => {
    const storeModule = await import('./store.js');

    const first = createInstalledAutomation({
      shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Salon',
      baseUrl: 'http://192.168.0.20/',
      scriptId: 1,
      scriptHash: 'hash-a',
      config: configFor('AA:BB:CC:DD:EE:01', 'heating', 19, 20),
      nowMs: 1000
    });
    const second = createInstalledAutomation({
      shelly: { id: 'shelly-b', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Sypialnia',
      baseUrl: 'http://192.168.0.21/',
      scriptId: 2,
      scriptHash: 'hash-b',
      config: configFor('AA:BB:CC:DD:EE:02', 'cooling', 25, 24),
      nowMs: 2000
    });

    storeModule.useInstalledAutomationStore.getState().upsertInstallation(first);
    storeModule.useInstalledAutomationStore.getState().upsertInstallation(second);

    vi.resetModules();
    const reloadedStoreModule = await import('./store.js');
    const installations =
      reloadedStoreModule.useInstalledAutomationStore.getState().installations;

    expect(installations).toHaveLength(2);
    expect(installations.map((item) => item.shelly.deviceId)).toEqual([
      'shelly-b',
      'shelly-a'
    ]);
    const newest = installations[0];
    const oldest = installations[1];
    expect(newest?.kind).toBe('climate');
    expect(oldest?.kind).toBe('climate');
    if (!newest || newest.kind !== 'climate' || !oldest || oldest.kind !== 'climate') {
      throw new Error('Expected climate installations.');
    }
    expect(newest.config.sensor.runtimeAddress).toBe('AA:BB:CC:DD:EE:02');
    expect(newest.config.rule.mode).toBe('cooling');
    expect(oldest.config.sensor.runtimeAddress).toBe('AA:BB:CC:DD:EE:01');
    expect(oldest.config.rule.mode).toBe('heating');
  });

  it('updates one Shelly installation without changing its installation identity', async () => {
    const storeModule = await import('./store.js');
    const initial = createInstalledAutomation({
      shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Salon',
      baseUrl: 'http://192.168.0.20/',
      scriptId: 1,
      scriptHash: 'hash-a',
      config: configFor('AA:BB:CC:DD:EE:01', 'heating', 19, 20),
      nowMs: 1000
    });
    const updated = createInstalledAutomation({
      shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Salon',
      baseUrl: 'http://192.168.0.99/',
      scriptId: 7,
      scriptHash: 'hash-b',
      config: configFor('AA:BB:CC:DD:EE:03', 'heating', 18, 19),
      nowMs: 5000
    });

    storeModule.useInstalledAutomationStore.getState().upsertInstallation(initial);
    storeModule.useInstalledAutomationStore.getState().upsertInstallation(updated);

    const installations =
      storeModule.useInstalledAutomationStore.getState().installations;
    expect(installations).toHaveLength(1);
    expect(installations[0]).toMatchObject({
      id: initial.id,
      installedAtMs: 1000,
      updatedAtMs: 5000,
      shelly: { deviceId: 'shelly-a', baseUrl: 'http://192.168.0.99/' },
      script: { id: 7, hash: 'hash-b' }
    });
    const stored = installations[0];
    expect(stored?.kind).toBe('climate');
    if (!stored || stored.kind !== 'climate') {
      throw new Error('Expected a climate installation.');
    }
    expect(stored.config.sensor.runtimeAddress).toBe('AA:BB:CC:DD:EE:03');
  });
});

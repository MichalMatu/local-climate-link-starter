import { describe, expect, it, vi } from 'vitest';
import { createSavedPlug, savedPlugSchema } from '../devices/plugs/model.js';
import { PLUGS_STORAGE_KEY, createPlugRepository } from '../devices/plugs/repository.js';
import { createSavedSensor, savedSensorSchema } from '../devices/sensors/model.js';
import {
  SENSORS_STORAGE_KEY,
  createSensorRepository
} from '../devices/sensors/repository.js';
import { automationRuleSchema } from '../rules/model.js';
import { RULES_STORAGE_KEY, createRuleRepository } from '../rules/repository.js';
import { resolveClimateGeneratorConfig, resolveRuleDevices } from '../rules/selectors.js';
import { createDeviceRuleRegistries } from './devicesAndRules.js';
import { climate, time, plug, sensor, memoryStorage } from './fixtures.test-support.js';

const seeded = () => {
  const storage = memoryStorage();
  const stores = createDeviceRuleRegistries(storage);
  expect(stores.plugs.getState().upsert(plug).ok).toBe(true);
  expect(stores.sensors.getState().upsert(sensor).ok).toBe(true);
  return { storage, ...stores };
};

describe('independent device and rule registries', () => {
  it('persists devices with zero rules and reloads each registry independently', () => {
    const { storage } = seeded();
    const reloaded = createDeviceRuleRegistries(storage);
    expect(reloaded.plugs.getState().items).toEqual([plug]);
    expect(reloaded.sensors.getState().items).toEqual([sensor]);
    expect(reloaded.rules.getState().items).toEqual([]);
  });

  it.each([climate, time])(
    'round trips a configured $kind rule using references only',
    (rule) => {
      const { storage, rules } = seeded();
      expect(rules.getState().upsert(rule)).toEqual({ ok: true, value: rule });
      expect(createDeviceRuleRegistries(storage).rules.getState().items).toEqual([rule]);
      expect(storage.getItem(RULES_STORAGE_KEY)).not.toContain(plug.baseUrl);
      expect(storage.getItem(RULES_STORAGE_KEY)).not.toContain('runtimeAddress');
    }
  );

  it('deduplicates device identity across case and endpoint changes while preserving creation time', () => {
    const { plugs, rules, sensors } = seeded();
    rules.getState().upsert(climate);
    const updated = {
      ...plug,
      id: ' SHELLY-AbC ',
      baseUrl: 'http://192.168.0.99/',
      createdAtMs: 9,
      updatedAtMs: 9
    };
    expect(plugs.getState().upsert(updated).ok).toBe(true);
    expect(plugs.getState().items).toEqual([
      { ...plug, baseUrl: 'http://192.168.0.99', updatedAtMs: 9 }
    ]);
    const resolved = resolveRuleDevices(climate, {
      plugs: plugs.getState().items,
      sensors: sensors.getState().items
    });
    expect(resolved.ok && resolved.value.plug.baseUrl).toBe('http://192.168.0.99');
    expect(rules.getState().items).toEqual([climate]);
  });

  it('requires a real supported Shelly device id, without script capability', () => {
    expect(
      createSavedPlug({
        deviceInfo: { model: plug.model, gen: plug.gen },
        name: plug.name,
        baseUrl: plug.baseUrl,
        nowMs: 1
      }).ok
    ).toBe(false);
    expect(
      createSavedPlug({
        deviceInfo: {
          id: 'SHELLY-ABC',
          model: plug.model,
          gen: plug.gen,
          matterEnabled: true
        },
        name: plug.name,
        baseUrl: plug.baseUrl,
        nowMs: 1
      })
    ).toEqual({ ok: true, value: plug });
    expect(
      savedPlugSchema.safeParse({ ...plug, baseUrl: 'http://user:secret@192.168.0.20' })
        .success
    ).toBe(false);
  });

  it('normalizes sensor identity and rejects phone-only identifiers and mutable identity mismatch', () => {
    const { sensors } = seeded();
    expect(
      sensors.getState().upsert({
        ...sensor,
        id: sensor.id.toLowerCase(),
        runtimeAddress: sensor.runtimeAddress.toLowerCase(),
        updatedAtMs: 5
      }).ok
    ).toBe(true);
    expect(sensors.getState().items).toEqual([{ ...sensor, updatedAtMs: 5 }]);
    expect(savedSensorSchema.safeParse({ ...sensor, id: 'ios-scan-uuid' }).success).toBe(
      false
    );
    expect(
      savedSensorSchema.safeParse({ ...sensor, runtimeAddress: 'AA:BB:CC:DD:EE:00' })
        .success
    ).toBe(false);
    expect(
      createSavedSensor({
        profileId: sensor.profileId,
        runtimeAddress: 'ios-scan-uuid',
        name: 'Room',
        nowMs: 1
      }).ok
    ).toBe(false);
    expect(
      createSavedSensor({
        profileId: sensor.profileId,
        runtimeAddress: ' aa:bb:cc:dd:ee:ff ',
        name: sensor.name,
        nowMs: 1
      })
    ).toEqual({ ok: true, value: sensor });
  });

  it('blocks device deletion until referencing rules are removed, including undeployed rules', () => {
    const { plugs, sensors, rules } = seeded();
    rules.getState().upsert(climate);
    expect(plugs.getState().remove(plug.id)).toEqual({
      ok: false,
      error: { kind: 'device-referenced', ruleIds: [climate.id] }
    });
    expect(sensors.getState().remove(sensor.id)).toEqual({
      ok: false,
      error: { kind: 'device-referenced', ruleIds: [climate.id] }
    });
    expect(rules.getState().remove(climate.id).ok).toBe(true);
    expect(plugs.getState().items).toEqual([plug]);
    expect(sensors.getState().items).toEqual([sensor]);
    expect(plugs.getState().remove(plug.id).ok).toBe(true);
    expect(sensors.getState().remove(sensor.id).ok).toBe(true);
  });

  it('a time rule references only its plug', () => {
    const { plugs, sensors, rules } = seeded();
    rules.getState().upsert(time);
    expect(plugs.getState().remove(plug.id).ok).toBe(false);
    expect(sensors.getState().remove(sensor.id).ok).toBe(true);
  });

  it('rejects dangling references and resolves generator identity from current registries', () => {
    const { rules } = seeded();
    expect(rules.getState().upsert({ ...climate, plugId: 'missing' })).toMatchObject({
      ok: false,
      error: { kind: 'device-missing', deviceKind: 'plug' }
    });
    expect(rules.getState().upsert({ ...climate, sensorId: 'missing' })).toMatchObject({
      ok: false,
      error: { kind: 'device-missing', deviceKind: 'sensor' }
    });
    const config = resolveClimateGeneratorConfig(climate, {
      plugs: [plug],
      sensors: [{ ...sensor, name: 'Renamed' }]
    });
    expect(config.ok && config.value.sensor).toMatchObject({
      sensorId: sensor.id,
      displayName: 'Renamed',
      runtimeAddress: sensor.runtimeAddress
    });
  });

  it.each(['pending', 'failed', 'verified'] as const)(
    'keeps exact deployment when the safety test is %s',
    (status) => {
      const { storage, rules } = seeded();
      const safetyTest =
        status === 'pending'
          ? { status }
          : status === 'failed'
            ? { status, failedAtMs: 5 }
            : { status, verifiedAtMs: 5 };
      const deployed = {
        ...climate,
        deployment: { scriptId: 7, scriptHash: 'hash', safetyTest }
      };
      expect(rules.getState().upsert(deployed).ok).toBe(true);
      expect(createDeviceRuleRegistries(storage).rules.getState().items).toEqual([
        deployed
      ]);
      expect(rules.getState().remove(climate.id)).toMatchObject({
        ok: false,
        error: { kind: 'deployment-attached' }
      });
      expect(rules.getState().upsert({ ...deployed, plugId: 'another' })).toMatchObject({
        ok: false,
        error: { kind: 'deployment-attached' }
      });
    }
  );

  it('validates settings without accepting copied device snapshots or duplicate schedule ids', () => {
    expect(automationRuleSchema.safeParse({ ...climate, shelly: plug }).success).toBe(
      false
    );
    expect(
      automationRuleSchema.safeParse({
        ...climate,
        config: { ...climate.config, sensor }
      }).success
    ).toBe(false);
    expect(
      automationRuleSchema.safeParse({
        ...climate,
        config: {
          ...climate.config,
          rule: {
            ...climate.config.rule,
            control: { ...climate.config.rule.control, onThreshold: 21 }
          }
        }
      }).success
    ).toBe(false);
    expect(
      automationRuleSchema.safeParse({
        ...time,
        config: { onTime: '08:00', offTime: '08:00' }
      }).success
    ).toBe(false);
    expect(
      automationRuleSchema.safeParse({ ...time, deployment: { onJobId: 4, offJobId: 4 } })
        .success
    ).toBe(false);
  });
});

describe('registry persistence failure boundaries', () => {
  it('never reads old installation or draft storage keys', () => {
    const storage = memoryStorage();
    storage.setItem(
      'lcl.hardwareSetupDraft.v8',
      JSON.stringify({ shellyDevices: [plug] })
    );
    storage.setItem(
      'lcl.installedAutomations.v1',
      JSON.stringify({ installations: [climate] })
    );
    const get = vi.spyOn(storage, 'getItem');
    const stores = createDeviceRuleRegistries(storage);
    expect(stores.plugs.getState().items).toEqual([]);
    expect(stores.rules.getState().items).toEqual([]);
    expect(get.mock.calls.map(([key]) => key).sort()).toEqual(
      [PLUGS_STORAGE_KEY, RULES_STORAGE_KEY, SENSORS_STORAGE_KEY].sort()
    );
  });

  it.each([createPlugRepository, createSensorRepository, createRuleRepository])(
    'surfaces unavailable storage without pretending a write succeeded',
    (createRepository) => {
      const repository = createRepository(null);
      expect(repository.load()).toEqual({
        ok: false,
        error: { kind: 'storage-unavailable' }
      });
      expect(repository.save([])).toEqual({
        ok: false,
        error: { kind: 'storage-unavailable' }
      });
    }
  );

  it('rejects malformed/unsupported/duplicate records and protects devices when rules cannot load', () => {
    for (const invalid of [
      '{broken',
      JSON.stringify({ version: 99, items: [] }),
      JSON.stringify({ version: 1, items: [climate, climate] })
    ]) {
      const { storage } = seeded();
      storage.setItem(RULES_STORAGE_KEY, invalid);
      const stores = createDeviceRuleRegistries(storage);
      expect(stores.rules.getState().loadError?.kind).toBe('storage-invalid');
      expect(stores.plugs.getState().remove(plug.id).ok).toBe(false);
      expect(stores.rules.getState().upsert(time).ok).toBe(false);
      expect(storage.getItem(RULES_STORAGE_KEY)).toBe(invalid);
    }
  });

  it('does not publish in-memory success after a quota failure', () => {
    const { storage } = seeded();
    const stores = createDeviceRuleRegistries(storage);
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(stores.plugs.getState().upsert({ ...plug, name: 'Changed' })).toEqual({
      ok: false,
      error: { kind: 'storage-unavailable' }
    });
    expect(stores.plugs.getState().items).toEqual([plug]);
  });
});

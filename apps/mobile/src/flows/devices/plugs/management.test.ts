import { describe, expect, it, vi } from 'vitest';
import { createDeviceRuleRegistries } from '../../registry/devicesAndRules.js';
import {
  climate,
  plug,
  sensor,
  memoryStorage
} from '../../registry/fixtures.test-support.js';
import { createPlugManagement } from './management.js';
import { createPlugOperationQueue } from './operations.js';
import { createPlugRuntimeFixture, ok } from './runtime.test-support.js';

const fixture = () => {
  const registries = createDeviceRuleRegistries(memoryStorage());
  registries.plugs.getState().upsert(plug);
  registries.sensors.getState().upsert(sensor);
  const runtime = createPlugRuntimeFixture();
  const clients = vi.fn(() => runtime.clients);
  const serialize = createPlugOperationQueue();
  const management = createPlugManagement({
    readPlugs: registries.plugs.getState,
    readRules: registries.rules.getState,
    clients,
    serialize,
    now: () => 10
  });
  return { ...registries, ...runtime, clients, serialize, management };
};

describe('plug management transactions', () => {
  it('resolves the latest endpoint only after preceding operations finish', async () => {
    const f = fixture();
    const updatedUrl = 'http://192.168.1.88';
    const update = f.serialize(plug.id, async () => {
      f.plugs.getState().upsert({ ...plug, baseUrl: updatedUrl });
    });
    const control = f.management.setRelay(plug.id, true);
    await update;
    expect(await control).toMatchObject({ ok: true, value: { relayOn: true } });
    expect(f.clients).toHaveBeenCalledExactlyOnceWith(updatedUrl);
  });

  it('checks rules created while a relay operation is queued', async () => {
    const f = fixture();
    const claim = f.serialize(plug.id, async () => {
      expect(f.rules.getState().upsert(climate).ok).toBe(true);
    });
    const control = f.management.setRelay(plug.id, true);
    await claim;
    expect(await control).toMatchObject({ ok: false, error: { kind: 'relay-owned' } });
    expect(f.isOn()).toBe(false);
  });

  it('does not send RPC to a device removed while queued', async () => {
    const f = fixture();
    const removed = f.management.remove(plug.id);
    const control = f.management.setRelay(plug.id, true);
    expect((await removed).ok).toBe(true);
    expect(await control).toMatchObject({ ok: false, error: { kind: 'device-missing' } });
    expect(f.clients).not.toHaveBeenCalled();
  });

  it('updates the endpoint without duplicating physical identity or creation time', async () => {
    const f = fixture();
    expect((await f.management.register('http://192.168.1.88', 'New name')).ok).toBe(
      true
    );
    expect(f.plugs.getState().items).toEqual([
      { ...plug, baseUrl: 'http://192.168.1.88', name: 'New name', updatedAtMs: 10 }
    ]);
  });

  it('refuses registration if the endpoint changes physical identity while waiting', async () => {
    const f = fixture();
    vi.mocked(f.clients().device.getDeviceInfo)
      .mockResolvedValueOnce(ok({ id: plug.id, model: plug.model, gen: plug.gen }))
      .mockResolvedValueOnce(ok({ id: 'different', model: plug.model, gen: plug.gen }));
    expect(await f.management.register(plug.baseUrl, 'New name')).toMatchObject({
      ok: false,
      error: { kind: 'identity-mismatch' }
    });
    expect(f.plugs.getState().items).toEqual([plug]);
  });

  it('fails closed when the rule registry cannot be read', async () => {
    const f = fixture();
    f.rules.setState({ loadError: { kind: 'storage-invalid' } });
    expect(await f.management.setRelay(plug.id, true)).toEqual({
      ok: false,
      error: { kind: 'storage-invalid' }
    });
    expect(f.clients).not.toHaveBeenCalled();
  });

  it('blocks local removal when a rule references the plug', async () => {
    const f = fixture();
    f.rules.getState().upsert(climate);
    expect(await f.management.remove(plug.id)).toMatchObject({
      ok: false,
      error: { kind: 'device-referenced', ruleIds: [climate.id] }
    });
    expect(f.plugs.getState().items).toEqual([plug]);
  });
});

describe('physical plug operation queue', () => {
  it('serializes normalized identity and releases the queue after rejection', async () => {
    const run = createPlugOperationQueue();
    const events: string[] = [];
    const first = run(' SHELLY ', async () => {
      events.push('first');
      await Promise.resolve();
      throw new Error('failed');
    });
    const second = run('shelly', async () => {
      events.push('second');
      return 2;
    });
    await expect(first).rejects.toThrow('failed');
    await expect(second).resolves.toBe(2);
    expect(events).toEqual(['first', 'second']);
  });

  it('does not block a different physical plug', async () => {
    const run = createPlugOperationQueue();
    let release = () => {};
    const blocked = run(
      'first',
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    await expect(run('second', async () => 2)).resolves.toBe(2);
    release();
    await blocked;
  });
});

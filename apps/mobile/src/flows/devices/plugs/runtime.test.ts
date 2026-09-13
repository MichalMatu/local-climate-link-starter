import { RPC_METHODS } from '@lcl/shelly-client';
import { describe, expect, it, vi } from 'vitest';
import { climate, plug, time } from '../../registry/fixtures.test-support.js';
import { createRuleScheduleJob } from '../../rules/timeSchedule.js';
import { readPlugRuntime } from './inventory.js';
import { checkPlugRegistration } from './registration.js';
import { deleteOrphanClimateScript, setUnownedPlugRelay } from './runtime.js';
import { createPlugRuntimeFixture, ok, failed, script } from './runtime.test-support.js';

describe('standalone plug services', () => {
  it('registers a supported plug without requesting scripts, schedules or BLE', async () => {
    const { clients } = createPlugRuntimeFixture();
    vi.mocked(clients.inventory.listScripts).mockResolvedValue(failed());
    vi.mocked(clients.device.getDeviceInfo).mockResolvedValue(
      ok({
        id: plug.id.toUpperCase(),
        model: plug.model,
        gen: plug.gen,
        matterEnabled: true
      })
    );
    expect(
      await checkPlugRegistration({
        baseUrl: plug.baseUrl,
        name: plug.name,
        nowMs: 1,
        clients
      })
    ).toEqual({ ok: true, value: plug });
    expect(clients.inventory.listScripts).not.toHaveBeenCalled();
    expect(clients.inventory.listMethods).not.toHaveBeenCalled();
    expect(clients.schedules.list).not.toHaveBeenCalled();
    expect(clients.device.getStatus).not.toHaveBeenCalled();
  });

  it('verifies actual ON and OFF transitions for a saved unowned plug', async () => {
    const { clients, isOn } = createPlugRuntimeFixture();
    expect(
      await setUnownedPlugRelay({ plug, rules: [], on: true, clients })
    ).toMatchObject({ ok: true, value: { relayOn: true } });
    expect(isOn()).toBe(true);
    expect(
      await setUnownedPlugRelay({ plug, rules: [], on: false, clients })
    ).toMatchObject({ ok: true, value: { relayOn: false } });
    expect(isOn()).toBe(false);
  });

  it('allows direct control when method inventory proves script/schedule APIs absent', async () => {
    const { clients } = createPlugRuntimeFixture();
    vi.mocked(clients.inventory.listMethods).mockResolvedValue(
      ok({ methods: [RPC_METHODS.SwitchGetStatus, RPC_METHODS.SwitchSet] })
    );
    expect((await setUnownedPlugRelay({ plug, rules: [], on: true, clients })).ok).toBe(
      true
    );
    expect(clients.inventory.listScripts).not.toHaveBeenCalled();
    expect(clients.schedules.list).not.toHaveBeenCalled();
    expect((await setUnownedPlugRelay({ plug, rules: [], on: false, clients })).ok).toBe(
      true
    );
  });

  it.each([climate, time])('does not raw-toggle a $kind owner', async (rule) => {
    const { clients } = createPlugRuntimeFixture();
    expect(
      await setUnownedPlugRelay({ plug, rules: [rule], on: true, clients })
    ).toMatchObject({ ok: false, error: { kind: 'relay-owned' } });
    expect(clients.device.setRelayOn).not.toHaveBeenCalled();
    expect(clients.device.setRelayOff).not.toHaveBeenCalled();
  });

  it('blocks orphan scripts and native schedules and exposes all orphan ids', async () => {
    const { clients, setScripts, setJobs } = createPlugRuntimeFixture();
    setScripts([script, { ...script, id: 9 }]);
    expect(await readPlugRuntime(plug, [], clients)).toMatchObject({
      ok: true,
      value: {
        managedScripts: [
          { id: 7, ruleIds: [] },
          { id: 9, ruleIds: [] }
        ]
      }
    });
    expect((await setUnownedPlugRelay({ plug, rules: [], on: true, clients })).ok).toBe(
      false
    );
    setScripts([]);
    setJobs([
      { id: 11, ...createRuleScheduleJob(time.config.schedule.windows[0]!, 0, 'on') }
    ]);
    expect((await setUnownedPlugRelay({ plug, rules: [], on: true, clients })).ok).toBe(
      false
    );
    expect(clients.device.setRelayOn).not.toHaveBeenCalled();
  });

  it('does not mistake an inventory RPC failure for an absent API', async () => {
    const { clients } = createPlugRuntimeFixture();
    vi.mocked(clients.inventory.listScripts).mockResolvedValue(failed());
    expect(
      await setUnownedPlugRelay({ plug, rules: [], on: true, clients })
    ).toMatchObject({ ok: false, error: { kind: 'rpc-failed' } });
    expect(clients.device.setRelayOn).not.toHaveBeenCalled();
  });

  it('fails closed with no relay mutations if the endpoint belongs to another device', async () => {
    const { clients } = createPlugRuntimeFixture();
    vi.mocked(clients.device.getDeviceInfo).mockResolvedValue(
      ok({ id: 'different', model: plug.model, gen: 3 })
    );
    expect(
      await setUnownedPlugRelay({ plug, rules: [], on: true, clients })
    ).toMatchObject({ ok: false, error: { kind: 'identity-mismatch' } });
    expect(clients.device.setRelayOn).not.toHaveBeenCalled();
    expect(clients.device.setRelayOff).not.toHaveBeenCalled();
  });

  it('re-verifies physical identity immediately before direct relay mutation', async () => {
    const { clients } = createPlugRuntimeFixture();
    vi.mocked(clients.device.getDeviceInfo)
      .mockResolvedValueOnce(ok({ id: plug.id, model: plug.model, gen: plug.gen }))
      .mockResolvedValueOnce(ok({ id: 'different', model: plug.model, gen: plug.gen }));
    expect(await setUnownedPlugRelay({ plug, rules: [], on: true, clients })).toEqual({
      ok: false,
      error: { kind: 'identity-mismatch' }
    });
    expect(clients.device.setRelayOn).not.toHaveBeenCalled();
    expect(clients.device.setRelayOff).not.toHaveBeenCalled();
  });

  it('an unconfirmed ON command forces and verifies OFF', async () => {
    const { clients, calls, isOn } = createPlugRuntimeFixture();
    const original = clients.device.setRelayOn;
    clients.device.setRelayOn = async () => {
      await original();
      return failed();
    };
    expect(
      await setUnownedPlugRelay({ plug, rules: [], on: true, clients })
    ).toMatchObject({ ok: false, error: { kind: 'rpc-failed' } });
    expect(isOn()).toBe(false);
    expect(calls.slice(-2)).toEqual(['OFF', 'read:false']);
  });
});

describe('exact orphan script removal', () => {
  it('forces OFF before stopping/deleting only the selected script and verifies absence/OFF', async () => {
    const { clients, setScripts, calls } = createPlugRuntimeFixture();
    setScripts([
      script,
      { ...script, id: 12, name: 'User script' },
      { ...script, id: 13, running: false }
    ]);
    expect(
      await deleteOrphanClimateScript({ plug, rules: [], scriptId: 7, clients })
    ).toMatchObject({
      ok: true,
      value: { relayOn: false, managedScripts: [{ id: 13 }] }
    });
    expect(calls).toEqual([
      'OFF',
      'read:false',
      'stop:7',
      'OFF',
      'read:false',
      'delete:7',
      'OFF',
      'read:false',
      'read:false'
    ]);
    expect(clients.device.deleteScript).toHaveBeenCalledExactlyOnceWith(7);
    expect(await clients.inventory.listScripts()).toMatchObject({
      ok: true,
      value: { scripts: [{ id: 12 }, { id: 13 }] }
    });
  });

  it('does not delete an owned script even after a failed safety test', async () => {
    const { clients, setScripts } = createPlugRuntimeFixture();
    setScripts([script]);
    const rule = {
      ...climate,
      deployment: {
        scriptId: 7,
        scriptHash: 'hash',
        safetyTest: { status: 'failed' as const, failedAtMs: 5 }
      }
    };
    expect(
      await deleteOrphanClimateScript({ plug, rules: [rule], scriptId: 7, clients })
    ).toEqual({ ok: false, error: { kind: 'script-owned', ruleIds: [climate.id] } });
    expect(clients.device.deleteScript).not.toHaveBeenCalled();
    expect(clients.device.setRelayOff).not.toHaveBeenCalled();
  });

  it.each(['User script', 'Local Climate Link BLE Discovery'])(
    'cannot remove %s through climate cleanup',
    async (name) => {
      const { clients, setScripts } = createPlugRuntimeFixture();
      setScripts([{ ...script, name }]);
      expect(
        await deleteOrphanClimateScript({ plug, rules: [], scriptId: 7, clients })
      ).toEqual({ ok: false, error: { kind: 'script-not-managed' } });
      expect(clients.device.deleteScript).not.toHaveBeenCalled();
    }
  );

  it('re-verifies physical identity immediately before deleting an orphan script', async () => {
    const { clients, setScripts } = createPlugRuntimeFixture();
    setScripts([{ ...script, running: false }]);
    vi.mocked(clients.device.getDeviceInfo)
      .mockResolvedValueOnce(ok({ id: plug.id, model: plug.model, gen: plug.gen }))
      .mockResolvedValueOnce(ok({ id: plug.id, model: plug.model, gen: plug.gen }))
      .mockResolvedValueOnce(ok({ id: 'different', model: plug.model, gen: plug.gen }));
    expect(
      await deleteOrphanClimateScript({ plug, rules: [], scriptId: 7, clients })
    ).toEqual({ ok: false, error: { kind: 'identity-mismatch' } });
    expect(clients.device.deleteScript).not.toHaveBeenCalled();
    expect(clients.device.setRelayOff).toHaveBeenCalledTimes(1);
  });

  it('does not delete an id renamed during cleanup', async () => {
    const { clients, setScripts } = createPlugRuntimeFixture();
    setScripts([script]);
    clients.device.stopScript = async () => {
      setScripts([{ ...script, name: 'User script', running: false }]);
      return ok(null);
    };
    expect(
      await deleteOrphanClimateScript({ plug, rules: [], scriptId: 7, clients })
    ).toEqual({ ok: false, error: { kind: 'script-unconfirmed' } });
    expect(clients.device.deleteScript).not.toHaveBeenCalled();
  });

  it('forces OFF again if final cleanup verification sees the relay ON', async () => {
    const { clients, setScripts, calls } = createPlugRuntimeFixture();
    setScripts([script]);
    const readRelay = clients.inventory.readRelay;
    let reads = 0;
    clients.inventory.readRelay = async () => {
      reads += 1;
      return reads === 4 ? ok({ id: 0, output: true }) : readRelay();
    };
    expect(
      await deleteOrphanClimateScript({ plug, rules: [], scriptId: 7, clients })
    ).toEqual({ ok: false, error: { kind: 'script-unconfirmed' } });
    expect(calls.slice(-2)).toEqual(['OFF', 'read:false']);
  });

  it('failed stop/delete attempts leave confirmed OFF and report failure', async () => {
    for (const operation of ['stopScript', 'deleteScript'] as const) {
      const { clients, setScripts, calls, isOn } = createPlugRuntimeFixture();
      setScripts([script]);
      vi.mocked(clients.device[operation]).mockResolvedValue(failed());
      expect(
        await deleteOrphanClimateScript({ plug, rules: [], scriptId: 7, clients })
      ).toMatchObject({ ok: false, error: { kind: 'rpc-failed' } });
      expect(isOn()).toBe(false);
      expect(calls.slice(-2)).toEqual(['OFF', 'read:false']);
    }
  });
});

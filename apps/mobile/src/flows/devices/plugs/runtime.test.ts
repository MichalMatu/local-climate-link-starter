import {
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RPC_METHODS,
  type Result,
  type ShellyInventoryScript,
  type ShellyScheduleJob
} from '@lcl/shelly-client';
import { describe, expect, it, vi } from 'vitest';
import { climate, plug, time } from '../../registry/fixtures.test-support.js';
import { createDailyScheduleJob } from '../../time-automation/scheduleJobs.js';
import { readPlugRuntime } from './inventory.js';
import { checkPlugRegistration } from './registration.js';
import { deleteOrphanClimateScript, setUnownedPlugRelay } from './runtime.js';
import type { PlugRuntimeClients } from './runtimeClient.js';

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const failed = (): Result<never> => ({
  ok: false,
  error: { kind: 'shelly-offline', userMessageKey: 'errors.offline', retryable: true }
});
const script: ShellyInventoryScript = {
  id: 7,
  name: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  running: true,
  enable: true
};

const fixture = () => {
  let relayOn = false;
  let scripts: ShellyInventoryScript[] = [];
  let jobs: ShellyScheduleJob[] = [];
  const calls: string[] = [];
  const clients: PlugRuntimeClients = {
    device: {
      getDeviceInfo: vi.fn(async () =>
        ok({ id: plug.id, model: plug.model, gen: plug.gen })
      ),
      getStatus: vi.fn(async () =>
        ok({
          relayOn,
          scripts: 'enabled' as const,
          bluetooth: 'enabled' as const,
          matterEnabled: false,
          clock: { timeSynced: true },
          telemetry: {}
        })
      ),
      setRelayOn: vi.fn(async () => {
        calls.push('ON');
        relayOn = true;
        return ok(null);
      }),
      setRelayOff: vi.fn(async () => {
        calls.push('OFF');
        relayOn = false;
        return ok(null);
      }),
      stopScript: vi.fn(async (id) => {
        calls.push(`stop:${id}`);
        scripts = scripts.map((item) =>
          item.id === id ? { ...item, running: false } : item
        );
        return ok(null);
      }),
      deleteScript: vi.fn(async (id) => {
        calls.push(`delete:${id}`);
        scripts = scripts.filter((item) => item.id !== id);
        return ok(null);
      })
    },
    inventory: {
      listMethods: vi.fn(async () =>
        ok({
          methods: [
            RPC_METHODS.ScriptList,
            RPC_METHODS.ScheduleList,
            RPC_METHODS.SwitchSet,
            RPC_METHODS.SwitchGetStatus
          ]
        })
      ),
      listScripts: vi.fn(async () => ok({ scripts })),
      readRelay: vi.fn(async () => {
        calls.push(`read:${relayOn}`);
        return ok({ id: 0 as const, output: relayOn });
      })
    },
    schedules: { list: vi.fn(async () => ok({ jobs, rev: 1 })) }
  };
  return {
    clients,
    calls,
    setScripts: (value: ShellyInventoryScript[]) => {
      scripts = value;
    },
    setJobs: (value: ShellyScheduleJob[]) => {
      jobs = value;
    },
    isOn: () => relayOn
  };
};

describe('standalone plug services', () => {
  it('registers a supported plug without requesting scripts, schedules or BLE', async () => {
    const { clients } = fixture();
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
    const { clients, isOn } = fixture();
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
    const { clients } = fixture();
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
    const { clients } = fixture();
    expect(
      await setUnownedPlugRelay({ plug, rules: [rule], on: true, clients })
    ).toMatchObject({ ok: false, error: { kind: 'relay-owned' } });
    expect(clients.device.setRelayOn).not.toHaveBeenCalled();
    expect(clients.device.setRelayOff).not.toHaveBeenCalled();
  });

  it('blocks orphan scripts and native schedules and exposes all orphan ids', async () => {
    const { clients, setScripts, setJobs } = fixture();
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
      { id: 11, ...createDailyScheduleJob({ ...time.config, relayId: 0 }, true) }
    ]);
    expect((await setUnownedPlugRelay({ plug, rules: [], on: true, clients })).ok).toBe(
      false
    );
    expect(clients.device.setRelayOn).not.toHaveBeenCalled();
  });

  it('does not mistake an inventory RPC failure for an absent API', async () => {
    const { clients } = fixture();
    vi.mocked(clients.inventory.listScripts).mockResolvedValue(failed());
    expect(
      await setUnownedPlugRelay({ plug, rules: [], on: true, clients })
    ).toMatchObject({ ok: false, error: { kind: 'rpc-failed' } });
    expect(clients.device.setRelayOn).not.toHaveBeenCalled();
  });

  it('fails closed with no relay mutations if the endpoint belongs to another device', async () => {
    const { clients } = fixture();
    vi.mocked(clients.device.getDeviceInfo).mockResolvedValue(
      ok({ id: 'different', model: plug.model, gen: 3 })
    );
    expect(
      await setUnownedPlugRelay({ plug, rules: [], on: true, clients })
    ).toMatchObject({ ok: false, error: { kind: 'identity-mismatch' } });
    expect(clients.device.setRelayOn).not.toHaveBeenCalled();
    expect(clients.device.setRelayOff).not.toHaveBeenCalled();
  });

  it('an unconfirmed ON command forces and verifies OFF', async () => {
    const { clients, calls, isOn } = fixture();
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
    const { clients, setScripts, calls } = fixture();
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
    const { clients, setScripts } = fixture();
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
      const { clients, setScripts } = fixture();
      setScripts([{ ...script, name }]);
      expect(
        await deleteOrphanClimateScript({ plug, rules: [], scriptId: 7, clients })
      ).toEqual({ ok: false, error: { kind: 'script-not-managed' } });
      expect(clients.device.deleteScript).not.toHaveBeenCalled();
    }
  );

  it('does not delete an id renamed during cleanup', async () => {
    const { clients, setScripts } = fixture();
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
    const { clients, setScripts, calls } = fixture();
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
      const { clients, setScripts, calls, isOn } = fixture();
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

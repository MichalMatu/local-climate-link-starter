import {
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RPC_METHODS,
  type Result,
  type ShellyInventoryScript,
  type ShellyScheduleJob
} from '@lcl/shelly-client';
import { vi } from 'vitest';
import { plug } from '../../registry/fixtures.test-support.js';
import type { PlugRuntimeClients } from './runtimeClient.js';

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const failed = (): Result<never> => ({
  ok: false,
  error: { kind: 'shelly-offline', userMessageKey: 'errors.offline', retryable: true }
});
export const script: ShellyInventoryScript = {
  id: 7,
  name: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  running: true,
  enable: true
};

export const createPlugRuntimeFixture = () => {
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

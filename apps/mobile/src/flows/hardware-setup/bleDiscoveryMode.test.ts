import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  prepareShellyBleDiscovery,
  stopShellyBleDiscovery,
  readShellyControlStatus
} from './shellyRequests.js';

const climate = {
  id: 1,
  name: 'Local Climate Link Thermostat',
  enable: true,
  running: true
};
const discovery = {
  id: 4,
  name: 'Local Climate Link BLE Discovery',
  enable: false,
  running: true
};
const endpoint = 'http://192.168.0.20';
const fixture = (initialMode: number) => {
  let mode = initialMode;
  let relay = true;
  let scripts = [{ ...climate }, { ...discovery }];
  let rejectRestore = false;
  const calls: {
    method: string;
    params: { id?: number; code?: string; on?: boolean };
  }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as (typeof calls)[number];
      calls.push(body);
      const response = (result: unknown) =>
        new Response(JSON.stringify({ id: 1, result }), { status: 200 });
      switch (body.method) {
        case 'Shelly.GetDeviceInfo':
          return response({ id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 });
        case 'Shelly.GetStatus':
          return response({ ble: {}, script: {}, 'switch:0': { id: 0, output: relay } });
        case 'Switch.GetStatus':
          return response({ id: 0, output: relay });
        case 'Switch.Set':
          relay = body.params.on === true;
          return response({});
        case 'Script.List':
          return response({ scripts });
        case 'Script.Stop':
          scripts = scripts.map((script) =>
            script.id === body.params.id ? { ...script, running: false } : script
          );
          return response({});
        case 'Script.Delete':
          scripts = scripts.filter((script) => script.id !== body.params.id);
          return response({});
        case 'Script.Eval': {
          if (body.params.code?.includes('R.m=1')) mode = 1;
          if (body.params.code?.includes('R.m=0')) {
            mode = 0;
            if (rejectRestore)
              return new Response(
                JSON.stringify({ error: { code: -1, message: 'Lost confirmation' } })
              );
          }
          return response({ result: String(mode) });
        }
        default:
          throw new Error(`Unexpected RPC ${body.method}`);
      }
    })
  );
  return {
    calls,
    mode: () => mode,
    relay: () => relay,
    scripts: () => scripts,
    setScripts: (next: typeof scripts) => {
      scripts = next;
    },
    rejectRestore: () => {
      rejectRestore = true;
    }
  };
};

beforeEach(() => vi.stubEnv('DEV', false));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('BLE discovery preserves in-process climate mode', () => {
  it.each([
    ['manual', 1],
    ['auto', 0]
  ] as const)(
    'restores %s without restarting climate in AUTO',
    async (expected, initial) => {
      const f = fixture(initial);
      const preparation = await prepareShellyBleDiscovery(endpoint);
      expect(preparation.automationMode).toBe(expected);
      expect(f.mode()).toBe(1);
      expect(f.relay()).toBe(false);
      expect(f.scripts()).toEqual([climate]);
      f.setScripts([climate, discovery]);
      await stopShellyBleDiscovery(endpoint, { ...preparation, discoveryScriptId: 4 });
      expect(f.mode()).toBe(initial);
      expect(f.relay()).toBe(false);
      expect(f.scripts()).toEqual([climate]);
      expect(f.calls.filter((call) => call.method === 'Script.Start')).toEqual([]);
      expect(
        f.calls
          .filter((call) => call.method === 'Script.Stop')
          .every((call) => call.params.id === 4)
      ).toBe(true);
    }
  );

  it('refuses unknown runtime mode before suspending or creating discovery', async () => {
    const f = fixture(-1);
    await expect(prepareShellyBleDiscovery(endpoint)).rejects.toThrow(
      'verified control mode'
    );
    expect(
      f.calls.some((call) =>
        ['Switch.Set', 'Script.Stop', 'Script.Delete'].includes(call.method)
      )
    ).toBe(false);
  });

  it('rejects duplicate managed scripts before selecting a runtime', async () => {
    const f = fixture(1);
    f.setScripts([climate, { ...climate, id: 2 }]);
    await expect(prepareShellyBleDiscovery(endpoint)).rejects.toThrow('Multiple managed');
    expect(f.calls.map((call) => call.method)).toEqual(['Script.List']);
  });

  it('stops exact climate runtime and confirms OFF if AUTO restoration was applied but not confirmed', async () => {
    const f = fixture(0);
    const preparation = await prepareShellyBleDiscovery(endpoint);
    f.setScripts([climate, discovery]);
    f.rejectRestore();
    await expect(
      stopShellyBleDiscovery(endpoint, { ...preparation, discoveryScriptId: 4 })
    ).rejects.toThrow('Runtime mode RPC failed');
    expect(f.scripts()).toEqual([{ ...climate, running: false }]);
    expect(f.relay()).toBe(false);
  });

  it('does not delete a renamed discovery id', async () => {
    const f = fixture(1);
    f.setScripts([climate, { ...discovery, name: 'User script' }]);
    await expect(
      stopShellyBleDiscovery(endpoint, {
        automationScriptId: 1,
        automationMode: 'manual',
        discoveryScriptId: 4
      })
    ).rejects.toThrow('identity changed');
    expect(f.calls.some((call) => call.method === 'Script.Delete')).toBe(false);
    expect(f.relay()).toBe(false);
  });

  it('preserves a previously stopped climate script', async () => {
    const f = fixture(1);
    f.setScripts([{ ...climate, running: false }]);
    const preparation = await prepareShellyBleDiscovery(endpoint);
    expect(preparation.automationMode).toBe(null);
    await stopShellyBleDiscovery(endpoint, { ...preparation, discoveryScriptId: null });
    expect(f.scripts()[0]?.running).toBe(false);
    expect(
      f.calls.some(
        (call) => call.method === 'Script.Eval' || call.method === 'Script.Start'
      )
    ).toBe(false);
  });

  it('reads MANUAL from a running process and distinguishes a stopped process', async () => {
    const f = fixture(1);
    f.setScripts([climate]);
    expect((await readShellyControlStatus(endpoint)).automationMode).toBe('manual');
    f.setScripts([{ ...climate, running: false }]);
    expect((await readShellyControlStatus(endpoint)).automationMode).toBe('stopped');
  });
});

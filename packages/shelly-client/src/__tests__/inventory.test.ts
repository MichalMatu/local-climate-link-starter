import { describe, expect, it } from 'vitest';
import { RpcShellyInventoryClient } from '../inventory.js';
import type { Result, ShellyRpcRequest, ShellyRpcTransport } from '../model.js';

const fixture = (response: unknown) => {
  const requests: ShellyRpcRequest[] = [];
  const transport: ShellyRpcTransport = {
    call: async <T>(request: ShellyRpcRequest): Promise<Result<T>> => {
      requests.push(request);
      return { ok: true, value: response as T };
    }
  };
  return { client: new RpcShellyInventoryClient(transport), requests };
};

describe('read-only plug inventory client', () => {
  it('validates exact relay id and output rather than defaulting malformed status to OFF', async () => {
    for (const malformed of [{}, { id: 1, output: false }, { id: 0, output: 'false' }]) {
      expect((await fixture(malformed).client.readRelay()).ok).toBe(false);
    }
    const { client, requests } = fixture({ id: 0, output: false, apower: 0 });
    expect(await client.readRelay()).toEqual({
      ok: true,
      value: { id: 0, output: false }
    });
    expect(requests).toEqual([{ method: 'Switch.GetStatus', params: { id: 0 } }]);
  });

  it('preserves every script and requires explicit process state', async () => {
    const scripts = [1, 2].map((id) => ({
      id,
      name: 'Local Climate Link Thermostat',
      enable: true,
      running: false
    }));
    const { client, requests } = fixture({ scripts });
    expect(await client.listScripts()).toEqual({ ok: true, value: { scripts } });
    expect(requests).toEqual([{ method: 'Script.List' }]);
    expect(
      (await fixture({ scripts: [scripts[0], scripts[0]] }).client.listScripts()).ok
    ).toBe(false);
    expect(
      (await fixture({ scripts: [{ id: 1, name: 'User' }] }).client.listScripts()).ok
    ).toBe(false);
    expect(
      (await fixture({ scripts: [{ ...scripts[0], id: -1 }] }).client.listScripts()).ok
    ).toBe(false);
  });

  it('validates method inventory and propagates unavailable transport', async () => {
    const { client, requests } = fixture({ methods: ['Switch.Set'] });
    expect(await client.listMethods()).toEqual({
      ok: true,
      value: { methods: ['Switch.Set'] }
    });
    expect(requests).toEqual([{ method: 'Shelly.ListMethods' }]);
    expect((await fixture({ methods: [1] }).client.listMethods()).ok).toBe(false);
    const failure = {
      ok: false as const,
      error: {
        kind: 'timeout' as const,
        userMessageKey: 'errors.timeout',
        retryable: true
      }
    };
    const unavailable = new RpcShellyInventoryClient({ call: async () => failure });
    expect(await unavailable.listScripts()).toEqual(failure);
    expect(await unavailable.readRelay()).toEqual(failure);
  });
});

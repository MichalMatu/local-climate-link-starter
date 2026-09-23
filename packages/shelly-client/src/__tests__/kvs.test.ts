import { describe, expect, it } from 'vitest';
import { ShellyKvsClient } from '../kvs.js';
import {
  RPC_METHODS,
  type Result,
  type ShellyRpcRequest,
  type ShellyRpcTransport
} from '../model.js';

class QueueTransport implements ShellyRpcTransport {
  readonly requests: ShellyRpcRequest[] = [];

  constructor(private readonly responses: unknown[]) {}

  async call<TResponse>(request: ShellyRpcRequest): Promise<Result<TResponse>> {
    this.requests.push(request);
    return { ok: true, value: this.responses.shift() as TResponse };
  }
}

describe('ShellyKvsClient', () => {
  it('reads and validates a KVS value', async () => {
    const transport = new QueueTransport([{ etag: 'abc', value: '[1,2,3]' }]);
    const client = new ShellyKvsClient(transport);
    await expect(client.get('lcl.dl1.00')).resolves.toEqual({
      ok: true,
      value: { etag: 'abc', value: '[1,2,3]' }
    });
    expect(transport.requests).toEqual([
      { method: RPC_METHODS.KvsGet, params: { key: 'lcl.dl1.00' } }
    ]);
  });

  it('passes etags for atomic KVS updates', async () => {
    const transport = new QueueTransport([{ etag: 'next', rev: 7 }]);
    const client = new ShellyKvsClient(transport);
    await expect(client.set('lcl.dl1.m', '[1]', 'old')).resolves.toEqual({
      ok: true,
      value: { etag: 'next', rev: 7 }
    });
    expect(transport.requests[0]).toEqual({
      method: RPC_METHODS.KvsSet,
      params: { key: 'lcl.dl1.m', value: '[1]', etag: 'old' }
    });
  });

  it('paginates GetMany until the complete matching set is available', async () => {
    const transport = new QueueTransport([
      {
        items: [
          { key: 'lcl.dl1.00', etag: 'a', value: 'v0' },
          { key: 'lcl.dl1.01', etag: 'b', value: 'v1' }
        ],
        offset: 0,
        total: 3
      },
      { items: [{ key: 'lcl.dl1.02', etag: 'c', value: 'v2' }], offset: 2, total: 3 }
    ]);
    const client = new ShellyKvsClient(transport);
    const result = await client.getAllMatching('lcl.dl1.*');
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.map(({ key }) => key)).toEqual([
      'lcl.dl1.00',
      'lcl.dl1.01',
      'lcl.dl1.02'
    ]);
    expect(transport.requests).toEqual([
      { method: RPC_METHODS.KvsGetMany, params: { match: 'lcl.dl1.*', offset: 0 } },
      { method: RPC_METHODS.KvsGetMany, params: { match: 'lcl.dl1.*', offset: 2 } }
    ]);
  });

  it('accepts object-shaped GetMany items used by older firmware documentation', async () => {
    const transport = new QueueTransport([
      { items: { 'lcl.dl1.00': { etag: 'a', value: 'v0' } }, offset: 0, total: 1 }
    ]);
    const client = new ShellyKvsClient(transport);
    await expect(client.getMany('lcl.dl1.*')).resolves.toEqual({
      ok: true,
      value: {
        items: [{ key: 'lcl.dl1.00', etag: 'a', value: 'v0' }],
        offset: 0,
        total: 1
      }
    });
  });

  it('rejects invalid keys and malformed responses at the boundary', async () => {
    const transport = new QueueTransport([{ etag: 7, value: 'bad' }]);
    const client = new ShellyKvsClient(transport);
    const invalidKey = await client.get('x'.repeat(43));
    expect(invalidKey).toMatchObject({ ok: false, error: { kind: 'validation-failed' } });
    const invalidResponse = await client.get('valid');
    expect(invalidResponse).toMatchObject({ ok: false, error: { kind: 'validation-failed' } });
  });
});

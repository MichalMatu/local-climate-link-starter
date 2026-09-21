import {
  RPC_METHODS,
  RpcShellyClient,
  type Result,
  type ShellyRpcRequest,
  type ShellyRpcTransport
} from '../index.js';

class EvalTransport implements ShellyRpcTransport {
  readonly requests: ShellyRpcRequest[] = [];

  constructor(private readonly evalResult: unknown) {}

  async call<TResponse>(request: ShellyRpcRequest): Promise<Result<TResponse>> {
    this.requests.push(request);
    return {
      ok: true,
      value: { result: this.evalResult } as TResponse
    };
  }
}

describe('Script.storage capability probe', () => {
  it('returns a stored value when Script.storage is supported', async () => {
    const transport = new EvalTransport(JSON.stringify({ s: 1, v: '{"v":1}' }));
    const client = new RpcShellyClient(transport, { mutationDelayMs: 0 });

    await expect(client.readScriptStorageItem(7, 'c')).resolves.toEqual({
      ok: true,
      value: { supported: true, value: '{"v":1}' }
    });
    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0]).toMatchObject({
      method: RPC_METHODS.ScriptEval,
      params: {
        id: 7,
        code: expect.stringContaining('Script.storage.getItem("c")')
      }
    });
  });

  it('reports unsupported without treating older firmware as an error', async () => {
    const transport = new EvalTransport(JSON.stringify({ s: 0 }));
    const client = new RpcShellyClient(transport, { mutationDelayMs: 0 });

    await expect(client.readScriptStorageItem(7, 'c')).resolves.toEqual({
      ok: true,
      value: { supported: false, value: null }
    });
  });

  it('rejects malformed probe payloads', async () => {
    const transport = new EvalTransport(JSON.stringify({ s: 1, v: 42 }));
    const client = new RpcShellyClient(transport, { mutationDelayMs: 0 });

    await expect(client.readScriptStorageItem(7, 'c')).resolves.toMatchObject({
      ok: false,
      error: { kind: 'validation-failed' }
    });
  });

  it('rejects an empty storage key without sending Script.Eval', async () => {
    const transport = new EvalTransport(null);
    const client = new RpcShellyClient(transport, { mutationDelayMs: 0 });

    await expect(client.readScriptStorageItem(7, '   ')).resolves.toMatchObject({
      ok: false,
      error: { kind: 'validation-failed' }
    });
    expect(transport.requests).toEqual([]);
  });
});

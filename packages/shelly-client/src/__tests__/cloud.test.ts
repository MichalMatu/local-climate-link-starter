import { describe, expect, it } from 'vitest';
import {
  RpcShellyCloudClient,
  type Result,
  type ShellyRpcRequest,
  type ShellyRpcTransport
} from '../index.js';

class RecordingTransport implements ShellyRpcTransport {
  readonly requests: ShellyRpcRequest[] = [];

  constructor(private readonly responses: Result<unknown>[]) {}

  async call<TResponse>(request: ShellyRpcRequest): Promise<Result<TResponse>> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) throw new Error('Missing fake response.');
    return response as Result<TResponse>;
  }
}

describe('RpcShellyCloudClient', () => {
  it('detects support and reads Cloud config and status', async () => {
    const transport = new RecordingTransport([
      {
        ok: true,
        value: {
          methods: ['Cloud.GetConfig', 'Cloud.SetConfig', 'Cloud.GetStatus']
        }
      },
      {
        ok: true,
        value: { enable: false, server: 'shelly-195-eu.shelly.cloud:6022/jrpc' }
      },
      { ok: true, value: { connected: false } }
    ]);

    await expect(new RpcShellyCloudClient(transport).read()).resolves.toEqual({
      ok: true,
      value: {
        supported: true,
        config: { enable: false, server: 'shelly-195-eu.shelly.cloud:6022/jrpc' },
        status: { connected: false }
      }
    });
    expect(transport.requests).toEqual([
      { method: 'Shelly.ListMethods' },
      { method: 'Cloud.GetConfig' },
      { method: 'Cloud.GetStatus' }
    ]);
  });

  it('reads Cloud config and status without requiring mutation support', async () => {
    const transport = new RecordingTransport([
      { ok: true, value: { methods: ['Cloud.GetConfig', 'Cloud.GetStatus'] } },
      { ok: true, value: { enable: true, server: null } },
      { ok: true, value: { connected: true } }
    ]);

    await expect(new RpcShellyCloudClient(transport).readConfig()).resolves.toEqual({
      ok: true,
      value: {
        supported: true,
        config: { enable: true, server: null },
        status: { connected: true }
      }
    });
    expect(transport.requests).toEqual([
      { method: 'Shelly.ListMethods' },
      { method: 'Cloud.GetConfig' },
      { method: 'Cloud.GetStatus' }
    ]);
  });

  it('returns unsupported without calling Cloud endpoints when the writable surface is missing', async () => {
    const transport = new RecordingTransport([
      { ok: true, value: { methods: ['Cloud.GetConfig', 'Cloud.GetStatus'] } }
    ]);

    await expect(new RpcShellyCloudClient(transport).read()).resolves.toEqual({
      ok: true,
      value: { supported: false }
    });
    expect(transport.requests).toEqual([{ method: 'Shelly.ListMethods' }]);
  });

  it('writes only the Cloud enable flag', async () => {
    const transport = new RecordingTransport([
      { ok: true, value: { restart_required: false } }
    ]);

    await expect(new RpcShellyCloudClient(transport).setEnabled(true)).resolves.toEqual({
      ok: true,
      value: { restart_required: false }
    });
    expect(transport.requests).toEqual([
      {
        method: 'Cloud.SetConfig',
        params: { config: { enable: true } }
      }
    ]);
  });

  it('rejects invalid enable values before transport', async () => {
    const transport = new RecordingTransport([]);
    const result = await new RpcShellyCloudClient(transport).setEnabled('yes' as never);

    expect(result).toMatchObject({ ok: false, error: { kind: 'validation-failed' } });
    expect(transport.requests).toEqual([]);
  });
});

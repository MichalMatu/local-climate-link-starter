import { describe, expect, it } from 'vitest';
import {
  RpcShellyScheduleClient,
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
    if (!response) {
      throw new Error('Missing fake response.');
    }
    return response as Result<TResponse>;
  }
}

describe('RpcShellyScheduleClient', () => {
  it('creates a daily Switch.Set schedule using the exact RPC contract', async () => {
    const transport = new RecordingTransport([{ ok: true, value: { id: 7, rev: 3 } }]);
    const client = new RpcShellyScheduleClient(transport);

    const result = await client.create({
      enable: true,
      timespec: '0 3 9 * * SUN,MON,TUE,WED,THU,FRI,SAT',
      calls: [{ method: 'Switch.Set', params: { id: 0, on: true } }]
    });

    expect(result).toEqual({ ok: true, value: { id: 7, rev: 3 } });
    expect(transport.requests).toEqual([
      {
        method: 'Schedule.Create',
        params: {
          enable: true,
          timespec: '0 3 9 * * SUN,MON,TUE,WED,THU,FRI,SAT',
          calls: [{ method: 'Switch.Set', params: { id: 0, on: true } }]
        }
      }
    ]);
  });

  it('lists and validates schedule jobs', async () => {
    const transport = new RecordingTransport([
      {
        ok: true,
        value: {
          jobs: [
            {
              id: 1,
              enable: true,
              timespec: '0 0 8 * * SUN,MON,TUE,WED,THU,FRI,SAT',
              calls: [{ method: 'Switch.Set', params: { id: 0, on: true } }]
            }
          ],
          rev: 4
        }
      }
    ]);
    const client = new RpcShellyScheduleClient(transport);

    await expect(client.list()).resolves.toMatchObject({
      ok: true,
      value: { rev: 4 }
    });
    expect(transport.requests).toEqual([{ method: 'Schedule.List' }]);
  });

  it('rejects invalid ids before Schedule.Update/Delete RPC', async () => {
    const transport = new RecordingTransport([]);
    const client = new RpcShellyScheduleClient(transport);

    await expect(client.update(-1, { enable: false })).resolves.toMatchObject({
      ok: false,
      error: { kind: 'validation-failed' }
    });
    await expect(client.delete(1.5)).resolves.toMatchObject({
      ok: false,
      error: { kind: 'validation-failed' }
    });
    expect(transport.requests).toEqual([]);
  });
});

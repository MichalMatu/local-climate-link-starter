import { describe, expect, it } from 'vitest';
import {
  RPC_METHODS,
  type Result,
  type ShellyRpcRequest,
  type ShellyRpcTransport
} from '../model.js';
import { runSafeShellyRelayTest, setShellyRelayState } from '../rpc/relay.js';

const successfulMutation =
  (calls: ShellyRpcRequest[]) =>
  async (request: ShellyRpcRequest): Promise<Result<null>> => {
    calls.push(request);
    return { ok: true, value: null };
  };

describe('Shelly relay boundary', () => {
  it('rejects an invalid relay id before mutation', async () => {
    const calls: ShellyRpcRequest[] = [];
    const result = await setShellyRelayState(successfulMutation(calls), true, {
      relayId: -1
    });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', retryable: false }
    });
    expect(calls).toEqual([]);
  });

  it('builds the Switch.Set request for the selected relay', async () => {
    const calls: ShellyRpcRequest[] = [];
    await expect(
      setShellyRelayState(successfulMutation(calls), true, { relayId: 2 })
    ).resolves.toEqual({ ok: true, value: null });

    expect(calls).toEqual([
      { method: RPC_METHODS.SwitchSet, params: { id: 2, on: true } }
    ]);
  });

  it('always drives the relay back OFF and confirms the final state', async () => {
    const mutationCalls: ShellyRpcRequest[] = [];
    let statusRead = 0;
    const transport: ShellyRpcTransport = {
      async call<TResponse>(request: ShellyRpcRequest): Promise<Result<TResponse>> {
        if (request.method !== RPC_METHODS.SwitchGetStatus) {
          throw new Error(`Unexpected RPC: ${request.method}`);
        }
        statusRead += 1;
        return {
          ok: true,
          value: { output: statusRead === 1 } as unknown as TResponse
        };
      }
    };

    const result = await runSafeShellyRelayTest(
      transport,
      successfulMutation(mutationCalls),
      { onDurationMs: 0 }
    );

    expect(result).toEqual({
      ok: true,
      value: { finalRelayOn: false, onCommandSent: true, offCommandSent: true }
    });
    expect(mutationCalls).toEqual([
      { method: RPC_METHODS.SwitchSet, params: { id: 0, on: true } },
      { method: RPC_METHODS.SwitchSet, params: { id: 0, on: false } }
    ]);
    expect(statusRead).toBe(2);
  });
});

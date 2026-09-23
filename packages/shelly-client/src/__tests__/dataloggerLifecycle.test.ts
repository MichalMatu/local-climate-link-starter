import { describe, expect, it } from 'vitest';
import {
  LOCAL_CLIMATE_LINK_DATALOGGER_SCRIPT_NAME,
  RPC_METHODS,
  RpcShellyClient,
  createDataloggerInstallPlan,
  type Result,
  type ShellyRpcRequest,
  type ShellyRpcTransport
} from '../index.js';

class ExistingLoggerTransport implements ShellyRpcTransport {
  readonly requests: ShellyRpcRequest[] = [];

  async call<TResponse>(request: ShellyRpcRequest): Promise<Result<TResponse>> {
    this.requests.push(request);

    if (request.method === RPC_METHODS.ShellyGetDeviceInfo) {
      return { ok: true, value: { model: 'S3PL-00112EU', gen: 3, matter: false } as TResponse };
    }
    if (request.method === RPC_METHODS.ShellyGetStatus) {
      return {
        ok: true,
        value: { script: true, ble: true, 'switch:0': { output: false } } as TResponse
      };
    }
    if (request.method === RPC_METHODS.ScriptList) {
      return {
        ok: true,
        value: {
          scripts: [
            {
              id: 2,
              name: LOCAL_CLIMATE_LINK_DATALOGGER_SCRIPT_NAME,
              enable: true,
              running: true
            }
          ]
        } as TResponse
      };
    }
    if (request.method === RPC_METHODS.ScriptGetStatus) {
      return { ok: true, value: { id: 2, running: true, mem_used: 1, mem_free: 1 } as TResponse };
    }
    return { ok: true, value: {} as TResponse };
  }
}

describe('datalogger install lifecycle', () => {
  it('replaces a running logger without evaluating BLE scanner cleanup code', async () => {
    const transport = new ExistingLoggerTransport();
    const client = new RpcShellyClient(transport, { mutationDelayMs: 0 });

    const result = await client.installScript(createDataloggerInstallPlan('// tiny logger'));

    expect(result.ok).toBe(true);
    expect(transport.requests.some(({ method }) => method === RPC_METHODS.ScriptEval)).toBe(false);
    expect(transport.requests.map(({ method }) => method)).toContain(RPC_METHODS.ScriptStop);
    expect(transport.requests.map(({ method }) => method)).toContain(RPC_METHODS.ScriptPutCode);
  });
});

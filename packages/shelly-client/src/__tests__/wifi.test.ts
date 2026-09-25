import {
  RPC_METHODS,
  RpcShellyWifiClient,
  type Result,
  type ShellyRpcRequest,
  type ShellyRpcTransport
} from '../index.js';

class QueueTransport implements ShellyRpcTransport {
  readonly requests: ShellyRpcRequest[] = [];

  constructor(private readonly responses: Result<unknown>[]) {}

  async call<TResponse>(request: ShellyRpcRequest): Promise<Result<TResponse>> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) {
      throw new Error('Missing queued Shelly RPC response.');
    }
    return response as Result<TResponse>;
  }
}

const ok = (value: unknown): Result<unknown> => ({ ok: true, value });

const offline = (): Result<unknown> => ({
  ok: false,
  error: {
    kind: 'shelly-offline',
    userMessageKey: 'errors.shellyOffline',
    technicalMessage: 'offline',
    retryable: true
  }
});

describe('RpcShellyWifiClient', () => {
  it('reads Wi-Fi config and live status in order', async () => {
    const transport = new QueueTransport([
      ok({
        sta: { ssid: 'Home', enable: true, is_open: false },
        sta1: { ssid: null, enable: false, is_open: true }
      }),
      ok({
        sta_ip: '192.168.0.42',
        status: 'got ip',
        ssid: 'Home',
        rssi: -55
      })
    ]);

    const result = await new RpcShellyWifiClient(transport).read();

    expect(result).toEqual({
      ok: true,
      value: {
        config: {
          sta: { ssid: 'Home', enable: true, is_open: false },
          sta1: { ssid: null, enable: false, is_open: true }
        },
        status: {
          sta_ip: '192.168.0.42',
          status: 'got ip',
          ssid: 'Home',
          rssi: -55
        }
      }
    });
    expect(transport.requests.map((request) => request.method)).toEqual([
      RPC_METHODS.WifiGetConfig,
      RPC_METHODS.WifiGetStatus
    ]);
  });

  it('accepts a factory-like config without sta1', async () => {
    const transport = new QueueTransport([
      ok({ sta: { ssid: null, enable: false } }),
      ok({ status: 'disconnected', sta_ip: null, ssid: null })
    ]);

    await expect(new RpcShellyWifiClient(transport).read()).resolves.toMatchObject({
      ok: true,
      value: {
        config: { sta: { ssid: null, enable: false } },
        status: { status: 'disconnected', sta_ip: null, ssid: null }
      }
    });
  });

  it('rejects malformed Wi-Fi config', async () => {
    const transport = new QueueTransport([ok({ sta: { enable: true } })]);

    const result = await new RpcShellyWifiClient(transport).read();

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', retryable: false }
    });
    expect(transport.requests).toHaveLength(1);
  });

  it('rejects an unknown Wi-Fi connection status', async () => {
    const transport = new QueueTransport([
      ok({ sta: { ssid: 'Home', enable: true } }),
      ok({ status: 'mystery' })
    ]);

    const result = await new RpcShellyWifiClient(transport).read();

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', retryable: false }
    });
  });

  it('returns a transport failure without issuing the status RPC', async () => {
    const transport = new QueueTransport([offline()]);

    const result = await new RpcShellyWifiClient(transport).read();

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'shelly-offline', technicalMessage: 'offline' }
    });
    expect(transport.requests).toHaveLength(1);
  });

  it('sets the primary station with exactly one mutating RPC', async () => {
    const transport = new QueueTransport([ok({ restart_required: false })]);

    const result = await new RpcShellyWifiClient(transport).setStation({
      ssid: ' Lab Wi-Fi ',
      password: 'test-password'
    });

    expect(result).toEqual({ ok: true, value: { restart_required: false } });
    expect(transport.requests).toEqual([
      {
        method: RPC_METHODS.WifiSetConfig,
        params: {
          config: {
            sta: {
              ssid: ' Lab Wi-Fi ',
              pass: 'test-password',
              enable: true
            }
          }
        }
      }
    ]);
  });

  it('rejects a blank SSID without sending credentials', async () => {
    const transport = new QueueTransport([]);

    const result = await new RpcShellyWifiClient(transport).setStation({
      ssid: '   ',
      password: 'test-password'
    });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', retryable: false }
    });
    expect(transport.requests).toHaveLength(0);
  });

  it('does not retry a failed Wi-Fi mutation', async () => {
    const transport = new QueueTransport([offline()]);

    const result = await new RpcShellyWifiClient(transport).setStation({
      ssid: 'Home',
      password: 'test-password'
    });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'shelly-offline', technicalMessage: 'offline' }
    });
    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0]?.method).toBe(RPC_METHODS.WifiSetConfig);
  });
});

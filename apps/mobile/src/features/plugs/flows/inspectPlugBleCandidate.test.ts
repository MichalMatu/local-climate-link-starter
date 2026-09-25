import {
  type Result,
  type ShellyRpcRequest,
  type ShellyRpcTransport
} from '@lcl/shelly-client';
import { inspectPlugBleCandidate } from './inspectPlugBleCandidate.js';

class FakeDisconnectableTransport implements ShellyRpcTransport {
  readonly requests: ShellyRpcRequest[] = [];
  disconnectCalls = 0;

  constructor(private readonly responses: Result<unknown>[]) {}

  async call<TResponse>(request: ShellyRpcRequest): Promise<Result<TResponse>> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) {
      throw new Error('Missing queued response.');
    }
    return response as Result<TResponse>;
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls += 1;
  }
}

const ok = (value: unknown): Result<unknown> => ({ ok: true, value });

const fail = (technicalMessage: string): Result<unknown> => ({
  ok: false,
  error: {
    kind: 'shelly-offline',
    userMessageKey: 'errors.shellyOffline',
    technicalMessage,
    retryable: true
  }
});

const advertisement = {
  deviceId: 'E4:B0:63:E3:E2:9A',
  name: 'ShellyPlugSG3-E4B063E3E298',
  rssi: -44
};

describe('inspectPlugBleCandidate', () => {
  it('waits for BLE radio settle and returns a verified needs-wifi candidate', async () => {
    const transport = new FakeDisconnectableTransport([
      ok({
        id: 'shellyplugsg3-e4b063e3e298',
        model: 'S3PL-00112EU',
        gen: 3,
        fw_id: '1.2.3-matter22',
        matter: true
      }),
      ok({ sta: { ssid: null, enable: false } }),
      ok({ status: 'disconnected', sta_ip: null, ssid: null })
    ]);
    const sleepMs = vi.fn(async () => undefined);
    const createTransport = vi.fn(() => transport);

    const candidate = await inspectPlugBleCandidate(
      advertisement,
      {},
      { createTransport, sleepMs }
    );

    expect(sleepMs).toHaveBeenCalledWith(1200);
    expect(createTransport).toHaveBeenCalledWith(advertisement.deviceId);
    expect(candidate).toMatchObject({
      physicalId: 'shellyplugsg3-e4b063e3e298',
      model: 'S3PL-00112EU',
      generation: 3,
      network: { state: 'needs-wifi', connectionStatus: 'disconnected' }
    });
    expect(transport.requests.map((request) => request.method)).toEqual([
      'Shelly.GetDeviceInfo',
      'WiFi.GetConfig',
      'WiFi.GetStatus'
    ]);
    expect(transport.disconnectCalls).toBe(1);
  });

  it('classifies stored credentials even when the Plug is currently disconnected', async () => {
    const transport = new FakeDisconnectableTransport([
      ok({ id: 'plug-a', model: 'S3PL-00112EU', gen: 3 }),
      ok({ sta: { ssid: 'Home', enable: true } }),
      ok({ status: 'disconnected', sta_ip: null, ssid: null })
    ]);

    const candidate = await inspectPlugBleCandidate(
      advertisement,
      { radioSettleMs: 0 },
      { createTransport: () => transport, sleepMs: async () => undefined }
    );

    expect(candidate.network).toMatchObject({
      state: 'has-wifi',
      configuredSsids: ['Home'],
      connectionStatus: 'disconnected'
    });
    expect(transport.disconnectCalls).toBe(1);
  });

  it('always disconnects when identity inspection fails', async () => {
    const transport = new FakeDisconnectableTransport([fail('connection lost')]);

    await expect(
      inspectPlugBleCandidate(
        advertisement,
        { radioSettleMs: 0 },
        { createTransport: () => transport, sleepMs: async () => undefined }
      )
    ).rejects.toThrow('Shelly.GetDeviceInfo failed: connection lost');

    expect(transport.disconnectCalls).toBe(1);
    expect(transport.requests).toHaveLength(1);
  });

  it('always disconnects when Wi-Fi inspection fails', async () => {
    const transport = new FakeDisconnectableTransport([
      ok({ id: 'plug-a', model: 'S3PL-00112EU', gen: 3 }),
      fail('wifi rpc unavailable')
    ]);

    await expect(
      inspectPlugBleCandidate(
        advertisement,
        { radioSettleMs: 0 },
        { createTransport: () => transport, sleepMs: async () => undefined }
      )
    ).rejects.toThrow('Shelly Wi-Fi inspection failed: wifi rpc unavailable');

    expect(transport.disconnectCalls).toBe(1);
  });
});

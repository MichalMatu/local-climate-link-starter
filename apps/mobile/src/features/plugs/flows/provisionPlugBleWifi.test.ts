import {
  RPC_METHODS,
  type Result,
  type ShellyRpcRequest,
  type ShellyRpcTransport
} from '@lcl/shelly-client';
import type { VerifiedPlugBleCandidate } from '../data/plugBleOnboarding.js';
import { provisionPlugBleWifi } from './provisionPlugBleWifi.js';

class FakeTransport implements ShellyRpcTransport {
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

const offline = (): Result<unknown> => ({
  ok: false,
  error: {
    kind: 'shelly-offline',
    userMessageKey: 'errors.shellyOffline',
    technicalMessage: 'offline',
    retryable: true
  }
});

const candidate = (): VerifiedPlugBleCandidate => ({
  bleDeviceId: 'AA:BB:CC:DD:EE:FF',
  advertisementName: 'ShellyPlugSG3-AABBCCDDEEFF',
  rssi: -45,
  physicalId: 'shellyplugsg3-aabbccddeeff',
  model: 'S3PL-00112EU',
  generation: 3,
  firmwareId: '1.7.5',
  matterEnabled: false,
  network: {
    state: 'needs-wifi',
    configuredSsids: [],
    connectionStatus: 'disconnected',
    connectedSsid: null,
    stationIp: null
  }
});

const deviceInfo = (id = 'shellyplugsg3-aabbccddeeff') => ({
  id,
  model: 'S3PL-00112EU',
  gen: 3
});

describe('provisionPlugBleWifi', () => {
  it('verifies physical identity, writes Wi-Fi once and confirms read-back', async () => {
    const transport = new FakeTransport([
      ok(deviceInfo()),
      ok({ restart_required: false }),
      ok({ sta: { ssid: 'Home', enable: true } }),
      ok({ status: 'got ip', ssid: 'Home', sta_ip: '192.168.0.42', rssi: -50 })
    ]);

    const result = await provisionPlugBleWifi(
      { candidate: candidate(), ssid: 'Home', password: 'secret-value' },
      { verificationDelayMs: 0 },
      { createTransport: () => transport }
    );

    expect(result).toEqual({
      physicalId: 'shellyplugsg3-aabbccddeeff',
      restartRequired: false,
      verification: 'confirmed',
      network: {
        state: 'has-wifi',
        configuredSsids: ['Home'],
        connectionStatus: 'got ip',
        connectedSsid: 'Home',
        stationIp: '192.168.0.42'
      }
    });
    expect(transport.requests.map((request) => request.method)).toEqual([
      RPC_METHODS.ShellyGetDeviceInfo,
      RPC_METHODS.WifiSetConfig,
      RPC_METHODS.WifiGetConfig,
      RPC_METHODS.WifiGetStatus
    ]);
    expect(transport.requests[1]).toEqual({
      method: RPC_METHODS.WifiSetConfig,
      params: {
        config: {
          sta: { ssid: 'Home', pass: 'secret-value', enable: true }
        }
      }
    });
    expect(JSON.stringify(result)).not.toContain('secret-value');
    expect(transport.disconnectCalls).toBe(1);
  });

  it('blocks provisioning when BLE physical identity changed', async () => {
    const transport = new FakeTransport([ok(deviceInfo('shellyplugsg3-other'))]);

    await expect(
      provisionPlugBleWifi(
        { candidate: candidate(), ssid: 'Home', password: 'secret-value' },
        { verificationDelayMs: 0 },
        { createTransport: () => transport }
      )
    ).rejects.toThrow('identity changed');

    expect(transport.requests.map((request) => request.method)).toEqual([
      RPC_METHODS.ShellyGetDeviceInfo
    ]);
    expect(transport.disconnectCalls).toBe(1);
  });

  it('does not retry WiFi.SetConfig when the mutation fails', async () => {
    const transport = new FakeTransport([ok(deviceInfo()), offline()]);

    await expect(
      provisionPlugBleWifi(
        { candidate: candidate(), ssid: 'Home', password: 'secret-value' },
        { verificationDelayMs: 0 },
        { createTransport: () => transport }
      )
    ).rejects.toThrow('WiFi.SetConfig failed');

    expect(transport.requests.map((request) => request.method)).toEqual([
      RPC_METHODS.ShellyGetDeviceInfo,
      RPC_METHODS.WifiSetConfig
    ]);
    expect(transport.disconnectCalls).toBe(1);
  });

  it('reports pending verification when read-back is unavailable after accepted mutation', async () => {
    const transport = new FakeTransport([
      ok(deviceInfo()),
      ok({ restart_required: false }),
      offline()
    ]);

    const result = await provisionPlugBleWifi(
      { candidate: candidate(), ssid: 'Home', password: 'secret-value' },
      { verificationDelayMs: 0 },
      { createTransport: () => transport }
    );

    expect(result).toEqual({
      physicalId: 'shellyplugsg3-aabbccddeeff',
      restartRequired: false,
      verification: 'pending',
      network: null
    });
    expect(transport.requests.map((request) => request.method)).toEqual([
      RPC_METHODS.ShellyGetDeviceInfo,
      RPC_METHODS.WifiSetConfig,
      RPC_METHODS.WifiGetConfig
    ]);
    expect(transport.disconnectCalls).toBe(1);
  });
});

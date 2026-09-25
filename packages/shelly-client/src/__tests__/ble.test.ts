import { describe, expect, it } from 'vitest';
import { BleShellyRpcTransport, type ShellyBleGattPort } from '../rpc/ble.js';
import {
  SHELLY_BLE_RPC_DATA_UUID,
  SHELLY_BLE_RPC_RX_CONTROL_UUID,
  SHELLY_BLE_RPC_TX_CONTROL_UUID,
  encodeShellyBleFrameLength
} from '../rpc/bleProtocol.js';
import { RPC_METHODS } from '../model.js';

type PlannedResponse = {
  body: (requestId: number) => unknown;
  chunks?: number[];
  rxZeroPolls?: number;
};

class FakeGatt implements ShellyBleGattPort {
  connectCalls = 0;
  disconnectCalls = 0;
  writes: Array<{ characteristicUuid: string; value: Uint8Array }> = [];
  private active?: {
    bytes: Uint8Array;
    chunks: number[];
    offset: number;
    zeroPollsLeft: number;
  };
  private nextLength?: number;

  constructor(private readonly responses: PlannedResponse[]) {}

  async connect(): Promise<void> {
    this.connectCalls += 1;
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls += 1;
    this.active = undefined;
    this.nextLength = undefined;
  }

  async write(
    _deviceId: string,
    _serviceUuid: string,
    characteristicUuid: string,
    value: Uint8Array
  ): Promise<void> {
    this.writes.push({ characteristicUuid, value: new Uint8Array(value) });

    if (characteristicUuid === SHELLY_BLE_RPC_TX_CONTROL_UUID) {
      if (this.active) {
        throw new Error('concurrent BLE frame detected');
      }
      this.nextLength = new DataView(
        value.buffer,
        value.byteOffset,
        value.byteLength
      ).getUint32(0, false);
      return;
    }

    if (characteristicUuid === SHELLY_BLE_RPC_DATA_UUID) {
      if (this.nextLength !== value.byteLength) {
        throw new Error('payload length mismatch');
      }
      const request = JSON.parse(new TextDecoder().decode(value)) as { id: number };
      const plan = this.responses.shift();
      if (!plan) {
        throw new Error('no planned response');
      }
      const bytes = new TextEncoder().encode(JSON.stringify(plan.body(request.id)));
      this.active = {
        bytes,
        chunks: plan.chunks ?? [bytes.byteLength],
        offset: 0,
        zeroPollsLeft: plan.rxZeroPolls ?? 0
      };
      this.nextLength = undefined;
    }
  }

  async read(
    _deviceId: string,
    _serviceUuid: string,
    characteristicUuid: string
  ): Promise<Uint8Array> {
    if (!this.active) {
      throw new Error('no active response');
    }

    if (characteristicUuid === SHELLY_BLE_RPC_RX_CONTROL_UUID) {
      if (this.active.zeroPollsLeft > 0) {
        this.active.zeroPollsLeft -= 1;
        return new Uint8Array([0, 0, 0, 0]);
      }
      const length = encodeShellyBleFrameLength(this.active.bytes.byteLength);
      if (!length.ok) {
        throw new Error(length.error.message);
      }
      return length.value;
    }

    if (characteristicUuid === SHELLY_BLE_RPC_DATA_UUID) {
      const size = this.active.chunks.shift() ?? this.active.bytes.byteLength;
      const start = this.active.offset;
      const end = Math.min(start + size, this.active.bytes.byteLength);
      const chunk = this.active.bytes.slice(start, end);
      this.active.offset = end;
      if (this.active.offset >= this.active.bytes.byteLength) {
        this.active = undefined;
      }
      return chunk;
    }

    throw new Error(`unexpected read ${characteristicUuid}`);
  }
}

const createTransport = (
  gatt: ShellyBleGattPort,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {}
) =>
  new BleShellyRpcTransport({
    deviceId: 'device-1',
    gatt,
    defaultTimeoutMs: options.timeoutMs ?? 1000,
    pollIntervalMs: options.pollIntervalMs ?? 1
  });

describe('BleShellyRpcTransport', () => {
  it('sends Shelly RPC framing and returns result payload', async () => {
    const gatt = new FakeGatt([
      { body: (id) => ({ id, result: { model: 'S3PL-00112EU' } }) }
    ]);
    const transport = createTransport(gatt);

    const result = await transport.call<{ model: string }>({
      method: RPC_METHODS.ShellyGetDeviceInfo
    });

    expect(result).toEqual({ ok: true, value: { model: 'S3PL-00112EU' } });
    expect(gatt.connectCalls).toBe(1);
    expect(gatt.writes.map((entry) => entry.characteristicUuid)).toEqual([
      SHELLY_BLE_RPC_TX_CONTROL_UUID,
      SHELLY_BLE_RPC_DATA_UUID
    ]);
  });

  it('polls RX control and assembles a multi-chunk response', async () => {
    const gatt = new FakeGatt([
      {
        body: (id) => ({ id, result: { payload: 'x'.repeat(900) } }),
        chunks: [400, 300, 400],
        rxZeroPolls: 2
      }
    ]);
    const transport = createTransport(gatt);

    const result = await transport.call<{ payload: string }>({
      method: RPC_METHODS.ShellyGetStatus
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.payload).toHaveLength(900);
    }
  });

  it('maps a Shelly RPC error envelope', async () => {
    const gatt = new FakeGatt([
      { body: (id) => ({ id, error: { code: -1, message: 'denied' } }) }
    ]);
    const transport = createTransport(gatt);

    const result = await transport.call({ method: RPC_METHODS.ShellyGetStatus });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        kind: 'unknown',
        technicalMessage: 'denied'
      })
    });
  });

  it('rejects an already-aborted request without connecting', async () => {
    const gatt = new FakeGatt([]);
    const transport = createTransport(gatt);
    const controller = new AbortController();
    controller.abort();

    const result = await transport.call(
      { method: RPC_METHODS.ShellyGetStatus },
      { signal: controller.signal }
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'timeout', retryable: false })
    });
    expect(gatt.connectCalls).toBe(0);
  });

  it('times out while waiting for RX length and invalidates the connection', async () => {
    const gatt = new FakeGatt([
      {
        body: (id) => ({ id, result: {} }),
        rxZeroPolls: 10_000
      }
    ]);
    const transport = createTransport(gatt, { timeoutMs: 10, pollIntervalMs: 2 });

    const result = await transport.call({ method: RPC_METHODS.ShellyGetStatus });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'timeout' })
    });
    expect(gatt.disconnectCalls).toBe(1);
  });

  it('invalidates the connection on a mismatched response id', async () => {
    const gatt = new FakeGatt([
      { body: (id) => ({ id: id + 1, result: {} }) }
    ]);
    const transport = createTransport(gatt);

    const result = await transport.call({ method: RPC_METHODS.ShellyGetStatus });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'validation-failed' })
    });
    expect(gatt.disconnectCalls).toBe(1);
  });

  it('serializes concurrent callers on the shared BLE RPC channel', async () => {
    const gatt = new FakeGatt([
      { body: (id) => ({ id, result: { sequence: 1 } }), rxZeroPolls: 2 },
      { body: (id) => ({ id, result: { sequence: 2 } }) }
    ]);
    const transport = createTransport(gatt);

    const [first, second] = await Promise.all([
      transport.call<{ sequence: number }>({ method: RPC_METHODS.ShellyGetStatus }),
      transport.call<{ sequence: number }>({ method: RPC_METHODS.ShellyGetStatus })
    ]);

    expect(first).toEqual({ ok: true, value: { sequence: 1 } });
    expect(second).toEqual({ ok: true, value: { sequence: 2 } });
    expect(gatt.connectCalls).toBe(1);
  });
});

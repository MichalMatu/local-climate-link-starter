import { describe, expect, it } from 'vitest';
import { RPC_METHODS } from '../model.js';
import {
  assembleShellyBleRpcFrame,
  decodeShellyBleFrameLength,
  decodeShellyBleRpcResponse,
  encodeShellyBleFrameLength,
  encodeShellyBleRpcRequestFrame
} from '../rpc/bleProtocol.js';

const textBytes = (value: string): Uint8Array => new TextEncoder().encode(value);

describe('Shelly BLE RPC protocol', () => {
  it('encodes and decodes the 4-byte big-endian frame length', () => {
    const encoded = encodeShellyBleFrameLength(1244);
    expect(encoded).toEqual({ ok: true, value: new Uint8Array([0, 0, 4, 220]) });

    const decoded = decodeShellyBleFrameLength(new Uint8Array([0, 0, 4, 220]));
    expect(decoded).toEqual({ ok: true, value: 1244 });
  });

  it('rejects malformed control lengths', () => {
    const decoded = decodeShellyBleFrameLength(new Uint8Array([0, 1, 2]));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error.kind).toBe('invalid-length');
    }
  });

  it('builds a deterministic UTF-8 request frame', () => {
    const frame = encodeShellyBleRpcRequestFrame(42, {
      method: RPC_METHODS.PlugsUiSetConfig,
      params: { config: { name: 'Łódź' } }
    });

    expect(frame.ok).toBe(true);
    if (!frame.ok) {
      return;
    }

    const payload = new TextDecoder().decode(frame.value.payloadBytes);
    expect(JSON.parse(payload)).toEqual({
      id: 42,
      method: 'PLUGS_UI.SetConfig',
      params: { config: { name: 'Łódź' } }
    });
    expect(decodeShellyBleFrameLength(frame.value.lengthBytes)).toEqual({
      ok: true,
      value: frame.value.payloadBytes.byteLength
    });
  });

  it('omits params when the RPC request does not define them', () => {
    const frame = encodeShellyBleRpcRequestFrame(7, {
      method: RPC_METHODS.ShellyGetDeviceInfo
    });
    expect(frame.ok).toBe(true);
    if (!frame.ok) {
      return;
    }

    expect(JSON.parse(new TextDecoder().decode(frame.value.payloadBytes))).toEqual({
      id: 7,
      method: 'Shelly.GetDeviceInfo'
    });
  });

  it('assembles a response split across multiple GATT reads', () => {
    const source = textBytes('x'.repeat(1244));
    const result = assembleShellyBleRpcFrame(1244, [
      source.slice(0, 500),
      source.slice(500, 1000),
      source.slice(1000)
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(source);
    }
  });

  it('rejects incomplete and overflowing response data', () => {
    const incomplete = assembleShellyBleRpcFrame(4, [new Uint8Array([1, 2, 3])]);
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) {
      expect(incomplete.error.kind).toBe('incomplete-frame');
    }

    const overflow = assembleShellyBleRpcFrame(2, [new Uint8Array([1, 2, 3])]);
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) {
      expect(overflow.error.kind).toBe('frame-overflow');
    }
  });

  it('decodes a matching result envelope', () => {
    const decoded = decodeShellyBleRpcResponse(
      7002,
      textBytes(
        JSON.stringify({
          id: 7002,
          src: 'shellyplugsg3-example',
          result: { model: 'S3PL-00112EU', gen: 3 }
        })
      )
    );

    expect(decoded).toEqual({
      ok: true,
      value: {
        id: 7002,
        src: 'shellyplugsg3-example',
        result: { model: 'S3PL-00112EU', gen: 3 }
      }
    });
  });

  it('keeps Shelly RPC error envelopes as valid protocol responses', () => {
    const decoded = decodeShellyBleRpcResponse(
      10,
      textBytes(JSON.stringify({ id: 10, error: { code: 404, message: 'No handler' } }))
    );

    expect(decoded).toEqual({
      ok: true,
      value: {
        id: 10,
        error: { code: 404, message: 'No handler' }
      }
    });
  });

  it('rejects invalid JSON and mismatched response ids', () => {
    const invalidJson = decodeShellyBleRpcResponse(1, textBytes('{not json'));
    expect(invalidJson.ok).toBe(false);
    if (!invalidJson.ok) {
      expect(invalidJson.error.kind).toBe('invalid-json');
    }

    const mismatch = decodeShellyBleRpcResponse(
      1,
      textBytes(JSON.stringify({ id: 2, result: null }))
    );
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) {
      expect(mismatch.error.kind).toBe('response-id-mismatch');
    }
  });
});

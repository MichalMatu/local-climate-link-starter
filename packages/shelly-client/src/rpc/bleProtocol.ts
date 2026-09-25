import type { ShellyRpcRequest } from '../model.js';

export const SHELLY_BLE_RPC_SERVICE_UUID =
  '5f6d4f53-5f52-5043-5f53-56435f49445f';
export const SHELLY_BLE_RPC_DATA_UUID =
  '5f6d4f53-5f52-5043-5f64-6174615f5f5f';
export const SHELLY_BLE_RPC_TX_CONTROL_UUID =
  '5f6d4f53-5f52-5043-5f74-785f63746c5f';
export const SHELLY_BLE_RPC_RX_CONTROL_UUID =
  '5f6d4f53-5f52-5043-5f72-785f63746c5f';

const UINT32_MAX = 0xffff_ffff;

export type ShellyBleProtocolErrorKind =
  | 'invalid-length'
  | 'incomplete-frame'
  | 'frame-overflow'
  | 'invalid-json'
  | 'invalid-envelope'
  | 'response-id-mismatch';

export interface ShellyBleProtocolError {
  kind: ShellyBleProtocolErrorKind;
  message: string;
}

export type ShellyBleProtocolResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ShellyBleProtocolError };

export interface ShellyBleRpcRequestFrame {
  lengthBytes: Uint8Array;
  payloadBytes: Uint8Array;
}

export interface ShellyBleRpcErrorEnvelope {
  code?: number | undefined;
  message?: string | undefined;
}

export interface ShellyBleRpcEnvelope {
  id: number;
  src?: string | undefined;
  result?: unknown;
  params?: unknown;
  error?: ShellyBleRpcErrorEnvelope | undefined;
}

const protocolError = (
  kind: ShellyBleProtocolErrorKind,
  message: string
): ShellyBleProtocolResult<never> => ({
  ok: false,
  error: { kind, message }
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isValidFrameLength = (length: number): boolean =>
  Number.isInteger(length) && length >= 0 && length <= UINT32_MAX;

export const encodeShellyBleFrameLength = (
  length: number
): ShellyBleProtocolResult<Uint8Array> => {
  if (!isValidFrameLength(length)) {
    return protocolError(
      'invalid-length',
      `BLE RPC frame length must be an unsigned 32-bit integer, got ${length}.`
    );
  }

  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, length, false);
  return { ok: true, value: bytes };
};

export const decodeShellyBleFrameLength = (
  bytes: Uint8Array
): ShellyBleProtocolResult<number> => {
  if (bytes.byteLength !== 4) {
    return protocolError(
      'invalid-length',
      `BLE RPC control length must contain exactly 4 bytes, got ${bytes.byteLength}.`
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { ok: true, value: view.getUint32(0, false) };
};

export const encodeShellyBleRpcRequestFrame = (
  requestId: number,
  request: ShellyRpcRequest
): ShellyBleProtocolResult<ShellyBleRpcRequestFrame> => {
  if (!Number.isInteger(requestId) || requestId < 0 || requestId > UINT32_MAX) {
    return protocolError(
      'invalid-envelope',
      `BLE RPC request id must be an unsigned 32-bit integer, got ${requestId}.`
    );
  }

  const payloadBytes = new TextEncoder().encode(
    JSON.stringify({
      id: requestId,
      method: request.method,
      ...(request.params === undefined ? {} : { params: request.params })
    })
  );
  const length = encodeShellyBleFrameLength(payloadBytes.byteLength);
  if (!length.ok) {
    return length;
  }

  return {
    ok: true,
    value: {
      lengthBytes: length.value,
      payloadBytes
    }
  };
};

export const assembleShellyBleRpcFrame = (
  expectedLength: number,
  chunks: readonly Uint8Array[]
): ShellyBleProtocolResult<Uint8Array> => {
  if (!isValidFrameLength(expectedLength) || expectedLength === 0) {
    return protocolError(
      'invalid-length',
      `BLE RPC response frame length must be a positive unsigned 32-bit integer, got ${expectedLength}.`
    );
  }

  const receivedLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  if (receivedLength < expectedLength) {
    return protocolError(
      'incomplete-frame',
      `BLE RPC response expected ${expectedLength} bytes but received ${receivedLength}.`
    );
  }
  if (receivedLength > expectedLength) {
    return protocolError(
      'frame-overflow',
      `BLE RPC response expected ${expectedLength} bytes but received ${receivedLength}.`
    );
  }

  const frame = new Uint8Array(expectedLength);
  let offset = 0;
  for (const chunk of chunks) {
    frame.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, value: frame };
};

export const decodeShellyBleRpcResponse = (
  requestId: number,
  frameBytes: Uint8Array
): ShellyBleProtocolResult<ShellyBleRpcEnvelope> => {
  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder().decode(frameBytes));
  } catch {
    return protocolError('invalid-json', 'BLE RPC response is not valid JSON.');
  }

  if (!isRecord(decoded) || typeof decoded.id !== 'number') {
    return protocolError(
      'invalid-envelope',
      'BLE RPC response must be an object with a numeric id.'
    );
  }
  if (decoded.id !== requestId) {
    return protocolError(
      'response-id-mismatch',
      `BLE RPC response id ${decoded.id} does not match request id ${requestId}.`
    );
  }

  const error = isRecord(decoded.error)
    ? {
        ...(typeof decoded.error.code === 'number'
          ? { code: decoded.error.code }
          : {}),
        ...(typeof decoded.error.message === 'string'
          ? { message: decoded.error.message }
          : {})
      }
    : undefined;

  return {
    ok: true,
    value: {
      id: decoded.id,
      ...(typeof decoded.src === 'string' ? { src: decoded.src } : {}),
      ...('result' in decoded ? { result: decoded.result } : {}),
      ...('params' in decoded ? { params: decoded.params } : {}),
      ...(error ? { error } : {})
    }
  };
};

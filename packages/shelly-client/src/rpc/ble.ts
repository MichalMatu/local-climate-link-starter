import type { Result, ShellyRpcRequest, ShellyRpcTransport } from '../model.js';
import {
  canceledError,
  isShellyClientError,
  offlineError,
  protocolError,
  responseTooLargeError,
  rpcError,
  timeoutError
} from './bleErrors.js';
import {
  SHELLY_BLE_RPC_DATA_UUID,
  SHELLY_BLE_RPC_RX_CONTROL_UUID,
  SHELLY_BLE_RPC_SERVICE_UUID,
  SHELLY_BLE_RPC_TX_CONTROL_UUID,
  assembleShellyBleRpcFrame,
  decodeShellyBleFrameLength,
  decodeShellyBleRpcResponse,
  encodeShellyBleRpcRequestFrame
} from './bleProtocol.js';

export interface ShellyBleGattPort {
  connect(deviceId: string, options?: { timeoutMs?: number }): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  read(
    deviceId: string,
    serviceUuid: string,
    characteristicUuid: string,
    options?: { timeoutMs?: number }
  ): Promise<Uint8Array>;
  write(
    deviceId: string,
    serviceUuid: string,
    characteristicUuid: string,
    value: Uint8Array,
    options?: { timeoutMs?: number }
  ): Promise<void>;
}

export interface BleShellyRpcTransportOptions {
  deviceId: string;
  gatt: ShellyBleGattPort;
  defaultTimeoutMs?: number;
  pollIntervalMs?: number;
  maxResponseBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;

export class BleShellyRpcTransport implements ShellyRpcTransport {
  private readonly defaultTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly maxResponseBytes: number;
  private connected = false;
  private nextRequestId = 1;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly options: BleShellyRpcTransportOptions) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  }

  async disconnect(): Promise<void> {
    await this.invalidateConnection();
  }

  async call<TResponse>(
    request: ShellyRpcRequest,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<Result<TResponse>> {
    return this.serialize(() => this.callExclusive<TResponse>(request, options));
  }

  private async serialize<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  private async callExclusive<TResponse>(
    request: ShellyRpcRequest,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<Result<TResponse>> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const signal = options?.signal;
    const deadline = Date.now() + timeoutMs;

    if (signal?.aborted) {
      return { ok: false, error: canceledError() };
    }

    const requestId = this.allocateRequestId();
    const encoded = encodeShellyBleRpcRequestFrame(requestId, request);
    if (!encoded.ok) {
      return { ok: false, error: protocolError(encoded.error) };
    }

    try {
      await this.ensureConnected(deadline, timeoutMs, signal);
      await this.runGattStep(
        this.options.gatt.write(
          this.options.deviceId,
          SHELLY_BLE_RPC_SERVICE_UUID,
          SHELLY_BLE_RPC_TX_CONTROL_UUID,
          encoded.value.lengthBytes,
          { timeoutMs: this.remainingMs(deadline, timeoutMs) }
        ),
        deadline,
        timeoutMs,
        signal
      );
      await this.runGattStep(
        this.options.gatt.write(
          this.options.deviceId,
          SHELLY_BLE_RPC_SERVICE_UUID,
          SHELLY_BLE_RPC_DATA_UUID,
          encoded.value.payloadBytes,
          { timeoutMs: this.remainingMs(deadline, timeoutMs) }
        ),
        deadline,
        timeoutMs,
        signal
      );

      const expectedLength = await this.readResponseLength(deadline, timeoutMs, signal);
      if (expectedLength > this.maxResponseBytes) {
        throw responseTooLargeError(expectedLength, this.maxResponseBytes);
      }

      const chunks: Uint8Array[] = [];
      let received = 0;
      while (received < expectedLength) {
        const chunk = await this.runGattStep(
          this.options.gatt.read(
            this.options.deviceId,
            SHELLY_BLE_RPC_SERVICE_UUID,
            SHELLY_BLE_RPC_DATA_UUID,
            { timeoutMs: this.remainingMs(deadline, timeoutMs) }
          ),
          deadline,
          timeoutMs,
          signal
        );
        if (chunk.byteLength === 0) {
          throw protocolError({
            kind: 'incomplete-frame',
            message:
              'Shelly BLE RPC returned an empty data chunk before the frame completed.'
          });
        }
        chunks.push(chunk);
        received += chunk.byteLength;
        if (received > expectedLength) {
          break;
        }
      }

      const assembled = assembleShellyBleRpcFrame(expectedLength, chunks);
      if (!assembled.ok) {
        throw protocolError(assembled.error);
      }
      const decoded = decodeShellyBleRpcResponse(requestId, assembled.value);
      if (!decoded.ok) {
        throw protocolError(decoded.error);
      }
      if (decoded.value.error) {
        return { ok: false, error: rpcError(decoded.value.error.message) };
      }
      if ('result' in decoded.value) {
        return { ok: true, value: decoded.value.result as TResponse };
      }
      if ('params' in decoded.value) {
        return { ok: true, value: decoded.value.params as TResponse };
      }
      return { ok: true, value: decoded.value as TResponse };
    } catch (cause) {
      await this.invalidateConnection();
      return {
        ok: false,
        error: isShellyClientError(cause) ? cause : offlineError(cause)
      };
    }
  }

  private allocateRequestId(): number {
    const requestId = this.nextRequestId;
    this.nextRequestId = requestId >= 0xffff_ffff ? 1 : requestId + 1;
    return requestId;
  }

  private remainingMs(deadline: number, timeoutMs: number): number {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw timeoutError(timeoutMs);
    }
    return remaining;
  }

  private async ensureConnected(
    deadline: number,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<void> {
    if (this.connected) {
      return;
    }
    await this.runGattStep(
      this.options.gatt.connect(this.options.deviceId, {
        timeoutMs: this.remainingMs(deadline, timeoutMs)
      }),
      deadline,
      timeoutMs,
      signal
    );
    this.connected = true;
  }

  private async readResponseLength(
    deadline: number,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<number> {
    while (true) {
      const bytes = await this.runGattStep(
        this.options.gatt.read(
          this.options.deviceId,
          SHELLY_BLE_RPC_SERVICE_UUID,
          SHELLY_BLE_RPC_RX_CONTROL_UUID,
          { timeoutMs: this.remainingMs(deadline, timeoutMs) }
        ),
        deadline,
        timeoutMs,
        signal
      );
      const decoded = decodeShellyBleFrameLength(bytes);
      if (!decoded.ok) {
        throw protocolError(decoded.error);
      }
      if (decoded.value > 0) {
        return decoded.value;
      }
      await this.sleep(this.pollIntervalMs, deadline, timeoutMs, signal);
    }
  }

  private async runGattStep<T>(
    task: Promise<T>,
    deadline: number,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<T> {
    const remaining = this.remainingMs(deadline, timeoutMs);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let abortListener: (() => void) | undefined;

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(timeoutError(timeoutMs)), remaining);
    });
    const canceled = new Promise<never>((_, reject) => {
      if (!signal) {
        return;
      }
      abortListener = () => reject(canceledError());
      if (signal.aborted) {
        abortListener();
      } else {
        signal.addEventListener('abort', abortListener, { once: true });
      }
    });

    try {
      return await Promise.race([task, timeout, canceled]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      if (signal && abortListener) {
        signal.removeEventListener('abort', abortListener);
      }
    }
  }

  private async sleep(
    delayMs: number,
    deadline: number,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<void> {
    const remaining = this.remainingMs(deadline, timeoutMs);
    const duration = Math.min(delayMs, remaining);
    await this.runGattStep(
      new Promise<void>((resolve) => setTimeout(resolve, duration)),
      deadline,
      timeoutMs,
      signal
    );
  }

  private async invalidateConnection(): Promise<void> {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    await this.options.gatt.disconnect(this.options.deviceId).catch(() => undefined);
  }
}

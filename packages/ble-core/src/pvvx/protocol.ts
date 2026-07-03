import type { Measurement } from '../model.js';

export const PVVX_SERVICE_UUID = '00001f10-0000-1000-8000-00805f9b34fb';
export const PVVX_CHARACTERISTIC_UUID = '00001f1f-0000-1000-8000-00805f9b34fb';
export const PVVX_MAX_MEMO_SAMPLES = 19632;

const PVVX_CMD_TIME = 0x23;
const PVVX_CMD_MEMO = 0x35;

export interface PvvxMemoSample {
  index: number;
  timestampSec: number;
  temperatureC: number;
  humidityPct: number;
  voltageV: number;
}

export interface PvvxTimeStatus {
  currentTimeSec: number;
  previousTimeSec?: number | undefined;
}

export type PvvxNotification =
  | { kind: 'memo-sample'; sample: PvvxMemoSample }
  | { kind: 'memo-complete'; count: number }
  | { kind: 'time'; status: PvvxTimeStatus }
  | { kind: 'unknown'; command: number };

const clampUint16 = (value: number, max: number): number =>
  Math.max(0, Math.min(max, Math.trunc(value)));

export const createPvvxReadMemoCommand = (count: number, startIndex = 0): Uint8Array => {
  const safeCount = clampUint16(count, PVVX_MAX_MEMO_SAMPLES);
  const safeStart = clampUint16(startIndex, 0xffff);
  return new Uint8Array([
    PVVX_CMD_MEMO,
    safeCount & 0xff,
    (safeCount >> 8) & 0xff,
    safeStart & 0xff,
    (safeStart >> 8) & 0xff
  ]);
};

export const createPvvxSetTimeCommand = (timeSec: number): Uint8Array => {
  const safeTimeSec = Math.max(0, Math.trunc(timeSec));
  const command = new Uint8Array(5);
  const view = new DataView(command.buffer);
  view.setUint8(0, PVVX_CMD_TIME);
  view.setUint32(1, safeTimeSec, true);
  return command;
};

export const toPvvxLocalTimeSec = (date: Date): number =>
  Math.floor(date.getTime() / 1000) - date.getTimezoneOffset() * 60;

export const parsePvvxNotification = (payload: Uint8Array): PvvxNotification => {
  if (payload.byteLength === 0) {
    return { kind: 'unknown', command: -1 };
  }

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const command = view.getUint8(0);

  if (command === PVVX_CMD_MEMO && payload.byteLength >= 13) {
    return {
      kind: 'memo-sample',
      sample: {
        index: view.getUint16(1, true),
        timestampSec: view.getUint32(3, true),
        temperatureC: view.getInt16(7, true) / 100,
        humidityPct: view.getUint16(9, true) / 100,
        voltageV: view.getUint16(11, true) / 1000
      }
    };
  }

  if (command === PVVX_CMD_MEMO && payload.byteLength >= 3) {
    return {
      kind: 'memo-complete',
      count: view.getUint16(1, true)
    };
  }

  if (command === PVVX_CMD_TIME && payload.byteLength >= 5) {
    return {
      kind: 'time',
      status: {
        currentTimeSec: view.getUint32(1, true),
        previousTimeSec: payload.byteLength >= 9 ? view.getUint32(5, true) : undefined
      }
    };
  }

  return { kind: 'unknown', command };
};

export const pvvxMemoSampleToMeasurement = (
  sensorId: string,
  sample: PvvxMemoSample
): Measurement => ({
  sensorId,
  source: 'pvvx-history',
  temperatureC: sample.temperatureC,
  humidityPct: sample.humidityPct,
  voltageV: sample.voltageV,
  seenAtMs: sample.timestampSec * 1000
});

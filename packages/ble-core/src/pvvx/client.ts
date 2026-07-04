import type { BleGattClient, BleGattSubscription, Measurement } from '../model.js';
import {
  createPvvxReadMemoCommand,
  createPvvxSetTimeCommand,
  parsePvvxNotification,
  pvvxMemoSampleToMeasurement,
  PVVX_CHARACTERISTIC_UUID,
  PVVX_SERVICE_UUID,
  toPvvxDeviceTimeSec,
  type PvvxMemoSample,
  type PvvxTimeStatus
} from './protocol.js';

export interface ReadPvvxMemoOptions {
  gatt: BleGattClient;
  deviceId: string;
  sensorId: string;
  count?: number;
  timeoutMs?: number;
  timezoneOffsetMinutes?: number;
}

export interface SetPvvxTimeOptions {
  gatt: BleGattClient;
  deviceId: string;
  now?: Date;
  timeoutMs?: number;
  timezoneOffsetMinutes?: number;
}

export interface PvvxMemoResult {
  samples: PvvxMemoSample[];
  measurements: Measurement[];
}

const DEFAULT_MEMO_COUNT = 50;
const DEFAULT_MEMO_TIMEOUT_MS = 18000;
const DEFAULT_TIME_TIMEOUT_MS = 6000;

const stopSubscription = async (
  subscription: BleGattSubscription | null
): Promise<void> => {
  await subscription?.stop().catch(() => undefined);
};

export const readPvvxMemoHistory = async ({
  gatt,
  deviceId,
  sensorId,
  count = DEFAULT_MEMO_COUNT,
  timeoutMs = DEFAULT_MEMO_TIMEOUT_MS,
  timezoneOffsetMinutes
}: ReadPvvxMemoOptions): Promise<PvvxMemoResult> => {
  const samples: PvvxMemoSample[] = [];
  let subscription: BleGattSubscription | null = null;
  let resolveComplete: (() => void) | null = null;
  let rejectComplete: ((error: Error) => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const completion = new Promise<void>((resolve, reject) => {
    resolveComplete = resolve;
    rejectComplete = reject;
  });

  try {
    await gatt.connect(deviceId, { timeoutMs });
    subscription = await gatt.startNotifications(
      deviceId,
      PVVX_SERVICE_UUID,
      PVVX_CHARACTERISTIC_UUID,
      (notification) => {
        const parsed = parsePvvxNotification(notification.value);
        if (parsed.kind === 'memo-sample') {
          samples.push(parsed.sample);
          if (samples.length >= count) {
            resolveComplete?.();
          }
          return;
        }
        if (parsed.kind === 'memo-complete') {
          resolveComplete?.();
        }
      },
      { timeoutMs }
    );

    await gatt.write(
      deviceId,
      PVVX_SERVICE_UUID,
      PVVX_CHARACTERISTIC_UUID,
      createPvvxReadMemoCommand(count),
      { timeoutMs }
    );
    timeoutId = setTimeout(() => {
      rejectComplete?.(new Error('PVVX history read timed out.'));
    }, timeoutMs);
    await completion;

    const sortedSamples = [...samples].sort(
      (first, second) => first.timestampSec - second.timestampSec
    );
    return {
      samples: sortedSamples,
      measurements: sortedSamples.map((sample) =>
        pvvxMemoSampleToMeasurement(sensorId, sample, timezoneOffsetMinutes)
      )
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    await stopSubscription(subscription);
    await gatt.disconnect(deviceId);
  }
};

export const setPvvxDeviceTime = async ({
  gatt,
  deviceId,
  now = new Date(),
  timeoutMs = DEFAULT_TIME_TIMEOUT_MS,
  timezoneOffsetMinutes
}: SetPvvxTimeOptions): Promise<PvvxTimeStatus | null> => {
  let subscription: BleGattSubscription | null = null;
  let resolveStatus: ((status: PvvxTimeStatus | null) => void) | null = null;
  const completion = new Promise<PvvxTimeStatus | null>((resolve) => {
    resolveStatus = resolve;
  });
  const timeoutId = setTimeout(() => {
    resolveStatus?.(null);
  }, timeoutMs);

  try {
    await gatt.connect(deviceId, { timeoutMs });
    subscription = await gatt.startNotifications(
      deviceId,
      PVVX_SERVICE_UUID,
      PVVX_CHARACTERISTIC_UUID,
      (notification) => {
        const parsed = parsePvvxNotification(notification.value);
        if (parsed.kind === 'time') {
          resolveStatus?.(parsed.status);
        }
      },
      { timeoutMs }
    );
    await gatt.write(
      deviceId,
      PVVX_SERVICE_UUID,
      PVVX_CHARACTERISTIC_UUID,
      createPvvxSetTimeCommand(toPvvxDeviceTimeSec(now, timezoneOffsetMinutes)),
      { timeoutMs }
    );
    return await completion;
  } finally {
    clearTimeout(timeoutId);
    await stopSubscription(subscription);
    await gatt.disconnect(deviceId);
  }
};

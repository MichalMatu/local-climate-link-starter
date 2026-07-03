import type {
  BleGattClient,
  BleGattNotification,
  BleGattSubscription
} from '../model.js';
import {
  createPvvxReadMemoCommand,
  createPvvxSetTimeCommand,
  parsePvvxNotification,
  readPvvxMemoHistory,
  setPvvxDeviceTime,
  toPvvxLocalTimeSec
} from '../index.js';

const bytes = (values: number[]): Uint8Array => new Uint8Array(values);

const memoSamplePayload = ({
  index,
  timestampSec,
  temperatureC,
  humidityPct,
  voltageMv
}: {
  index: number;
  timestampSec: number;
  temperatureC: number;
  humidityPct: number;
  voltageMv: number;
}): Uint8Array => {
  const payload = new Uint8Array(13);
  const view = new DataView(payload.buffer);
  view.setUint8(0, 0x35);
  view.setUint16(1, index, true);
  view.setUint32(3, timestampSec, true);
  view.setInt16(7, Math.round(temperatureC * 100), true);
  view.setUint16(9, Math.round(humidityPct * 100), true);
  view.setUint16(11, voltageMv, true);
  return payload;
};

class FakeGattClient implements BleGattClient {
  readonly writes: Uint8Array[] = [];
  private onNotification: ((notification: BleGattNotification) => void) | null = null;

  async initialize(): Promise<void> {
    return undefined;
  }

  async connect(): Promise<void> {
    return undefined;
  }

  async disconnect(): Promise<void> {
    return undefined;
  }

  async read(): Promise<Uint8Array> {
    return new Uint8Array();
  }

  async write(
    deviceId: string,
    serviceUuid: string,
    characteristicUuid: string,
    value: Uint8Array
  ): Promise<void> {
    this.writes.push(value);
    if (value[0] === 0x35) {
      queueMicrotask(() => {
        this.emit(deviceId, serviceUuid, characteristicUuid, [
          memoSamplePayload({
            index: 2,
            timestampSec: 1_720_000_120,
            temperatureC: 22.35,
            humidityPct: 45.67,
            voltageMv: 3001
          }),
          bytes([0x35, 0x01, 0x00])
        ]);
      });
    }
    if (value[0] === 0x23) {
      queueMicrotask(() => {
        const payload = new Uint8Array(9);
        const view = new DataView(payload.buffer);
        view.setUint8(0, 0x23);
        view.setUint32(1, 1_720_000_000, true);
        view.setUint32(5, 1_719_999_000, true);
        this.emit(deviceId, serviceUuid, characteristicUuid, [payload]);
      });
    }
  }

  async startNotifications(
    _deviceId: string,
    _serviceUuid: string,
    _characteristicUuid: string,
    onNotification: (notification: BleGattNotification) => void
  ): Promise<BleGattSubscription> {
    this.onNotification = onNotification;
    return {
      stop: async () => {
        this.onNotification = null;
      }
    };
  }

  private emit(
    deviceId: string,
    serviceUuid: string,
    characteristicUuid: string,
    payloads: Uint8Array[]
  ): void {
    for (const value of payloads) {
      this.onNotification?.({ deviceId, serviceUuid, characteristicUuid, value });
    }
  }
}

describe('PVVX protocol', () => {
  it('builds memo and time commands in the PVVX byte order', () => {
    expect(Array.from(createPvvxReadMemoCommand(50, 3))).toEqual([
      0x35, 0x32, 0x00, 0x03, 0x00
    ]);
    expect(Array.from(createPvvxSetTimeCommand(0x01020304))).toEqual([
      0x23, 0x04, 0x03, 0x02, 0x01
    ]);
  });

  it('parses PVVX history samples and completion notifications', () => {
    expect(
      parsePvvxNotification(
        memoSamplePayload({
          index: 7,
          timestampSec: 1_720_000_000,
          temperatureC: -3.25,
          humidityPct: 61.5,
          voltageMv: 2980
        })
      )
    ).toEqual({
      kind: 'memo-sample',
      sample: {
        index: 7,
        timestampSec: 1_720_000_000,
        temperatureC: -3.25,
        humidityPct: 61.5,
        voltageV: 2.98
      }
    });

    expect(parsePvvxNotification(bytes([0x35, 0x07, 0x00]))).toEqual({
      kind: 'memo-complete',
      count: 7
    });
  });

  it('ignores empty PVVX notifications without throwing', () => {
    expect(parsePvvxNotification(new Uint8Array())).toEqual({
      kind: 'unknown',
      command: -1
    });
  });

  it('translates JavaScript time to PVVX local timestamp seconds', () => {
    const date = new Date('2026-07-03T10:00:00.000Z');
    const expected = Math.floor(date.getTime() / 1000) - date.getTimezoneOffset() * 60;

    expect(toPvvxLocalTimeSec(date)).toBe(expected);
  });
});

describe('PVVX GATT client helpers', () => {
  it('reads history samples into normalized measurements', async () => {
    const gatt = new FakeGattClient();

    const result = await readPvvxMemoHistory({
      gatt,
      deviceId: 'A4:C1:38:4F:24:CD',
      sensorId: 'A4:C1:38:4F:24:CD',
      count: 1,
      timeoutMs: 500
    });

    expect(gatt.writes[0]).toEqual(createPvvxReadMemoCommand(1));
    expect(result.samples).toHaveLength(1);
    expect(result.measurements[0]).toMatchObject({
      sensorId: 'A4:C1:38:4F:24:CD',
      source: 'pvvx-history',
      temperatureC: 22.35,
      humidityPct: 45.67,
      voltageV: 3.001,
      seenAtMs: 1_720_000_120_000
    });
  });

  it('sets PVVX time and returns the device acknowledgement when it arrives', async () => {
    const gatt = new FakeGattClient();

    const status = await setPvvxDeviceTime({
      gatt,
      deviceId: 'A4:C1:38:4F:24:CD',
      now: new Date('2024-07-03T10:00:00.000Z'),
      timeoutMs: 500
    });

    expect(gatt.writes[0]?.[0]).toBe(0x23);
    expect(status).toEqual({
      currentTimeSec: 1_720_000_000,
      previousTimeSec: 1_719_999_000
    });
  });
});

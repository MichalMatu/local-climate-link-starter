import { describe, expect, it } from 'vitest';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript
} from '../index.js';

const createExecutableTp357Runtime = () => {
  const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'humidifying');
  const address = 'AA:BB:CC:DD:EE:01';
  const script = generateShellyThermostatScript({
    ...base,
    sensor: {
      ...base.sensor,
      runtimeAddress: address
    },
    rule: {
      ...base.rule,
      consecutiveHits: 1
    }
  });
  let scanCallback:
    | ((event: string, result: { addr: string; advData: number[]; rssi: number }) => void)
    | undefined;
  const shelly = {
    call: (
      _method: string,
      _params: unknown,
      callback?: (_result: unknown, code: number) => void
    ) => callback?.({}, 0),
    getComponentStatus: () => ({ output: false }),
    getUptimeMs: () => Date.now()
  };
  const ble = {
    Scanner: {
      SCAN_RESULT: 'scan-result',
      stop: () => undefined,
      subscribe: (
        callback: (
          event: string,
          result: { addr: string; advData: number[]; rssi: number }
        ) => void
      ) => {
        scanCallback = callback;
      },
      start: () => true
    }
  };
  const timer = { set: () => undefined };
  const runtime = new Function(
    'Shelly',
    'BLE',
    'Timer',
    `${script}\nreturn {diag:function(){return JSON.parse(diag());}};`
  )(shelly, ble, timer) as { diag: () => { g: unknown[] } };

  if (!scanCallback) {
    throw new Error('Generated runtime did not subscribe to BLE scanner.');
  }
  return { address, runtime, scan: scanCallback };
};

const manufacturerAdvertisement = (payload: number[]): number[] => [
  payload.length + 1,
  0xff,
  ...payload
];

describe('TP357 battery decoding in generated Shelly runtime', () => {
  it.each([
    [0x00, 1],
    [0x01, 50],
    [0x02, 100],
    [0x22, 100]
  ])('maps raw battery byte %s to %s%%', (batteryRaw, expectedBatteryPct) => {
    const { address, runtime, scan } = createExecutableTp357Runtime();

    scan('scan-result', {
      addr: address,
      advData: manufacturerAdvertisement([0xc2, 0xdc, 0x00, 0x32, batteryRaw, 0x2c]),
      rssi: -50
    });

    expect(runtime.diag().g[1]).toBe(22);
    expect(runtime.diag().g[2]).toBe(50);
    expect(runtime.diag().g[3]).toBe(expectedBatteryPct);
  });

  it('accepts the captured seven-byte TP357S packet and ignores battery flag bits', () => {
    const { address, runtime, scan } = createExecutableTp357Runtime();

    scan('scan-result', {
      addr: address,
      advData: manufacturerAdvertisement([0xc2, 0xdf, 0x00, 0x4a, 0x22, 0x0b, 0x01]),
      rssi: -60
    });

    expect(runtime.diag().g[1]).toBe(22.3);
    expect(runtime.diag().g[2]).toBe(74);
    expect(runtime.diag().g[3]).toBe(100);
  });

  it('keeps climate readings usable when battery state is unknown', () => {
    const { address, runtime, scan } = createExecutableTp357Runtime();

    scan('scan-result', {
      addr: address,
      advData: manufacturerAdvertisement([0xc2, 0xdc, 0x00, 0x32, 0x03, 0x2c]),
      rssi: -55
    });

    expect(runtime.diag().g[1]).toBe(22);
    expect(runtime.diag().g[2]).toBe(50);
    expect(runtime.diag().g[3]).toBeNull();
  });
});

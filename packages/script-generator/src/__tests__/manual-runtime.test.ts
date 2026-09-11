import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript
} from '../index.js';
import { describe, expect, it, vi } from 'vitest';

const advertisement = (temperatureC: number, humidityPct: number): number[] => {
  const temp = Math.round(temperatureC * 100);
  const humidity = Math.round(humidityPct * 100);
  return [
    10,
    0x16,
    0xd2,
    0xfc,
    0x40,
    0x02,
    temp & 255,
    (temp >> 8) & 255,
    0x03,
    humidity & 255,
    (humidity >> 8) & 255
  ];
};

const createRuntime = (script: string) => {
  let physicalRelayOn = false;
  let scanner:
    | ((event: string, packet: { addr: string; advData: number[]; rssi: number }) => void)
    | undefined;
  const switchCalls: boolean[] = [];
  const shelly = {
    call: (
      method: string,
      params: { on: boolean },
      callback?: (_r: unknown, e: number) => void
    ) => {
      if (method === 'Switch.Set') {
        physicalRelayOn = params.on;
        switchCalls.push(params.on);
      }
      callback?.({}, 0);
    },
    getComponentStatus: (component: string) =>
      component === 'switch:0'
        ? { output: physicalRelayOn }
        : component === 'sys'
          ? { uptime: 1 }
          : null,
    getUptimeMs: () => Date.now()
  };
  const ble = {
    Scanner: {
      SCAN_RESULT: 'scan-result',
      INFINITE_SCAN: -1,
      stop: () => undefined,
      subscribe: (callback: typeof scanner) => {
        scanner = callback;
      },
      start: () => true
    }
  };
  const timer = { set: () => undefined };
  const runtime = new Function(
    'Shelly',
    'BLE',
    'Timer',
    `${script}
return {diag:function(){return JSON.parse(diag());},setMode:function(m){R.nh=0;R.fh=0;if(m){R.m=1;R.rs="mn";}else{R.on=false;R.os=null;R.rs="ar";R.m=0;}}};`
  )(shelly, ble, timer) as {
    diag: () => { md: number; g: unknown[] };
    setMode: (mode: number) => void;
  };

  if (!scanner) throw new Error('Generated runtime did not subscribe to BLE.');

  return {
    runtime,
    switchCalls,
    scan: (temperatureC: number, humidityPct: number) =>
      scanner?.('scan-result', {
        addr: 'AA:BB:CC:DD:EE:FF',
        advData: advertisement(temperatureC, humidityPct),
        rssi: -35
      }),
    setPhysicalRelayOn: (on: boolean) => {
      physicalRelayOn = on;
    },
    physicalRelayOn: () => physicalRelayOn
  };
};

describe('generated MANUAL runtime mode', () => {
  it('keeps BLE telemetry alive without automatic relay decisions', () => {
    let nowMs = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    try {
      const base = createDefaultShellyThermostatConfig(
        'xiaomi_lywsd03mmc_bthome_v2',
        'heating'
      );
      const script = generateShellyThermostatScript({
        ...base,
        sensor: { ...base.sensor, runtimeAddress: 'AA:BB:CC:DD:EE:FF' },
        rule: { ...base.rule, consecutiveHits: 1, minChangeMs: 1 }
      });
      const runtime = createRuntime(script);

      runtime.scan(18, 50);
      expect(runtime.physicalRelayOn()).toBe(true);
      expect(runtime.runtime.diag().g[1]).toBe(18);

      runtime.runtime.setMode(1);
      runtime.setPhysicalRelayOn(false);

      const callsAfterManual = runtime.switchCalls.length;
      runtime.setPhysicalRelayOn(true);
      nowMs += 1_000;
      runtime.scan(23.5, 61);
      expect(runtime.runtime.diag().g[1]).toBe(23.5);
      expect(runtime.runtime.diag().g[2]).toBe(61);
      expect(runtime.physicalRelayOn()).toBe(true);
      expect(runtime.switchCalls).toHaveLength(callsAfterManual);

      runtime.runtime.setMode(0);
      runtime.setPhysicalRelayOn(false);
      nowMs += 1_000;
      runtime.scan(18, 50);
      expect(runtime.physicalRelayOn()).toBe(true);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('keeps runtime control compact and exposes mode through runtime state', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());
    expect(script).toContain('m:0');
    expect(script).not.toContain('md:');
    expect(script).not.toContain('registerEndpoint("manual"');
    expect(script).not.toContain('registerEndpoint("auto"');
  });
});

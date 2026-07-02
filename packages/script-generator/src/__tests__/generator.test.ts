import {
  configHash,
  createDefaultShellyThermostatConfig,
  decodeShellyThermostatScript,
  generateShellyBleDiscoveryScript,
  generateShellyThermostatScript
} from '../index.js';

const byteLength = (value: string): number => new TextEncoder().encode(value).length;

const readGeneratedDiagnostics = (script: string): unknown => {
  const shelly = {
    call: (
      _method: string,
      _params: unknown,
      callback?: (_result: unknown, code: number) => void
    ) => callback?.({}, 0),
    getComponentStatus: (component: string) =>
      component === 'sys'
        ? { time: '09:31', unixtime: 1782667904, uptime: 12345 }
        : component === 'switch:0'
          ? {
              output: false,
              apower: 0,
              voltage: 230.1,
              current: 0,
              aenergy: { total: 1234 },
              temperature: { tC: 31.2 }
            }
          : null,
    getUptimeMs: () => Date.now()
  };
  const ble = {
    Scanner: {
      SCAN_RESULT: 'scan-result',
      INFINITE_SCAN: -1,
      subscribe: () => undefined,
      start: () => true
    }
  };
  const timer = { set: () => undefined };

  return new Function('Shelly', 'BLE', 'Timer', `${script}\nreturn JSON.parse(diag());`)(
    shelly,
    ble,
    timer
  ) as unknown;
};

const createBthomeAdvertisement = (payload: number[]): number[] => [
  payload.length + 3,
  0x16,
  0xd2,
  0xfc,
  ...payload
];

const createExecutableRuntime = (script: string) => {
  let scanCallback:
    | ((event: string, result: { addr: string; advData: number[]; rssi: number }) => void)
    | undefined;
  const switchCalls: Array<{ id: number; on: boolean }> = [];
  const timers: Array<{ durationMs: number; repeat: boolean; callback: () => void }> = [];
  const startCalls: unknown[] = [];
  const shelly = {
    call: (
      method: string,
      params: { id: number; on: boolean },
      callback?: (_result: unknown, code: number) => void
    ) => {
      if (method === 'Switch.Set') {
        switchCalls.push(params);
      }
      callback?.({}, 0);
    },
    getComponentStatus: () => null,
    getUptimeMs: () => Date.now()
  };
  const ble = {
    Scanner: {
      SCAN_RESULT: 'scan-result',
      INFINITE_SCAN: -1,
      stop: () => undefined,
      subscribe: (
        callback: (
          event: string,
          result: { addr: string; advData: number[]; rssi: number }
        ) => void
      ) => {
        scanCallback = callback;
      },
      start: (options: unknown) => {
        startCalls.push(options);
        return true;
      }
    }
  };
  const timer = {
    set: (durationMs: number, repeat: boolean, callback: () => void) => {
      timers.push({ durationMs, repeat, callback });
    }
  };
  const runtime = new Function(
    'Shelly',
    'BLE',
    'Timer',
    `${script}\nreturn {diag:function(){return JSON.parse(diag());}};`
  )(shelly, ble, timer) as { diag: () => { g: unknown[] } };

  if (!scanCallback) {
    throw new Error('Generated runtime did not subscribe to BLE scanner.');
  }

  return {
    runtime,
    scan: scanCallback,
    switchCalls,
    timers,
    startCalls
  };
};

describe('generateShellyThermostatScript', () => {
  it('generates deterministic script text for the same config', () => {
    const config = createDefaultShellyThermostatConfig();

    expect(generateShellyThermostatScript(config)).toBe(
      generateShellyThermostatScript(config)
    );
  });

  it('decodes generated thermostat runtime settings', () => {
    const baseConfig = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    const config = {
      ...baseConfig,
      sensor: {
        ...baseConfig.sensor,
        runtimeAddress: 'A4:C1:38:4F:24:CD'
      },
      rule: {
        ...baseConfig.rule,
        rssiMin: -80,
        staleTimeoutSec: 600,
        maxOnMs: 10_800_000,
        vpdAssist: {
          enabled: true,
          targetKpa: 1.25
        }
      }
    };

    const decoded = decodeShellyThermostatScript(generateShellyThermostatScript(config));

    expect(decoded?.runtimeMode).toBe('xiaomi-bthome-minimal');
    expect(decoded?.settings).toMatchObject({
      sensorProfileId: 'xiaomi_lywsd03mmc_bthome_v2',
      runtimeAddress: 'A4:C1:38:4F:24:CD',
      compactAddress: 'A4C1384F24CD',
      mode: 'heating',
      control: {
        metric: 'temperature',
        direction: 'below',
        onThreshold: 19,
        offThreshold: 20
      },
      vpdAssist: {
        enabled: true,
        targetKpa: 1.25
      },
      staleTimeoutSec: 600,
      maxOnMs: 10_800_000,
      rssiMin: -80
    });
  });

  it('does not decode temporary BLE discovery scripts as thermostat settings', () => {
    expect(decodeShellyThermostatScript(generateShellyBleDiscoveryScript())).toBeNull();
  });

  it('includes sensor and rule metadata in the diagnostics endpoint', () => {
    const baseConfig = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    const config = {
      ...baseConfig,
      sensor: {
        ...baseConfig.sensor,
        runtimeAddress: 'A4:C1:38:4F:24:CD',
        displayName: 'Pokoj'
      },
      rule: {
        ...baseConfig.rule,
        control: {
          ...baseConfig.rule.control,
          onThreshold: 19,
          offThreshold: 21.2
        },
        rssiMin: -80
      }
    };

    const diagnostics = readGeneratedDiagnostics(generateShellyThermostatScript(config));

    expect(diagnostics).toMatchObject({
      v: 1,
      z: configHash(config),
      s: ['A4:C1:38:4F:24:CD', 'Pokoj'],
      q: [0, 0, 19, 21.2, 120, -80],
      y: ['09:31', 1782667904, 12345],
      p: [false, 0, 230.1, 0, 1234, 31.2],
      g: [
        null,
        null,
        null,
        null,
        null,
        false,
        'b',
        expect.anything(),
        null,
        0,
        0,
        null,
        null,
        null,
        null,
        0,
        'boot'
      ]
    });
  });

  it('returns null for unsupported or malformed thermostat scripts', () => {
    expect(decodeShellyThermostatScript('var C={};var R={};')).toBeNull();
    expect(
      decodeShellyThermostatScript('// m: xiaomi-bthome-minimal\nvar X={};var R={};')
    ).toBeNull();
    expect(
      decodeShellyThermostatScript('// m: xiaomi-bthome-minimal\nvar C={};')
    ).toBeNull();
    expect(
      decodeShellyThermostatScript('// m: xiaomi-bthome-minimal\nvar C={bad};var R={};')
    ).toBeNull();
    expect(
      decodeShellyThermostatScript(
        '// m: xiaomi-bthome-minimal\nvar C={"a":"A"};var R={};'
      )
    ).toBeNull();
  });

  it('generates an ultra-minimal Xiaomi BTHome runtime', () => {
    const script = generateShellyThermostatScript(
      createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2')
    );

    expect(script).toContain('m: xiaomi-bthome-minimal');
    expect(script).toContain('function ad(d)');
    expect(script).toContain('function r2(d,o,s)');
    expect(script).toContain('Shelly.call("Switch.Set"');
    expect(script).toContain('function nw(){return Shelly.getUptimeMs();}');
    expect(script).toContain('BLE.Scanner.start||BLE.Scanner.Start');
    expect(script).toContain('interval_ms:241,window_ms:61,rssi_thr:0');
    expect(script).toContain('nw()-(R.l||R.sa)>9e4');
    expect(script).not.toContain('Date.now()');
    expect(script).toContain('"st"');
    expect(script).toContain('"mx"');
    expect(script).toContain('sw(false,"b",true)');
    expect(script).toContain('R.vp');
    expect(script).toContain('R.eo');
    expect(script).toContain('R.ef');
    expect(script).not.toContain('BTHome.parseData');
    expect(script).not.toContain('tp357');
    expect(script).not.toContain('TP357');
    expect(script).not.toContain('parseBthomeV2Payload');
    expect(script).not.toContain('readUint16LE');
    expect(script).not.toContain('function dataLength');
    expect(byteLength(script)).toBeLessThanOrEqual(4500);
    expect(() => new Function(script)).not.toThrow();
  });

  it('tracks incomplete Xiaomi BTHome packets without forcing relay OFF', () => {
    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'humidifying'
    );
    const script = generateShellyThermostatScript({
      ...config,
      sensor: {
        ...config.sensor,
        runtimeAddress: 'A4:C1:38:4F:24:CD'
      }
    });
    const { runtime, scan, switchCalls } = createExecutableRuntime(script);

    expect(switchCalls).toEqual([{ id: 0, on: false }]);

    const packetSeenBefore = Date.now();
    scan('scan-result', {
      addr: 'A4:C1:38:4F:24:CD',
      advData: createBthomeAdvertisement([0x40, 0x01, 100]),
      rssi: -35
    });

    expect(switchCalls).toEqual([{ id: 0, on: false }]);
    expect(runtime.diag().g[0]).toBeNull();
    expect(runtime.diag().g[3]).toBe(100);
    expect(runtime.diag().g[6]).toBe('b');
    expect(runtime.diag().g[16]).toBe('cv');
    expect(runtime.diag().g[15]).toBeGreaterThanOrEqual(packetSeenBefore);
  });

  it('keeps consecutive hits when an incomplete BTHome packet arrives', () => {
    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'humidifying'
    );
    const script = generateShellyThermostatScript({
      ...config,
      sensor: {
        ...config.sensor,
        runtimeAddress: 'A4:C1:38:4F:24:CD'
      }
    });
    const { runtime, scan } = createExecutableRuntime(script);

    scan('scan-result', {
      addr: 'A4:C1:38:4F:24:CD',
      advData: createBthomeAdvertisement([0x40, 0x02, 0x2c, 0x0c, 0x03, 0xa0, 0x0f]),
      rssi: -35
    });
    expect(runtime.diag().g[9]).toBe(1);
    expect(runtime.diag().g[6]).toBe('blh');
    expect(runtime.diag().g[16]).toBe('ok');

    scan('scan-result', {
      addr: 'A4:C1:38:4F:24:CD',
      advData: createBthomeAdvertisement([0x40, 0x01, 99]),
      rssi: -35
    });

    expect(runtime.diag().g[9]).toBe(1);
    expect(runtime.diag().g[10]).toBe(0);
    expect(runtime.diag().g[3]).toBe(99);
    expect(runtime.diag().g[6]).toBe('blh');
    expect(runtime.diag().g[16]).toBe('cv');
  });

  it('allows OFF during min-change cooldown while blocking immediate ON restart', () => {
    let nowMs = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    try {
      const config = createDefaultShellyThermostatConfig(
        'xiaomi_lywsd03mmc_bthome_v2',
        'humidifying'
      );
      const script = generateShellyThermostatScript({
        ...config,
        sensor: {
          ...config.sensor,
          runtimeAddress: 'A4:C1:38:4F:24:CD'
        },
        rule: {
          ...config.rule,
          minChangeMs: 120_000
        }
      });
      const { scan, switchCalls, runtime } = createExecutableRuntime(script);
      const lowHumidity = createBthomeAdvertisement([
        0x40, 0x02, 0x2c, 0x0c, 0x03, 0xa0, 0x0f
      ]);
      const highHumidity = createBthomeAdvertisement([
        0x40, 0x02, 0x2c, 0x0c, 0x03, 0x70, 0x17
      ]);

      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: lowHumidity,
        rssi: -35
      });
      nowMs += 1000;
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: lowHumidity,
        rssi: -35
      });
      expect(switchCalls.at(-1)).toEqual({ id: 0, on: true });

      nowMs += 1000;
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: highHumidity,
        rssi: -35
      });
      nowMs += 1000;
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: highHumidity,
        rssi: -35
      });
      expect(switchCalls.at(-1)).toEqual({ id: 0, on: false });

      nowMs += 1000;
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: lowHumidity,
        rssi: -35
      });
      nowMs += 1000;
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: lowHumidity,
        rssi: -35
      });

      expect(switchCalls.at(-1)).toEqual({ id: 0, on: false });
      expect(runtime.diag().g[6]).toBe('mc');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('composes alternating Xiaomi temperature and humidity packets for VPD assist', () => {
    let nowMs = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    try {
      const config = createDefaultShellyThermostatConfig(
        'xiaomi_lywsd03mmc_bthome_v2',
        'heating'
      );
      const script = generateShellyThermostatScript({
        ...config,
        sensor: {
          ...config.sensor,
          runtimeAddress: 'A4:C1:38:4F:24:CD'
        },
        rule: {
          ...config.rule,
          vpdAssist: {
            enabled: true,
            targetKpa: 1.2
          }
        }
      });
      const { runtime, scan, switchCalls } = createExecutableRuntime(script);
      const tempOnly = createBthomeAdvertisement([0x40, 0x02, 0x08, 0x07]);
      const humidityOnly = createBthomeAdvertisement([0x40, 0x03, 0x4c, 0x1d]);

      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: tempOnly,
        rssi: -35
      });
      expect(runtime.diag().g[6]).toBe('b');
      expect(runtime.diag().g[16]).toBe('cv');
      expect(runtime.diag().g[0]).toBeNull();

      nowMs += 10_000;
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: humidityOnly,
        rssi: -35
      });
      expect(runtime.diag().g[9]).toBe(1);

      nowMs += 10_000;
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: tempOnly,
        rssi: -35
      });

      expect(runtime.diag().g[6]).toBe('bl');
      expect(runtime.diag().g[1]).toBe(18);
      expect(runtime.diag().g[2]).toBe(75);
      expect(runtime.diag().g[12]).toBeGreaterThan(0);
      expect(switchCalls.at(-1)).toEqual({ id: 0, on: true });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('does not compose stale Xiaomi humidity into a VPD decision', () => {
    let nowMs = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    try {
      const config = createDefaultShellyThermostatConfig(
        'xiaomi_lywsd03mmc_bthome_v2',
        'heating'
      );
      const script = generateShellyThermostatScript({
        ...config,
        sensor: {
          ...config.sensor,
          runtimeAddress: 'A4:C1:38:4F:24:CD'
        },
        rule: {
          ...config.rule,
          vpdAssist: {
            enabled: true,
            targetKpa: 1.2
          }
        }
      });
      const { runtime, scan, switchCalls } = createExecutableRuntime(script);

      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: createBthomeAdvertisement([0x40, 0x03, 0x4c, 0x1d]),
        rssi: -35
      });
      nowMs += 91_000;
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: createBthomeAdvertisement([0x40, 0x02, 0x34, 0x08]),
        rssi: -35
      });

      expect(runtime.diag().g[6]).toBe('b');
      expect(runtime.diag().g[16]).toBe('cv');
      expect(runtime.diag().g[0]).toBeNull();
      expect(switchCalls).toEqual([{ id: 0, on: false }]);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('keeps ON confirmed across sparse but useful target advertisements', () => {
    let nowMs = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    try {
      const config = createDefaultShellyThermostatConfig(
        'xiaomi_lywsd03mmc_bthome_v2',
        'heating'
      );
      const script = generateShellyThermostatScript({
        ...config,
        sensor: {
          ...config.sensor,
          runtimeAddress: 'A4:C1:38:4F:24:CD'
        }
      });
      const { runtime, scan, switchCalls } = createExecutableRuntime(script);
      const coldPacket = createBthomeAdvertisement([
        0x40, 0x02, 0x08, 0x07, 0x03, 0x94, 0x11
      ]);
      const unrelatedPacket = {
        addr: '11:22:33:44:55:66',
        advData: createBthomeAdvertisement([0x40, 0x01, 99]),
        rssi: -35
      };

      for (let index = 0; index < 9; index += 1) {
        nowMs += 3_000;
        scan('scan-result', unrelatedPacket);
      }
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: coldPacket,
        rssi: -35
      });
      expect(runtime.diag().g[9]).toBe(1);
      expect(switchCalls).toEqual([{ id: 0, on: false }]);

      for (let index = 0; index < 9; index += 1) {
        nowMs += 3_000;
        scan('scan-result', unrelatedPacket);
      }
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: coldPacket,
        rssi: -35
      });

      expect(runtime.diag().g[6]).toBe('bl');
      expect(switchCalls.at(-1)).toEqual({ id: 0, on: true });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('uses target packet freshness for the BLE scanner watchdog', () => {
    let nowMs = 100_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    try {
      const config = createDefaultShellyThermostatConfig(
        'xiaomi_lywsd03mmc_bthome_v2',
        'humidifying'
      );
      const script = generateShellyThermostatScript({
        ...config,
        sensor: {
          ...config.sensor,
          runtimeAddress: 'A4:C1:38:4F:24:CD'
        }
      });
      const { scan, timers, startCalls } = createExecutableRuntime(script);
      const startTimer = timers.find((timer) => timer.durationMs === 1000);
      const watchdog = timers.find((timer) => timer.durationMs === 30000);
      expect(startTimer).toBeDefined();
      expect(watchdog).toBeDefined();
      startTimer?.callback();
      expect(startCalls).toHaveLength(1);

      nowMs += 80_000;
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: createBthomeAdvertisement([0x40, 0x01, 99]),
        rssi: -35
      });
      nowMs += 80_000;
      watchdog?.callback();
      expect(startCalls).toHaveLength(1);

      nowMs += 91_000;
      watchdog?.callback();
      expect(startCalls).toHaveLength(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('keeps stale safety tied to full control measurements', () => {
    let nowMs = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    try {
      const config = createDefaultShellyThermostatConfig(
        'xiaomi_lywsd03mmc_bthome_v2',
        'humidifying'
      );
      const script = generateShellyThermostatScript({
        ...config,
        sensor: {
          ...config.sensor,
          runtimeAddress: 'A4:C1:38:4F:24:CD'
        },
        rule: {
          ...config.rule,
          staleTimeoutSec: 10
        }
      });
      const { scan, switchCalls, runtime, timers } = createExecutableRuntime(script);
      const maintenanceTimer = timers.find((timer) => timer.durationMs === 30000);
      const lowHumidity = createBthomeAdvertisement([
        0x40, 0x02, 0x2c, 0x0c, 0x03, 0xa0, 0x0f
      ]);
      const batteryOnly = createBthomeAdvertisement([0x40, 0x01, 98]);

      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: lowHumidity,
        rssi: -35
      });
      nowMs += 1000;
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: lowHumidity,
        rssi: -35
      });
      expect(switchCalls.at(-1)).toEqual({ id: 0, on: true });
      const validSeenAt = runtime.diag().g[0];

      nowMs += 11_000;
      scan('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: batteryOnly,
        rssi: -35
      });
      maintenanceTimer?.callback();

      expect(switchCalls.at(-1)).toEqual({ id: 0, on: false });
      expect(runtime.diag().g[0]).toBe(validSeenAt);
      expect(runtime.diag().g[3]).toBe(98);
      expect(runtime.diag().g[6]).toBe('st');
      expect(runtime.diag().g[15]).toBeGreaterThan(Number(validSeenAt));
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('generates an ultra-minimal TP357 runtime without BTHome code', () => {
    const script = generateShellyThermostatScript(
      createDefaultShellyThermostatConfig('tp357_custom_v1')
    );

    expect(script).toContain('m: tp357-minimal');
    expect(script).toContain('function mf(d)');
    expect(script).toContain('"tm"');
    expect(script).toContain('Shelly.call("Switch.Set"');
    expect(script).toContain('function nw(){return Shelly.getUptimeMs();}');
    expect(script).toContain('BLE.Scanner.start||BLE.Scanner.Start');
    expect(script).not.toContain('Date.now()');
    expect(script).toContain('R.vp');
    expect(script).toContain('R.eo');
    expect(script).toContain('R.ef');
    expect(script).not.toContain('BTHome.parseData');
    expect(script).not.toContain('parseBthomeV2Payload');
    expect(script).not.toContain('xiaomi_lywsd03mmc_bthome_v2');
    expect(byteLength(script)).toBeLessThanOrEqual(4000);
    expect(() => new Function(script)).not.toThrow();
  });

  it('keeps the runtime config compact and validates threshold directions', () => {
    const coolingConfig = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'cooling'
    );
    const humidifyingConfig = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'humidifying'
    );

    expect(generateShellyThermostatScript(coolingConfig)).toContain('"d":1');
    expect(generateShellyThermostatScript(humidifyingConfig)).toContain('"m":1');
    expect(() =>
      generateShellyThermostatScript({
        ...createDefaultShellyThermostatConfig(),
        rule: {
          ...createDefaultShellyThermostatConfig().rule,
          control: {
            ...createDefaultShellyThermostatConfig().rule.control,
            onThreshold: 20,
            offThreshold: 20
          }
        }
      })
    ).toThrow(/onThreshold must be lower than offThreshold/);
  });

  it('adds VPD assist code only when enabled', () => {
    const disabled = generateShellyThermostatScript(
      createDefaultShellyThermostatConfig()
    );
    const baseConfig = createDefaultShellyThermostatConfig();
    const enabled = generateShellyThermostatScript({
      ...baseConfig,
      rule: {
        ...baseConfig.rule,
        vpdAssist: {
          enabled: true,
          targetKpa: 1.25
        }
      }
    });

    expect(disabled).toContain('"vp":0');
    expect(disabled).not.toContain('function sv(t)');
    expect(enabled).toContain('"vp":1.25');
    expect(enabled).toContain('function sv(t)');
    expect(enabled).toContain('Math.exp');
  });

  it('rejects unreasonable RSSI thresholds and leaves no placeholders', () => {
    expect(() =>
      generateShellyThermostatScript({
        ...createDefaultShellyThermostatConfig(),
        rule: {
          ...createDefaultShellyThermostatConfig().rule,
          rssiMin: -120
        }
      })
    ).toThrow();

    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());
    expect(script).not.toContain('{{');
    expect(script).not.toContain('__PLACEHOLDER__');
  });

  it('matches minimal runtime snapshots', () => {
    expect(
      generateShellyThermostatScript(
        createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2')
      )
    ).toMatchSnapshot('minimal Xiaomi BTHome runtime');
    expect(
      generateShellyThermostatScript(
        createDefaultShellyThermostatConfig('tp357_custom_v1')
      )
    ).toMatchSnapshot('minimal TP357 runtime');
  });
});

describe('generateShellyBleDiscoveryScript', () => {
  it('generates a deterministic temporary Shelly-side BLE discovery script', () => {
    expect(generateShellyBleDiscoveryScript()).toBe(generateShellyBleDiscoveryScript());
  });

  it('scans compatible sensors without controlling the relay', () => {
    const script = generateShellyBleDiscoveryScript();

    expect(script).toContain('m: discovery-debug');
    expect(script).toContain('HTTPServer.registerEndpoint("ble-scan"');
    expect(script).toContain('BLE.Scanner.subscribe(function(event, result)');
    expect(script).toContain('BLE.Scanner.start || BLE.Scanner.Start');
    expect(script).toContain('p: "x"');
    expect(script).toContain('p: "t"');
    expect(script).toContain('function btd(result)');
    expect(script).toContain('function pbt(data)');
    expect(script).toContain('function handleTp357Discovery(result)');
    expect(script).toContain('D.n >= 4');
    expect(script).toContain('c: candidateList()');
    expect(script).toContain('function keepDiscoveryEndpointAlive()');
    expect(script).toContain('duration_ms: BLE.Scanner.INFINITE_SCAN');
    expect(script).toContain('interval_ms: 241');
    expect(script).toContain('window_ms: 61');
    expect(script).toContain('rssi_thr: 0');
    expect(script).not.toContain('Shelly.call("Switch.Set"');
    expect(script).not.toContain('CFG.rule');
  });

  it('keeps the discovery script compact enough for Shelly Plug S Gen3 memory', () => {
    const script = generateShellyBleDiscoveryScript();

    expect(byteLength(script)).toBeLessThanOrEqual(9600);
    expect(() => new Function(script)).not.toThrow();
  });

  it('does not leave unreplaced placeholders in the discovery script', () => {
    const script = generateShellyBleDiscoveryScript();

    expect(script).not.toContain('{{');
    expect(script).not.toContain('__PLACEHOLDER__');
  });
});

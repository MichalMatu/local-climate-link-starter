import { describe, expect, it } from 'vitest';
import {
  SHELLY_DATALOGGER_SCRIPT_MAX_BYTES,
  generateShellyDataloggerScript
} from '../shelly/datalogger.js';

describe('Shelly rolling history tail generator', () => {
  it('generates a tiny passive runtime that only reads existing diagnostics', () => {
    const script = generateShellyDataloggerScript({ sourceScriptId: 3 });
    expect(script).toContain('// m: tail-v1');
    expect(script).toContain('Script.Eval');
    expect(script).toContain('diag()');
    expect(script).toContain('KVS.Set');
    expect(script).toContain('lcl.tail.m');
    expect(script).toContain('historyStatus');
    expect(script).not.toContain('Switch.Set');
    expect(script).not.toContain('BLE.Scanner');
    expect(script).not.toContain('unixtime');
    expect(script).not.toContain('Date.now');
    expect(new TextEncoder().encode(script).length).toBeLessThanOrEqual(
      SHELLY_DATALOGGER_SCRIPT_MAX_BYTES
    );
  });

  it('defaults to 5-minute polling, two-hour flushes and 16 ring slots', () => {
    const script = generateShellyDataloggerScript({ sourceScriptId: 1 });
    expect(script).toContain('"p":300');
    expect(script).toContain('"f":7200');
    expect(script).toContain('"n":16');
    expect(script).toContain('"t":3');
    expect(script).toContain('"h":10');
  });

  it('accepts bounded noise thresholds and retention parameters', () => {
    const script = generateShellyDataloggerScript({
      sourceScriptId: 2,
      pollIntervalSec: 600,
      flushIntervalSec: 10800,
      slotCount: 32,
      temperatureDeltaC: 0.5,
      humidityDeltaPct: 2
    });
    expect(script).toContain('"s":2');
    expect(script).toContain('"p":600');
    expect(script).toContain('"f":10800');
    expect(script).toContain('"n":32');
    expect(script).toContain('"t":5');
    expect(script).toContain('"h":20');
  });

  it('rejects invalid cadence, script ids and slot counts', () => {
    expect(() => generateShellyDataloggerScript({ sourceScriptId: -1 })).toThrow(
      /sourceScriptId/
    );
    expect(() =>
      generateShellyDataloggerScript({ sourceScriptId: 1, flushIntervalSec: 3599 })
    ).toThrow(/flush interval/);
    expect(() => generateShellyDataloggerScript({ sourceScriptId: 1, slotCount: 33 })).toThrow(
      /slot count/
    );
  });
});

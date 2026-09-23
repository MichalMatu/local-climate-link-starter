import { describe, expect, it } from 'vitest';
import {
  SHELLY_DATALOGGER_SCRIPT_MAX_BYTES,
  generateShellyDataloggerScript
} from '../shelly/datalogger.js';

describe('Shelly KVS datalogger generator', () => {
  it('generates a deterministic isolated history runtime', () => {
    const first = generateShellyDataloggerScript({ sourceScriptId: 3 });
    const second = generateShellyDataloggerScript({ sourceScriptId: 3 });
    expect(first).toBe(second);
    expect(first).toContain('// m: datalogger-v1');
    expect(first).toContain('Script.Eval');
    expect(first).toContain('diag()');
    expect(first).toContain('KVS.Set');
    expect(first).toContain('lcl.dl1.m');
    expect(first).toContain('historyStatus');
    expect(first).not.toContain('Switch.Set');
    expect(first).not.toContain('BLE.Scanner');
    expect(new TextEncoder().encode(first).length).toBeLessThanOrEqual(
      SHELLY_DATALOGGER_SCRIPT_MAX_BYTES
    );
  });

  it('defaults to 15-minute samples, 2-hour flushes and 32 ring slots', () => {
    const script = generateShellyDataloggerScript({ sourceScriptId: 1 });
    expect(script).toContain('"i":900');
    expect(script).toContain('"f":7200');
    expect(script).toContain('"n":32');
  });

  it('accepts bounded custom retention parameters', () => {
    const script = generateShellyDataloggerScript({
      sourceScriptId: 2,
      sampleIntervalSec: 1800,
      flushIntervalSec: 7200,
      slotCount: 40
    });
    expect(script).toContain('"s":2');
    expect(script).toContain('"i":1800');
    expect(script).toContain('"n":40');
  });

  it('rejects unsafe write cadence or invalid script/slot ids', () => {
    expect(() => generateShellyDataloggerScript({ sourceScriptId: -1 })).toThrow(
      /sourceScriptId/
    );
    expect(() =>
      generateShellyDataloggerScript({ sourceScriptId: 1, flushIntervalSec: 3599 })
    ).toThrow(/flush interval/);
    expect(() => generateShellyDataloggerScript({ sourceScriptId: 1, slotCount: 41 })).toThrow(
      /slot count/
    );
  });
});

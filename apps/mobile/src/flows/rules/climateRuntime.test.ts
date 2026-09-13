import { describe, expect, it, vi } from 'vitest';
import { climate, plug, sensor } from '../registry/fixtures.test-support.js';
import type { ClimateRuntimeDependencies } from './climateRuntime.js';
import { readClimateRuleRuntime } from './climateRuntime.js';

const deps = (mode: 'auto' | 'manual' | 'unknown'): ClimateRuntimeDependencies => ({
  requireOwnership: vi.fn(async () => ({}) as never),
  cleanupBle: vi.fn(async () => 0),
  createTransport: vi.fn(() => ({ call: vi.fn() })),
  createClient: vi.fn(() => ({}) as never),
  readControlStatus: vi.fn(async () => ({
    relayOn: false,
    automationMode: mode,
    automationScriptId: 7,
    firmwareId: '1.0.0',
    telemetry: {},
    clock: { timeSynced: true }
  })),
  readSetupStatus: vi.fn(async () => ({}) as never)
});

describe('climate rule runtime', () => {
  it('keeps an unknown in-process mode explicitly unsupported', async () => {
    const deployed = {
      ...climate,
      deployment: {
        scriptId: 7,
        scriptHash: 'hash',
        safetyTest: { status: 'verified' as const, verifiedAtMs: 10 }
      }
    };
    const runtime = await readClimateRuleRuntime(deployed, plug, deps('unknown'));
    expect(runtime.mode).toBe('unknown');
    expect(runtime.modeSupported).toBe(false);
    expect(runtime.scriptMatch).toBe('matched');
  });

  it('does not infer deployment ownership from device or sensor names', async () => {
    const renamedPlug = { ...plug, name: 'Renamed plug' };
    const renamedSensor = { ...sensor, name: 'Renamed sensor' };
    expect(renamedPlug.id).toBe(climate.plugId);
    expect(renamedSensor.id).toBe(climate.sensorId);
    const runtime = await readClimateRuleRuntime(climate, renamedPlug, deps('auto'));
    expect(runtime.scriptMatch).toBe('undeployed');
  });
});

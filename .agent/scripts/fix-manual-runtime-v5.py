from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    text = read(path)
    actual = text.count(old)
    if actual < count:
        raise SystemExit(f"{path}: expected >= {count} matches, found {actual}: {old[:160]!r}")
    write(path, text.replace(old, new, count))


generate = "packages/script-generator/src/shelly/generate.ts"

# Keep only the minimal runtime state required to distinguish a live MANUAL
# controller from AUTO. Mode is intentionally not duplicated in /diag; control
# status reads it through Script.Eval, while /diag remains telemetry-only.
replace(generate, "md:0,sa:0", "m:0,sa:0", count=2)
replace(generate, "R.md", "R.m")

# Automatic decision code may continue calculating thresholds/hit counters in
# MANUAL; the single output boundary sw() is authoritative and becomes a no-op.
# AUTO re-entry resets the counters through Script.Eval, so no MANUAL hits leak.
replace(
    generate,
    'R.vp=C.vp?vd(t,h):null;if(R.m){R.nh=0;R.fh=0;R.rs="mn";return;}var go=',
    'R.vp=C.vp?vd(t,h):null;var go=',
)

# sw() owns the MANUAL output guard. If an AUTO Switch.Set was already in flight
# when MANUAL was selected, its callback issues a final corrective OFF. The app
# additionally performs two confirmed OFF passes before reporting success.
replace(
    generate,
    'if(R.m){Shelly.call("Switch.Set",{id:C.i,on:false});R.on=false;R.os=null;R.rs="mn";return;}',
    'if(R.m)return Shelly.call("Switch.Set",{id:C.i,on:false});',
)

# stale()/max-on may still update diagnostic state, but their relay requests flow
# through sw(), which is already blocked in MANUAL. Avoid duplicate mode guards.
replace(
    generate,
    'function stale(){var n=nw();if(R.ls===null||n-R.ls>C.s){R.ds="st";R.nh=0;R.fh=0;if(!R.m)sw(false,"st",true);return;}if(!R.m&&R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}',
    'function stale(){var n=nw();if(R.ls===null||n-R.ls>C.s){R.ds="st";R.nh=0;R.fh=0;sw(false,"st",true);return;}if(R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}',
)

# Remove the mode copy from diagnostics. Script.Eval is the single control-state
# transport and also lets us recognise a pre-0.2 runtime (R.m is absent).
replace(generate, "{v:C.v,md:R.m,z:C.k", "{v:C.v,z:C.k")

write(
    "apps/mobile/src/flows/installations/runtimeModeTransport.ts",
    '''import { RPC_METHODS } from '@lcl/shelly-client';
import { z } from 'zod';
import {
  createShellyTransport,
  unwrapShellyResult
} from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';

export type InstalledAutomationRuntimeMode = 'auto' | 'manual';

export type InstalledAutomationRuntimeModeState = {
  mode: InstalledAutomationRuntimeMode;
  supported: boolean;
};

const scriptEvalResponseSchema = z.object({ result: z.string() });

const runtimeModeEvalCode: Record<InstalledAutomationRuntimeMode, string> = {
  manual: 'R.m=1;R.nh=R.fh=0;R.on=false;R.os=null;R.rs="mn";R.m',
  auto: 'R.nh=R.fh=0;R.on=false;R.os=null;R.rs="ar";R.m=0;R.m'
};

const readModeEvalCode =
  'typeof R==="object"&&typeof R.m==="number"?R.m:-1';

const evaluateRuntime = async (
  installation: ClimateInstalledAutomation,
  code: string
): Promise<string> => {
  const transport = createShellyTransport(installation.shelly.baseUrl);
  const payload = unwrapShellyResult(
    await transport.call<unknown>({
      method: RPC_METHODS.ScriptEval,
      params: { id: installation.script.id, code }
    })
  );
  return scriptEvalResponseSchema.parse(payload).result;
};

export const readInstalledAutomationRuntimeMode = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimeModeState> => {
  const result = await evaluateRuntime(installation, readModeEvalCode);
  if (result === '1') {
    return { mode: 'manual', supported: true };
  }
  if (result === '0') {
    return { mode: 'auto', supported: true };
  }
  return { mode: 'auto', supported: false };
};

export const setInstalledAutomationRuntimeMode = async (
  installation: ClimateInstalledAutomation,
  mode: InstalledAutomationRuntimeMode
): Promise<void> => {
  const result = await evaluateRuntime(installation, runtimeModeEvalCode[mode]);
  const expected = mode === 'manual' ? '1' : '0';
  if (result !== expected) {
    throw new Error(`Shelly did not confirm ${mode.toUpperCase()} runtime mode.`);
  }
};
'''
)

write(
    "apps/mobile/src/flows/installations/runtimeStatus.ts",
    '''import type { ShellyControlStatus } from '../hardware-setup/shellyRequests.js';
import { readShellyControlStatus } from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';
import { readInstalledAutomationRuntimeMode } from './runtimeModeTransport.js';

export type InstalledAutomationControlMode =
  | 'auto'
  | 'manual'
  | 'stopped'
  | 'missing';

export type InstalledAutomationControlStatus = Omit<
  ShellyControlStatus,
  'automationMode'
> & {
  automationMode: InstalledAutomationControlMode;
  runtimeModeSupported: boolean;
};

const nonRunningMode = (
  status: ShellyControlStatus
): InstalledAutomationControlMode =>
  status.automationMode === 'manual' ? 'stopped' : status.automationMode;

export const readInstalledAutomationControlStatus = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationControlStatus> => {
  const status = await readShellyControlStatus(installation.shelly.baseUrl);
  if (
    status.automationScriptId === null ||
    status.automationScriptId !== installation.script.id ||
    status.automationMode !== 'auto'
  ) {
    return {
      ...status,
      automationMode: nonRunningMode(status),
      runtimeModeSupported: false
    };
  }

  const runtime = await readInstalledAutomationRuntimeMode(installation);
  return {
    ...status,
    automationMode: runtime.mode,
    runtimeModeSupported: runtime.supported
  };
};
'''
)

write(
    "apps/mobile/src/flows/installations/runtimeModeTransport.test.ts",
    '''import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import type * as ShellyRequestsModule from '../hardware-setup/shellyRequests.js';
import { createInstalledAutomation } from './model.js';

const mocks = vi.hoisted(() => ({ call: vi.fn() }));

vi.mock('../hardware-setup/shellyRequests.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyRequestsModule>();
  return {
    ...actual,
    createShellyTransport: vi.fn(() => ({ call: mocks.call }))
  };
});

import {
  readInstalledAutomationRuntimeMode,
  setInstalledAutomationRuntimeMode
} from './runtimeModeTransport.js';

const installation = createInstalledAutomation({
  shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Salon',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: 'hash',
  config: createDefaultShellyThermostatConfig(),
  nowMs: 1000
});

describe('runtime mode Script.Eval transport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets MANUAL inside the running script and verifies the eval result', async () => {
    mocks.call.mockResolvedValue({ ok: true, value: { result: '1' } });

    await setInstalledAutomationRuntimeMode(installation, 'manual');

    expect(mocks.call).toHaveBeenCalledWith({
      method: 'Script.Eval',
      params: {
        id: 7,
        code: expect.stringContaining('R.m=1')
      }
    });
  });

  it('reads live MANUAL/AUTO state without using Script.Stop', async () => {
    mocks.call.mockResolvedValueOnce({ ok: true, value: { result: '1' } });
    await expect(readInstalledAutomationRuntimeMode(installation)).resolves.toEqual({
      mode: 'manual',
      supported: true
    });

    mocks.call.mockResolvedValueOnce({ ok: true, value: { result: '0' } });
    await expect(readInstalledAutomationRuntimeMode(installation)).resolves.toEqual({
      mode: 'auto',
      supported: true
    });
  });

  it('marks an older running runtime as unsupported instead of calling it MANUAL', async () => {
    mocks.call.mockResolvedValue({ ok: true, value: { result: '-1' } });

    await expect(readInstalledAutomationRuntimeMode(installation)).resolves.toEqual({
      mode: 'auto',
      supported: false
    });
  });
});
'''
)

write(
    "apps/mobile/src/flows/installations/runtimeStatus.test.ts",
    '''import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ShellyRequestsModule from '../hardware-setup/shellyRequests.js';
import type * as RuntimeModeModule from './runtimeModeTransport.js';
import { createInstalledAutomation } from './model.js';

const mocks = vi.hoisted(() => ({
  readControlStatus: vi.fn(),
  readRuntimeMode: vi.fn()
}));

vi.mock('../hardware-setup/shellyRequests.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyRequestsModule>();
  return { ...actual, readShellyControlStatus: mocks.readControlStatus };
});

vi.mock('./runtimeModeTransport.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeModeModule>();
  return { ...actual, readInstalledAutomationRuntimeMode: mocks.readRuntimeMode };
});

import { readInstalledAutomationControlStatus } from './runtimeStatus.js';

const installation = createInstalledAutomation({
  shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Salon',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: 'hash',
  config: createDefaultShellyThermostatConfig(),
  nowMs: 1000
});

const baseStatus = (automationMode: 'auto' | 'manual' | 'missing', scriptId: number | null) => ({
  relayOn: false,
  automationMode,
  automationScriptId: scriptId,
  firmwareId: '1.0.0',
  telemetry: {},
  clock: { timeSynced: false }
});

describe('installed automation runtime status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads MANUAL from the state of a still-running runtime', async () => {
    mocks.readControlStatus.mockResolvedValue(baseStatus('auto', 7));
    mocks.readRuntimeMode.mockResolvedValue({ mode: 'manual', supported: true });

    const status = await readInstalledAutomationControlStatus(installation);

    expect(status.automationMode).toBe('manual');
    expect(status.runtimeModeSupported).toBe(true);
  });

  it('recognises an old running runtime as AUTO but upgradeable', async () => {
    mocks.readControlStatus.mockResolvedValue(baseStatus('auto', 7));
    mocks.readRuntimeMode.mockResolvedValue({ mode: 'auto', supported: false });

    const status = await readInstalledAutomationControlStatus(installation);

    expect(status.automationMode).toBe('auto');
    expect(status.runtimeModeSupported).toBe(false);
  });

  it('separates an actually stopped script from intentional MANUAL', async () => {
    mocks.readControlStatus.mockResolvedValue(baseStatus('manual', 7));

    const status = await readInstalledAutomationControlStatus(installation);

    expect(status.automationMode).toBe('stopped');
    expect(status.runtimeModeSupported).toBe(false);
    expect(mocks.readRuntimeMode).not.toHaveBeenCalled();
  });
});
'''
)

manual_test = "packages/script-generator/src/__tests__/manual-runtime.test.ts"
replace(manual_test, "R.md", "R.m")
replace(manual_test, "return [13,", "return [10,")
replace(
    manual_test,
    "const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);",
    "let nowMs = 1_000_000;\n    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);",
)
replace(manual_test, "      expect(runtime.runtime.diag().md).toBe(1);\n", "")
replace(manual_test, "      expect(runtime.runtime.diag().md).toBe(0);\n", "")
replace(
    manual_test,
    "      runtime.runtime.setMode(0);\n      expect(runtime.physicalRelayOn()).toBe(false);\n\n      runtime.scan(18, 50);",
    "      runtime.runtime.setMode(0);\n      expect(runtime.physicalRelayOn()).toBe(false);\n      nowMs += 10;\n\n      runtime.scan(18, 50);",
)

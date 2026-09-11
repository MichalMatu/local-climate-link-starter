from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    text = read(path)
    actual = text.count(old)
    if actual < count:
        raise SystemExit(f"{path}: expected >= {count} matches, found {actual}: {old[:160]!r}")
    write(path, text.replace(old, new, count))


generate = "packages/script-generator/src/shelly/generate.ts"
replace(generate, "md:0,pc:0,sa:0", "md:0,sa:0", count=2)
replace(
    generate,
    'function sw(o,rs,f){if(R.md)return;var n=nw(),ch=R.on!=o;if(o&&!f&&ch&&n-R.lc<C.c){R.rs="mc";return;}R.pc++;Shelly.call("Switch.Set",{id:C.i,on:o},function(r,e){R.pc--;if(R.md){R.on=false;R.os=null;R.rs="mn";return;}if(e){R.rs="se";Shelly.call("Switch.Set",{id:C.i,on:false});R.on=false;return;}R.on=o;R.rs=rs;if(ch)R.lc=n;R.os=o?n:null;});}',
    'function sw(o,rs,f){if(R.md)return;var n=nw(),ch=R.on!=o;if(o&&!f&&ch&&n-R.lc<C.c){R.rs="mc";return;}Shelly.call("Switch.Set",{id:C.i,on:o},function(r,e){if(R.md){Shelly.call("Switch.Set",{id:C.i,on:false});R.on=false;R.os=null;R.rs="mn";return;}if(e){R.rs="se";Shelly.call("Switch.Set",{id:C.i,on:false});R.on=false;return;}R.on=o;R.rs=rs;if(ch)R.lc=n;R.os=o?n:null;});}',
)
old = '''function diag(){var y=Shelly.getComponentStatus("sys"),w=Shelly.getComponentStatus("switch:0");return JSON.stringify({v:C.v,md:R.md,z:C.k,s:[C.fa,C.n],q:[C.m,C.d,C.on,C.off,C.s/1000,C.r],y:y?[y.time||null,y.unixtime||null,y.uptime||null]:null,p:w?[!!w.output,fv(w,"apower"),fv(w,"voltage"),fv(w,"current"),w.aenergy?fv(w.aenergy,"total"):null,w.temperature?fv(w.temperature,"tC"):null]:null,g:[R.ls,R.t,R.h,R.b,R.r,R.on,R.rs,R.lc,R.os,R.nh,R.fh,R.cv,R.vp,R.eo,R.ef,R.l,R.ds]});}
function rp(p,c,b){p.code=c;p.headers=[["Content-Type","application/json"]];p.body=JSON.stringify(b);p.send();}
function cm(m,p){R.nh=0;R.fh=0;if(m)R.md=1;Shelly.call("Switch.Set",{id:C.i,on:false},function(r,e){if(e){rp(p,500,{m:R.md,e:1});return;}R.on=false;R.os=null;if(!m){R.rs="ar";R.md=0;rp(p,200,{m:0});return;}function w(){if(R.pc>0){Timer.set(10,false,w);return;}Shelly.call("Switch.Set",{id:C.i,on:false},function(r2,e2){if(e2){rp(p,500,{m:1,e:1});return;}R.on=false;R.os=null;R.rs="mn";rp(p,200,{m:1});});}w();});}
if(typeof HTTPServer!=="undefined"&&HTTPServer.registerEndpoint){HTTPServer.registerEndpoint("diag",function(q,p){p.code=200;p.headers=[["Content-Type","application/json"]];p.body=diag();p.send();});HTTPServer.registerEndpoint("manual",function(q,p){cm(1,p);});HTTPServer.registerEndpoint("auto",function(q,p){cm(0,p);});}'''
new = '''function diag(){var y=Shelly.getComponentStatus("sys"),w=Shelly.getComponentStatus("switch:0");return JSON.stringify({v:C.v,md:R.md,z:C.k,s:[C.fa,C.n],q:[C.m,C.d,C.on,C.off,C.s/1000,C.r],y:y?[y.time||null,y.unixtime||null,y.uptime||null]:null,p:w?[!!w.output,fv(w,"apower"),fv(w,"voltage"),fv(w,"current"),w.aenergy?fv(w.aenergy,"total"):null,w.temperature?fv(w.temperature,"tC"):null]:null,g:[R.ls,R.t,R.h,R.b,R.r,R.on,R.rs,R.lc,R.os,R.nh,R.fh,R.cv,R.vp,R.eo,R.ef,R.l,R.ds]});}
if(typeof HTTPServer!=="undefined"&&HTTPServer.registerEndpoint){HTTPServer.registerEndpoint("diag",function(q,p){p.code=200;p.headers=[["Content-Type","application/json"]];p.body=diag();p.send();});}'''
replace(generate, old, new)

write(
    "apps/mobile/src/flows/installations/runtimeModeTransport.ts",
    '''import { RPC_METHODS } from '@lcl/shelly-client';
import {
  createShellyTransport,
  unwrapShellyResult
} from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';

export type InstalledAutomationRuntimeMode = 'auto' | 'manual';

const runtimeModeEvalCode: Record<InstalledAutomationRuntimeMode, string> = {
  manual: 'R.md=1;R.nh=0;R.fh=0;R.rs="mn";"ok"',
  auto: 'R.nh=0;R.fh=0;R.on=false;R.os=null;R.rs="ar";R.md=0;"ok"'
};

export const setInstalledAutomationRuntimeMode = async (
  installation: ClimateInstalledAutomation,
  mode: InstalledAutomationRuntimeMode
): Promise<void> => {
  const transport = createShellyTransport(installation.shelly.baseUrl);
  unwrapShellyResult(
    await transport.call<unknown>({
      method: RPC_METHODS.ScriptEval,
      params: {
        id: installation.script.id,
        code: runtimeModeEvalCode[mode]
      }
    })
  );
};
'''
)

write(
    "apps/mobile/src/flows/installations/runtimeControl.ts",
    '''import { LOCAL_CLIMATE_LINK_SCRIPT_NAME, RpcShellyClient } from '@lcl/shelly-client';
import {
  createShellyTransport,
  readShellySetupStatus,
  unwrapShellyResult
} from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';
import { forceRelayOffAndConfirm } from './relaySafety.js';
import { setInstalledAutomationRuntimeMode } from './runtimeModeTransport.js';
import {
  readInstalledAutomationControlStatus,
  type InstalledAutomationControlStatus
} from './runtimeStatus.js';
import {
  ensureInstalledAutomationRuntimeCurrent,
  recoverInstalledAutomationRuntime
} from './runtimeUpgrade.js';

export { readInstalledAutomationControlStatus } from './runtimeStatus.js';

export type InstalledAutomationScriptMatch = 'matched' | 'missing' | 'mismatch';

export type InstalledAutomationActionResult = {
  installation: ClimateInstalledAutomation;
  status: InstalledAutomationControlStatus;
};

export const installedAutomationScriptMatch = (
  installation: ClimateInstalledAutomation,
  status: Pick<InstalledAutomationControlStatus, 'automationScriptId'>
): InstalledAutomationScriptMatch => {
  if (status.automationScriptId === null) {
    return 'missing';
  }
  return status.automationScriptId === installation.script.id ? 'matched' : 'mismatch';
};

const requireMatchedInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationControlStatus> => {
  const status = await readInstalledAutomationControlStatus(installation);
  if (installedAutomationScriptMatch(installation, status) !== 'matched') {
    throw new Error('Stored automation script does not match Shelly.');
  }
  return status;
};

const verifyModeWithRelayOff = async (
  installation: ClimateInstalledAutomation,
  expectedMode: 'auto' | 'manual'
): Promise<InstalledAutomationControlStatus> => {
  const status = await requireMatchedInstalledAutomation(installation);
  if (status.automationMode !== expectedMode || !status.runtimeModeSupported) {
    throw new Error(`Shelly did not confirm ${expectedMode.toUpperCase()} runtime mode.`);
  }
  if (status.relayOn) {
    throw new Error(`Shelly did not confirm relay OFF while entering ${expectedMode.toUpperCase()}.`);
  }
  return status;
};

export const pauseInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationActionResult> => {
  const prepared = await ensureInstalledAutomationRuntimeCurrent(installation);
  if (prepared.status.automationMode !== 'auto' && prepared.status.automationMode !== 'manual') {
    throw new Error('Automation runtime is not available for MANUAL mode.');
  }

  const nextInstallation = prepared.installation;
  await setInstalledAutomationRuntimeMode(nextInstallation, 'manual');
  const client = new RpcShellyClient(createShellyTransport(nextInstallation.shelly.baseUrl));
  const relayId = nextInstallation.config.output.relayId;

  // Mode is blocked first, so no new automatic decision may be emitted. Two
  // confirmed OFF passes close an already in-flight Switch.Set from AUTO.
  await forceRelayOffAndConfirm(client, relayId);
  await forceRelayOffAndConfirm(client, relayId);

  return {
    installation: nextInstallation,
    status: await verifyModeWithRelayOff(nextInstallation, 'manual')
  };
};

export const resumeInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationActionResult> => {
  const prepared = await ensureInstalledAutomationRuntimeCurrent(installation);
  if (prepared.status.automationMode !== 'manual') {
    throw new Error('Automation must be in MANUAL before it can return to AUTO.');
  }

  const nextInstallation = prepared.installation;
  const client = new RpcShellyClient(createShellyTransport(nextInstallation.shelly.baseUrl));
  await forceRelayOffAndConfirm(client, nextInstallation.config.output.relayId);
  await setInstalledAutomationRuntimeMode(nextInstallation, 'auto');

  return {
    installation: nextInstallation,
    status: await verifyModeWithRelayOff(nextInstallation, 'auto')
  };
};

export const recoverInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationActionResult> => {
  const recovered = await recoverInstalledAutomationRuntime(installation);
  return { installation: recovered.installation, status: recovered.status };
};

export const setInstalledAutomationRelayState = async (
  installation: ClimateInstalledAutomation,
  on: boolean
): Promise<InstalledAutomationActionResult> => {
  const initialStatus = await requireMatchedInstalledAutomation(installation);
  if (initialStatus.automationMode !== 'manual' || !initialStatus.runtimeModeSupported) {
    throw new Error('Manual relay control requires a live MANUAL automation runtime.');
  }

  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  const relayId = installation.config.output.relayId;
  unwrapShellyResult(
    on ? await client.setRelayOn({ relayId }) : await client.setRelayOff({ relayId })
  );

  const verified = await requireMatchedInstalledAutomation(installation);
  if (verified.automationMode !== 'manual' || verified.relayOn !== on) {
    throw new Error(`Shelly did not confirm relay ${on ? 'ON' : 'OFF'} in MANUAL mode.`);
  }
  return { installation, status: verified };
};

export const deleteInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<void> => {
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  const relayId = installation.config.output.relayId;
  const setup = await readShellySetupStatus(installation.shelly.baseUrl);
  const targetScript = setup.scripts.find((script) => script.id === installation.script.id);
  const conflictingManagedScript = setup.scripts.find(
    (script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME && script.id !== installation.script.id
  );

  if (targetScript && targetScript.name !== LOCAL_CLIMATE_LINK_SCRIPT_NAME) {
    throw new Error('Stored script id belongs to a different Shelly script.');
  }
  if (conflictingManagedScript) {
    throw new Error('Shelly contains another Local Climate Link automation script.');
  }

  await forceRelayOffAndConfirm(client, relayId);
  if (!targetScript) {
    return;
  }

  if (targetScript.running) {
    const stopResult = await client.stopScript(targetScript.id);
    await forceRelayOffAndConfirm(client, relayId);
    unwrapShellyResult(stopResult);
  }

  const deleteResult = await client.deleteScript(targetScript.id);
  await forceRelayOffAndConfirm(client, relayId);
  unwrapShellyResult(deleteResult);

  const verified = await readShellySetupStatus(installation.shelly.baseUrl);
  if (verified.status.relayOn || verified.scripts.some((script) => script.id === installation.script.id)) {
    throw new Error('Shelly did not confirm a safely deleted automation.');
  }
};
'''
)

# Dashboard diagnostics are expected to stay live in MANUAL now.
replace(
    "apps/mobile/src/screens/AutomationDashboardScreen.tsx",
    "  } else if (control.isError || (query.isError && !manualControl)) {",
    "  } else if (control.isError || query.isError) {",
)

# The recovery model already distinguishes stopped from MANUAL; no extra UI
# suppression is needed anymore.
replace(
    "apps/mobile/src/screens/InstallationDetailScreen.tsx",
    "  const visibleRecovery =\n    recovery?.issue === 'script-stopped' && isPaused ? null : recovery;",
    "  const visibleRecovery = recovery;",
)

write(
    "packages/script-generator/src/__tests__/manual-runtime.test.ts",
    '''import { createDefaultShellyThermostatConfig, generateShellyThermostatScript } from '../index.js';
import { describe, expect, it, vi } from 'vitest';

const advertisement = (temperatureC: number, humidityPct: number): number[] => {
  const temp = Math.round(temperatureC * 100);
  const humidity = Math.round(humidityPct * 100);
  return [13, 0x16, 0xd2, 0xfc, 0x40, 0x02, temp & 255, (temp >> 8) & 255, 0x03, humidity & 255, (humidity >> 8) & 255];
};

const createRuntime = (script: string) => {
  let physicalRelayOn = false;
  let scanner: ((event: string, packet: { addr: string; advData: number[]; rssi: number }) => void) | undefined;
  const switchCalls: boolean[] = [];
  const shelly = {
    call: (method: string, params: { on: boolean }, callback?: (_r: unknown, e: number) => void) => {
      if (method === 'Switch.Set') {
        physicalRelayOn = params.on;
        switchCalls.push(params.on);
      }
      callback?.({}, 0);
    },
    getComponentStatus: (component: string) =>
      component === 'switch:0' ? { output: physicalRelayOn } : component === 'sys' ? { uptime: 1 } : null,
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
    `${script}\nreturn {diag:function(){return JSON.parse(diag());},setMode:function(m){R.nh=0;R.fh=0;if(m){R.md=1;R.rs="mn";}else{R.on=false;R.os=null;R.rs="ar";R.md=0;}}};`
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
      const base = createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2', 'heating');
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
      expect(runtime.runtime.diag().md).toBe(1);

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
      expect(runtime.runtime.diag().md).toBe(0);
      expect(runtime.physicalRelayOn()).toBe(true);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('keeps runtime control compact and uses diagnostics as the mode source of truth', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());
    expect(script).toContain('md:0');
    expect(script).toContain('md:R.md');
    expect(script).not.toContain('registerEndpoint("manual"');
    expect(script).not.toContain('registerEndpoint("auto"');
  });
});
'''
)

write(
    "apps/mobile/src/flows/installations/runtimeModeTransport.test.ts",
    '''import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { RPC_METHODS } from '@lcl/shelly-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

import { setInstalledAutomationRuntimeMode } from './runtimeModeTransport.js';

const installation = createInstalledAutomation({
  shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Salon',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: 'hash',
  config: createDefaultShellyThermostatConfig(),
  nowMs: 1000
});

describe('runtime mode transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.call.mockResolvedValue({ ok: true, value: { result: 'ok' } });
  });

  it('sets MANUAL inside the exact running script without Script.Stop', async () => {
    await setInstalledAutomationRuntimeMode(installation, 'manual');
    expect(mocks.call).toHaveBeenCalledWith({
      method: RPC_METHODS.ScriptEval,
      params: {
        id: 7,
        code: expect.stringContaining('R.md=1')
      }
    });
  });

  it('returns to AUTO through Script.Eval and resets runtime relay bookkeeping', async () => {
    await setInstalledAutomationRuntimeMode(installation, 'auto');
    expect(mocks.call).toHaveBeenCalledWith({
      method: RPC_METHODS.ScriptEval,
      params: {
        id: 7,
        code: expect.stringMatching(/R\.on=false.*R\.md=0/)
      }
    });
  });
});
'''
)

# runtimeControl tests need getStatus because pause now confirms OFF twice.
path = "apps/mobile/src/flows/installations/runtimeControl.test.ts"
text = read(path)
text = text.replace("  setRelayOff: vi.fn(),\n  readStatus:", "  setRelayOff: vi.fn(),\n  getStatus: vi.fn(),\n  readStatus:")
text = text.replace("      setRelayOff: mocks.setRelayOff\n", "      setRelayOff: mocks.setRelayOff,\n      getStatus: mocks.getStatus\n")
text = text.replace("    mocks.setRelayOff.mockResolvedValue({ ok: true, value: null });\n", "    mocks.setRelayOff.mockResolvedValue({ ok: true, value: null });\n    mocks.getStatus.mockResolvedValue({ ok: true, value: { relayOn: false } });\n")
# Pause now performs two explicit safe-OFF confirmations after changing mode.
text = text.replace(
    "    expect(mocks.setRuntimeMode).toHaveBeenCalledWith(installation, 'manual');\n    expect(mocks.setRelayOff).not.toHaveBeenCalled();",
    "    expect(mocks.setRuntimeMode).toHaveBeenCalledWith(installation, 'manual');\n    expect(mocks.setRelayOff).toHaveBeenCalledTimes(2);\n    expect(mocks.getStatus).toHaveBeenCalledTimes(2);"
)
write(path, text)

write(
    "docs/architecture/runtime-control.md",
    '''# Climate runtime control

## Runtime process vs control mode

The managed Shelly script is a long-lived runtime. `Script.List.running` describes the process only; it is not the user's AUTO/MANUAL choice.

The script keeps BLE scanning, diagnostics and sensor-derived telemetry alive in both modes:

- **AUTO** (`R.md = 0`): measurements may drive the configured relay rule.
- **MANUAL** (`R.md = 1`): measurements still update temperature, humidity, VPD and freshness, but the rule is not allowed to call `Switch.Set`.
- **stopped**: the managed script process is not running. This is a recovery state, not MANUAL.
- **missing**: the expected managed script cannot be found.

The diagnostic payload exposes compact `md: 0 | 1`. Older runtimes omit `md`; the app treats those as upgradeable rather than inventing a manual state.

## Mode transport

AUTO/MANUAL uses `Script.Eval` against the exact stored script id. This keeps the generated Shelly runtime small and avoids separate HTTP control endpoints. Normal user mode changes never call `Script.Stop` or `Script.Start`.

`Script.Stop`/`Script.Start` remain valid only for installation/update, explicit recovery and deletion flows.

## Safety ordering

AUTO -> MANUAL:

1. verify exact stored-script ownership;
2. set `R.md = 1` in the live script, immediately blocking new automatic relay decisions;
3. force and confirm relay OFF twice;
4. reread diagnostics/control state and require live MANUAL + relay OFF.

The generated `sw()` callback also checks `R.md`. If an AUTO `Switch.Set` was already in flight when MANUAL was selected, its callback immediately issues OFF instead of accepting the old decision.

MANUAL -> AUTO:

1. require exact live MANUAL ownership;
2. force and confirm relay OFF;
3. clear relay/hit bookkeeping and set `R.md = 0` with `Script.Eval`;
4. reread state and require AUTO + relay OFF.

The next valid BLE measurement makes the first fresh automatic decision.

Manual ON/OFF is allowed only when the exact managed script is live, reports MANUAL and supports the runtime-mode protocol. Every command is reread and verified.

## Runtime upgrades

A running pre-mode runtime has diagnostics but no `md`. On the first control-mode action the app safely reinstalls the current generated script in place, requires the same script id, forces OFF around the upgrade and persists the new script hash. A genuinely stopped runtime is kept distinct and goes through explicit recovery.
'''
)

# Keep the handoff accurate after changing the transport from HTTP endpoints.
path = "docs/HANDOFF_NEXT_CHAT.md"
text = read(path)
text = text.replace("runtime-owned AUTO/MANUAL HTTP endpoints", "runtime-owned AUTO/MANUAL state controlled through Script.Eval")
text = text.replace("/manual and /auto endpoints", "Script.Eval mode transitions")
write(path, text)

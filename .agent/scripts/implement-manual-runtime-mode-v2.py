from pathlib import Path


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
        raise SystemExit(f"{path}: expected at least {count} matches, found {actual}: {old[:160]!r}")
    write(path, text.replace(old, new, count))


# Runtime protocol version. Existing installed configs stay version 1; this only
# identifies the generated script capability.
replace(
    "packages/script-generator/src/shelly/config.ts",
    "export const GENERATOR_VERSION = '0.1.0';",
    "export const GENERATOR_VERSION = '0.2.0';",
)

generate = "packages/script-generator/src/shelly/generate.ts"
replace(
    generate,
    "var R={ls:null,l:0,t:null,h:null,tt:null,ht:null,b:null,r:null,on:false,rs:\"boot\",ds:\"boot\",lc:0,os:null,nh:0,fh:0,cv:null,vp:null,eo:null,ef:null,sa:0};",
    "var R={ls:null,l:0,t:null,h:null,tt:null,ht:null,b:null,r:null,on:false,rs:\"boot\",ds:\"boot\",lc:0,os:null,nh:0,fh:0,cv:null,vp:null,eo:null,ef:null,md:0,pc:0,sa:0};",
)
replace(
    generate,
    "var R={ls:null,l:0,t:null,h:null,b:null,r:null,on:false,rs:\"boot\",ds:\"boot\",lc:0,os:null,nh:0,fh:0,cv:null,vp:null,eo:null,ef:null,sa:0};",
    "var R={ls:null,l:0,t:null,h:null,b:null,r:null,on:false,rs:\"boot\",ds:\"boot\",lc:0,os:null,nh:0,fh:0,cv:null,vp:null,eo:null,ef:null,md:0,pc:0,sa:0};",
)
replace(
    generate,
    "'R.ds=\"ok\";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;var go=C.d?v>T.o:v<T.o,stop=C.d?v<T.f:v>T.f,gr=C.d?\"ab\":\"bl\",sr=C.d?\"bl\":\"ab\";if(go){R.nh++;R.fh=0;if(R.nh<C.h){sw(R.on,gr+\"h\",false);return;}sw(true,gr,false);return;}if(stop){R.fh++;R.nh=0;sw(false,sr,false);return;}R.nh=0;R.fh=0;sw(R.on,\"ib\",false);'",
    "'R.ds=\"ok\";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;if(R.md){R.nh=0;R.fh=0;R.rs=\"mn\";return;}var go=C.d?v>T.o:v<T.o,stop=C.d?v<T.f:v>T.f,gr=C.d?\"ab\":\"bl\",sr=C.d?\"bl\":\"ab\";if(go){R.nh++;R.fh=0;if(R.nh<C.h){sw(R.on,gr+\"h\",false);return;}sw(true,gr,false);return;}if(stop){R.fh++;R.nh=0;sw(false,sr,false);return;}R.nh=0;R.fh=0;sw(R.on,\"ib\",false);'",
)
replace(
    generate,
    'function sw(o,rs,f){var n=nw(),ch=R.on!=o;if(o&&!f&&ch&&n-R.lc<C.c){R.rs="mc";return;}Shelly.call("Switch.Set",{id:C.i,on:o},function(r,e){if(e){R.rs="se";Shelly.call("Switch.Set",{id:C.i,on:false});R.on=false;return;}R.on=o;R.rs=rs;if(ch)R.lc=n;R.os=o?n:null;});}',
    'function sw(o,rs,f){if(R.md)return;var n=nw(),ch=R.on!=o;if(o&&!f&&ch&&n-R.lc<C.c){R.rs="mc";return;}R.pc++;Shelly.call("Switch.Set",{id:C.i,on:o},function(r,e){R.pc--;if(R.md){R.on=false;R.os=null;R.rs="mn";return;}if(e){R.rs="se";Shelly.call("Switch.Set",{id:C.i,on:false});R.on=false;return;}R.on=o;R.rs=rs;if(ch)R.lc=n;R.os=o?n:null;});}',
)
old_diag = '''function diag(){var y=Shelly.getComponentStatus("sys"),w=Shelly.getComponentStatus("switch:0");return JSON.stringify({v:C.v,z:C.k,s:[C.fa,C.n],q:[C.m,C.d,C.on,C.off,C.s/1000,C.r],y:y?[y.time||null,y.unixtime||null,y.uptime||null]:null,p:w?[!!w.output,fv(w,"apower"),fv(w,"voltage"),fv(w,"current"),w.aenergy?fv(w.aenergy,"total"):null,w.temperature?fv(w.temperature,"tC"):null]:null,g:[R.ls,R.t,R.h,R.b,R.r,R.on,R.rs,R.lc,R.os,R.nh,R.fh,R.cv,R.vp,R.eo,R.ef,R.l,R.ds]});}
if(typeof HTTPServer!=="undefined"&&HTTPServer.registerEndpoint){HTTPServer.registerEndpoint("diag",function(q,p){p.code=200;p.headers=[["Content-Type","application/json"]];p.body=diag();p.send();});}'''
new_diag = '''function diag(){var y=Shelly.getComponentStatus("sys"),w=Shelly.getComponentStatus("switch:0");return JSON.stringify({v:C.v,md:R.md,z:C.k,s:[C.fa,C.n],q:[C.m,C.d,C.on,C.off,C.s/1000,C.r],y:y?[y.time||null,y.unixtime||null,y.uptime||null]:null,p:w?[!!w.output,fv(w,"apower"),fv(w,"voltage"),fv(w,"current"),w.aenergy?fv(w.aenergy,"total"):null,w.temperature?fv(w.temperature,"tC"):null]:null,g:[R.ls,R.t,R.h,R.b,R.r,R.on,R.rs,R.lc,R.os,R.nh,R.fh,R.cv,R.vp,R.eo,R.ef,R.l,R.ds]});}
function rp(p,c,b){p.code=c;p.headers=[["Content-Type","application/json"]];p.body=JSON.stringify(b);p.send();}
function cm(m,p){R.nh=0;R.fh=0;if(m)R.md=1;Shelly.call("Switch.Set",{id:C.i,on:false},function(r,e){if(e){rp(p,500,{m:R.md,e:1});return;}R.on=false;R.os=null;if(!m){R.rs="ar";R.md=0;rp(p,200,{m:0});return;}function w(){if(R.pc>0){Timer.set(10,false,w);return;}Shelly.call("Switch.Set",{id:C.i,on:false},function(r2,e2){if(e2){rp(p,500,{m:1,e:1});return;}R.on=false;R.os=null;R.rs="mn";rp(p,200,{m:1});});}w();});}
if(typeof HTTPServer!=="undefined"&&HTTPServer.registerEndpoint){HTTPServer.registerEndpoint("diag",function(q,p){p.code=200;p.headers=[["Content-Type","application/json"]];p.body=diag();p.send();});HTTPServer.registerEndpoint("manual",function(q,p){cm(1,p);});HTTPServer.registerEndpoint("auto",function(q,p){cm(0,p);});}'''
replace(generate, old_diag, new_diag)

# Diagnostics protocol: md is optional so the app can recognise and upgrade an
# already-installed 0.1 runtime without breaking reads.
schemas = "apps/mobile/src/flows/hardware-setup/schemas.ts"
replace(
    schemas,
    "    v: z.number(),\n    z: z.string(),",
    "    v: z.number(),\n    md: z.union([z.literal(0), z.literal(1)]).optional(),\n    z: z.string(),",
)
replace(
    schemas,
    "    script: {\n      configHash: snapshot.z,\n      running: true\n    },",
    "    script: {\n      configHash: snapshot.z,\n      running: true,\n      controlMode: snapshot.md === 1 ? ('manual' as const) : ('auto' as const),\n      controlModeSupported: snapshot.md !== undefined\n    },",
)

write(
    "apps/mobile/src/flows/installations/relaySafety.ts",
    """import type { RpcShellyClient } from '@lcl/shelly-client';
import { unwrapShellyResult } from '../hardware-setup/shellyRequests.js';

export const forceRelayOffAndConfirm = async (
  client: RpcShellyClient,
  relayId: number
): Promise<void> => {
  unwrapShellyResult(await client.setRelayOff({ relayId }));
  const status = unwrapShellyResult(await client.getStatus());
  if (status.relayOn) {
    throw new Error('Shelly relay did not confirm OFF.');
  }
};
""",
)

write(
    "apps/mobile/src/flows/installations/runtimeModeTransport.ts",
    """import { z } from 'zod';
import { fetchShellyJson } from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';

export type InstalledAutomationRuntimeMode = 'auto' | 'manual';

const runtimeModeResponseSchema = z.object({
  m: z.union([z.literal(0), z.literal(1)])
});

const runtimeModeEndpoint = (
  installation: ClimateInstalledAutomation,
  mode: InstalledAutomationRuntimeMode
): URL => new URL(`/script/${installation.script.id}/${mode}`, installation.shelly.baseUrl);

export const setInstalledAutomationRuntimeMode = async (
  installation: ClimateInstalledAutomation,
  mode: InstalledAutomationRuntimeMode
): Promise<void> => {
  const payload = await fetchShellyJson(runtimeModeEndpoint(installation, mode), 5000);
  const parsed = runtimeModeResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  const expectedMode = mode === 'manual' ? 1 : 0;
  if (parsed.data.m !== expectedMode) {
    throw new Error(`Shelly did not confirm ${mode.toUpperCase()} runtime mode.`);
  }
};
""",
)

write(
    "apps/mobile/src/flows/installations/runtimeStatus.ts",
    """import type { ShellyControlStatus } from '../hardware-setup/shellyRequests.js';
import { readShellyControlStatus } from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';
import { fetchInstalledAutomationDiagnostics } from './runtimeDiagnostics.js';

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

const baseMode = (status: ShellyControlStatus): InstalledAutomationControlMode =>
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
      automationMode: baseMode(status),
      runtimeModeSupported: false
    };
  }

  const snapshot = await fetchInstalledAutomationDiagnostics(installation);
  return {
    ...status,
    automationMode: snapshot.script.controlMode,
    runtimeModeSupported: snapshot.script.controlModeSupported
  };
};
""",
)

write(
    "apps/mobile/src/flows/installations/runtimeUpgrade.ts",
    """import { generateShellyThermostatScript } from '@lcl/script-generator';
import { createInstallPlan, RpcShellyClient } from '@lcl/shelly-client';
import {
  createShellyTransport,
  readShellyControlStatus,
  unwrapShellyResult
} from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';
import { forceRelayOffAndConfirm } from './relaySafety.js';
import {
  readInstalledAutomationControlStatus,
  type InstalledAutomationControlStatus
} from './runtimeStatus.js';

export type InstalledAutomationRuntimePreparation = {
  installation: ClimateInstalledAutomation;
  status: InstalledAutomationControlStatus;
  upgraded: boolean;
};

const assertStoredScriptOwnership = async (
  installation: ClimateInstalledAutomation
): Promise<void> => {
  const status = await readShellyControlStatus(installation.shelly.baseUrl);
  if (status.automationScriptId !== installation.script.id) {
    throw new Error('Stored automation script does not match Shelly.');
  }
};

const reinstallCurrentRuntime = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimePreparation> => {
  await assertStoredScriptOwnership(installation);
  const relayId = installation.config.output.relayId;
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));

  await forceRelayOffAndConfirm(client, relayId);
  const code = generateShellyThermostatScript(installation.config);
  const installed = unwrapShellyResult(await client.installScript(createInstallPlan(code)));
  if (installed.scriptId !== installation.script.id) {
    throw new Error('Runtime upgrade changed the stored Shelly script id.');
  }
  await forceRelayOffAndConfirm(client, relayId);

  const upgradedInstallation: ClimateInstalledAutomation = {
    ...installation,
    script: { id: installed.scriptId, hash: installed.scriptHash },
    updatedAtMs: Math.max(Date.now(), installation.updatedAtMs + 1)
  };
  const status = await readInstalledAutomationControlStatus(upgradedInstallation);
  if (
    status.automationScriptId !== upgradedInstallation.script.id ||
    status.automationMode !== 'auto' ||
    !status.runtimeModeSupported ||
    status.relayOn
  ) {
    throw new Error('Shelly did not confirm the upgraded automation runtime.');
  }

  return { installation: upgradedInstallation, status, upgraded: true };
};

export const ensureInstalledAutomationRuntimeCurrent = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimePreparation> => {
  const status = await readInstalledAutomationControlStatus(installation);
  if (status.automationScriptId !== installation.script.id || status.automationMode === 'missing') {
    throw new Error('Stored automation script does not match Shelly.');
  }
  if (status.automationMode === 'stopped') {
    throw new Error('Stopped automation runtime requires recovery.');
  }
  if (status.runtimeModeSupported) {
    return { installation, status, upgraded: false };
  }
  return reinstallCurrentRuntime(installation);
};

export const recoverInstalledAutomationRuntime = (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimePreparation> => reinstallCurrentRuntime(installation);
""",
)

write(
    "apps/mobile/src/flows/installations/runtimeControl.ts",
    """import { LOCAL_CLIMATE_LINK_SCRIPT_NAME, RpcShellyClient } from '@lcl/shelly-client';
import {
  createShellyTransport,
  readShellySetupStatus,
  unwrapShellyResult
} from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';
import { forceRelayOffAndConfirm } from './relaySafety.js';
import { setInstalledAutomationRuntimeMode } from './runtimeModeTransport.js';
import {
  ensureInstalledAutomationRuntimeCurrent,
  recoverInstalledAutomationRuntime
} from './runtimeUpgrade.js';
import {
  readInstalledAutomationControlStatus,
  type InstalledAutomationControlStatus
} from './runtimeStatus.js';

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

const verifyRuntimeMode = async (
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
    throw new Error('Automation runtime is not available for manual control.');
  }
  await setInstalledAutomationRuntimeMode(prepared.installation, 'manual');
  return {
    installation: prepared.installation,
    status: await verifyRuntimeMode(prepared.installation, 'manual')
  };
};

export const resumeInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationActionResult> => {
  const prepared = await ensureInstalledAutomationRuntimeCurrent(installation);
  if (prepared.status.automationMode !== 'manual') {
    throw new Error('Automation must be in MANUAL before it can return to AUTO.');
  }
  await setInstalledAutomationRuntimeMode(prepared.installation, 'auto');
  return {
    installation: prepared.installation,
    status: await verifyRuntimeMode(prepared.installation, 'auto')
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
""",
)

write(
    "apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts",
    """import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClimateInstalledAutomation } from './model.js';
import {
  pauseInstalledAutomation,
  readInstalledAutomationControlStatus,
  recoverInstalledAutomation,
  resumeInstalledAutomation,
  setInstalledAutomationRelayState
} from './runtimeControl.js';
import { fetchInstalledAutomationDiagnostics } from './runtimeDiagnostics.js';
import { useInstalledAutomationStore } from './store.js';

const installationQueryIdentity = (installation: ClimateInstalledAutomation) =>
  [
    installation.id,
    installation.shelly.baseUrl,
    installation.script.id,
    installation.script.hash,
    installation.updatedAtMs
  ] as const;

export const installedAutomationDiagnosticsQueryKey = (
  installation: ClimateInstalledAutomation
) => ['installed-automation-diagnostics', ...installationQueryIdentity(installation)] as const;

export const installedAutomationControlQueryKey = (
  installation: ClimateInstalledAutomation
) => ['installed-automation-control', ...installationQueryIdentity(installation)] as const;

export const useInstalledAutomationDiagnostics = (
  installation: ClimateInstalledAutomation,
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    queryKey: installedAutomationDiagnosticsQueryKey(installation),
    queryFn: () => fetchInstalledAutomationDiagnostics(installation),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

export const useInstalledAutomationControl = (
  installation: ClimateInstalledAutomation,
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    queryKey: installedAutomationControlQueryKey(installation),
    queryFn: () => readInstalledAutomationControlStatus(installation),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

export type InstalledAutomationControlAction =
  | 'auto'
  | 'manual'
  | 'on'
  | 'off'
  | 'recover';

export const useInstalledAutomationActions = (
  installation: ClimateInstalledAutomation
) => {
  const queryClient = useQueryClient();
  const upsertInstallation = useInstalledAutomationStore((state) => state.upsertInstallation);

  return useMutation({
    mutationFn: (action: InstalledAutomationControlAction) => {
      switch (action) {
        case 'auto':
          return resumeInstalledAutomation(installation);
        case 'manual':
          return pauseInstalledAutomation(installation);
        case 'on':
          return setInstalledAutomationRelayState(installation, true);
        case 'off':
          return setInstalledAutomationRelayState(installation, false);
        case 'recover':
          return recoverInstalledAutomation(installation);
      }
    },
    onSuccess: ({ installation: nextInstallation, status }) => {
      if (
        nextInstallation.script.hash !== installation.script.hash ||
        nextInstallation.updatedAtMs !== installation.updatedAtMs
      ) {
        upsertInstallation(nextInstallation);
      }
      queryClient.setQueryData(installedAutomationControlQueryKey(nextInstallation), status);
      void queryClient.invalidateQueries({
        queryKey: installedAutomationDiagnosticsQueryKey(nextInstallation)
      });
    }
  });
};
""",
)

# Recovery now means an actually stopped process, not intentional MANUAL mode.
health = "apps/mobile/src/flows/installations/healthRecovery.ts"
replace(
    health,
    "import type { ShellyAutomationMode } from '../hardware-setup/shellyRequests.js';",
    "import type { InstalledAutomationControlMode } from './runtimeStatus.js';",
)
replace(
    health,
    "  automationMode: ShellyAutomationMode | null;",
    "  automationMode: InstalledAutomationControlMode | null;",
)
replace(
    health,
    "  if (scriptMatch === 'matched' && automationMode === 'manual') {",
    "  if (scriptMatch === 'matched' && automationMode === 'stopped') {",
)

# Dashboard: a stopped process still owns the script id, but is not a normal
# AUTO/MANUAL target. Recovery is handled explicitly in Detail.
dashboard = "apps/mobile/src/screens/AutomationDashboardScreen.tsx"
replace(
    dashboard,
    "  const controlsVerified = controlMatch === 'matched';\n  const automationRunning = controlsVerified && controlStatus?.automationMode === 'auto';\n  const manualControl = controlsVerified && controlStatus?.automationMode === 'manual';",
    "  const controlsVerified = controlMatch === 'matched';\n  const runtimeControllable =\n    controlsVerified &&\n    (controlStatus?.automationMode === 'auto' || controlStatus?.automationMode === 'manual');\n  const automationRunning = controlsVerified && controlStatus?.automationMode === 'auto';\n  const manualControl = controlsVerified && controlStatus?.automationMode === 'manual';",
)
replace(
    dashboard,
    "            disabled={action.isPending || !controlsVerified}",
    "            disabled={action.isPending || !runtimeControllable}",
    count=2,
)

# Detail uses the shared action hook so upgrade persistence, cache invalidation,
# and mode semantics cannot drift from Dashboard.
detail = "apps/mobile/src/screens/InstallationDetailScreen.tsx"
replace(
    detail,
    "  deleteInstalledAutomation,\n  installedAutomationScriptMatch,\n  pauseInstalledAutomation,\n  resumeInstalledAutomation\n} from '../flows/installations/runtimeControl.js';",
    "  deleteInstalledAutomation,\n  installedAutomationScriptMatch\n} from '../flows/installations/runtimeControl.js';",
)
replace(
    detail,
    "  installedAutomationControlQueryKey,\n  installedAutomationDiagnosticsQueryKey,\n  useInstalledAutomationControl,\n  useInstalledAutomationDiagnostics\n} from '../flows/installations/useInstalledAutomationRuntime.js';",
    "  installedAutomationControlQueryKey,\n  installedAutomationDiagnosticsQueryKey,\n  useInstalledAutomationActions,\n  useInstalledAutomationControl,\n  useInstalledAutomationDiagnostics\n} from '../flows/installations/useInstalledAutomationRuntime.js';",
)
replace(
    detail,
    "  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation);\n  const controlQuery = useInstalledAutomationControl(installation);",
    "  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation);\n  const controlQuery = useInstalledAutomationControl(installation);\n  const automationAction = useInstalledAutomationActions(installation);",
)
start = read(detail).index("  const automationMutation = useMutation({")
end = read(detail).index("\n\n  const deleteMutation = useMutation({", start)
text = read(detail)
text = text[:start] + text[end + 2:]
write(detail, text)
replace(detail, "automationMutation.isPending", "automationAction.isPending", count=6)
replace(detail, "automationMutation.mutate();", "automationAction.mutate('recover');", count=1)
replace(
    detail,
    "                  if (isPaused) automationMutation.mutate();",
    "                  if (isPaused) {\n                    automationAction.mutate('auto', {\n                      onSuccess: () => pushToast('ok', t('detail.resumeSuccess'))\n                    });\n                  }",
)
replace(
    detail,
    "                  if (control?.automationMode === 'auto') automationMutation.mutate();",
    "                  if (control?.automationMode === 'auto') {\n                    automationAction.mutate('manual', {\n                      onSuccess: () => pushToast('ok', t('detail.pauseSuccess'))\n                    });\n                  }",
)
# Recovery success gets feedback too; use per-call callback without duplicating
# cache/store logic in the screen.
replace(
    detail,
    "                    automationAction.mutate('recover');\n                    return;",
    "                    automationAction.mutate('recover', {\n                      onSuccess: () => pushToast('ok', t('detail.resumeSuccess'))\n                    });\n                    return;",
)

# Tests: recovery semantics and runtime status/control are intentionally kept in
# separate files to avoid growing existing large integration tests.
replace(
    "apps/mobile/src/flows/installations/healthRecovery.test.ts",
    "        automationMode: 'manual'",
    "        automationMode: 'stopped'",
)
replace(
    "apps/mobile/src/flows/installations/healthRecovery.test.ts",
    "  it('maps stale runtime data to missing fresh sensor data without changing configuration', async () => {" if False else "  it('maps stale runtime data to missing fresh sensor data without changing configuration', () => {",
    "  it('keeps intentional MANUAL mode out of recovery', () => {\n    expect(\n      installationRecoveryState({\n        ...healthyInput,\n        automationMode: 'manual'\n      })\n    ).toBeNull();\n  });\n\n  it('maps stale runtime data to missing fresh sensor data without changing configuration', () => {",
)

write(
    "apps/mobile/src/flows/installations/runtimeStatus.test.ts",
    """import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ShellyRequestsModule from '../hardware-setup/shellyRequests.js';
import { createInstalledAutomation } from './model.js';
import type * as RuntimeDiagnosticsModule from './runtimeDiagnostics.js';

const mocks = vi.hoisted(() => ({
  readControlStatus: vi.fn(),
  fetchDiagnostics: vi.fn()
}));

vi.mock('../hardware-setup/shellyRequests.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyRequestsModule>();
  return { ...actual, readShellyControlStatus: mocks.readControlStatus };
});

vi.mock('./runtimeDiagnostics.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeDiagnosticsModule>();
  return { ...actual, fetchInstalledAutomationDiagnostics: mocks.fetchDiagnostics };
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

  it('reads MANUAL from a live runtime diagnostic instead of Script.List running state', async () => {
    mocks.readControlStatus.mockResolvedValue(baseStatus('auto', 7));
    mocks.fetchDiagnostics.mockResolvedValue({
      script: { controlMode: 'manual', controlModeSupported: true }
    });

    const status = await readInstalledAutomationControlStatus(installation);

    expect(status.automationMode).toBe('manual');
    expect(status.runtimeModeSupported).toBe(true);
  });

  it('recognises an old running runtime as AUTO but upgradeable', async () => {
    mocks.readControlStatus.mockResolvedValue(baseStatus('auto', 7));
    mocks.fetchDiagnostics.mockResolvedValue({
      script: { controlMode: 'auto', controlModeSupported: false }
    });

    const status = await readInstalledAutomationControlStatus(installation);

    expect(status.automationMode).toBe('auto');
    expect(status.runtimeModeSupported).toBe(false);
  });

  it('separates an actually stopped script from intentional MANUAL', async () => {
    mocks.readControlStatus.mockResolvedValue(baseStatus('manual', 7));

    const status = await readInstalledAutomationControlStatus(installation);

    expect(status.automationMode).toBe('stopped');
    expect(status.runtimeModeSupported).toBe(false);
    expect(mocks.fetchDiagnostics).not.toHaveBeenCalled();
  });
});
""",
)

write(
    "apps/mobile/src/flows/installations/runtimeControl.test.ts",
    """import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import type * as ShellyClientModule from '@lcl/shelly-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RuntimeModeModule from './runtimeModeTransport.js';
import type * as RuntimeStatusModule from './runtimeStatus.js';
import type * as RuntimeUpgradeModule from './runtimeUpgrade.js';
import { createInstalledAutomation } from './model.js';

const mocks = vi.hoisted(() => ({
  setRelayOn: vi.fn(),
  setRelayOff: vi.fn(),
  readStatus: vi.fn(),
  setRuntimeMode: vi.fn(),
  ensureCurrent: vi.fn(),
  recoverRuntime: vi.fn()
}));

vi.mock('@lcl/shelly-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyClientModule>();
  return {
    ...actual,
    RpcShellyClient: vi.fn(() => ({
      setRelayOn: mocks.setRelayOn,
      setRelayOff: mocks.setRelayOff
    }))
  };
});

vi.mock('./runtimeModeTransport.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeModeModule>();
  return { ...actual, setInstalledAutomationRuntimeMode: mocks.setRuntimeMode };
});

vi.mock('./runtimeStatus.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeStatusModule>();
  return { ...actual, readInstalledAutomationControlStatus: mocks.readStatus };
});

vi.mock('./runtimeUpgrade.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeUpgradeModule>();
  return {
    ...actual,
    ensureInstalledAutomationRuntimeCurrent: mocks.ensureCurrent,
    recoverInstalledAutomationRuntime: mocks.recoverRuntime
  };
});

import {
  installedAutomationScriptMatch,
  pauseInstalledAutomation,
  resumeInstalledAutomation,
  setInstalledAutomationRelayState
} from './runtimeControl.js';

const installation = createInstalledAutomation({
  shelly: { id: 'shelly-a', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Salon',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: 'hash',
  config: createDefaultShellyThermostatConfig(),
  nowMs: 1000
});

const status = (mode: 'auto' | 'manual' | 'stopped' | 'missing', relayOn = false) => ({
  relayOn,
  automationMode: mode,
  automationScriptId: mode === 'missing' ? null : 7,
  firmwareId: '1.0.0',
  telemetry: {},
  clock: { timeSynced: false },
  runtimeModeSupported: mode === 'auto' || mode === 'manual'
});

describe('installed automation runtime control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setRelayOn.mockResolvedValue({ ok: true, value: null });
    mocks.setRelayOff.mockResolvedValue({ ok: true, value: null });
  });

  it('matches ownership only by the stored script id', () => {
    expect(installedAutomationScriptMatch(installation, status('auto'))).toBe('matched');
    expect(installedAutomationScriptMatch(installation, status('missing'))).toBe('missing');
  });

  it('enters MANUAL through the live runtime without Script.Stop', async () => {
    mocks.ensureCurrent.mockResolvedValue({ installation, status: status('auto'), upgraded: false });
    mocks.readStatus.mockResolvedValue(status('manual'));

    const result = await pauseInstalledAutomation(installation);

    expect(mocks.setRuntimeMode).toHaveBeenCalledWith(installation, 'manual');
    expect(result.status.automationMode).toBe('manual');
    expect(result.status.relayOn).toBe(false);
  });

  it('returns to AUTO through the live runtime without Script.Start', async () => {
    mocks.ensureCurrent.mockResolvedValue({ installation, status: status('manual'), upgraded: false });
    mocks.readStatus.mockResolvedValue(status('auto'));

    const result = await resumeInstalledAutomation(installation);

    expect(mocks.setRuntimeMode).toHaveBeenCalledWith(installation, 'auto');
    expect(result.status.automationMode).toBe('auto');
    expect(result.status.relayOn).toBe(false);
  });

  it('keeps direct relay control gated by a live MANUAL runtime', async () => {
    mocks.readStatus
      .mockResolvedValueOnce(status('manual', false))
      .mockResolvedValueOnce(status('manual', true));

    const result = await setInstalledAutomationRelayState(installation, true);

    expect(mocks.setRelayOn).toHaveBeenCalledWith({ relayId: 0 });
    expect(result.status.relayOn).toBe(true);
  });

  it('rejects direct relay control when the process is actually stopped', async () => {
    mocks.readStatus.mockResolvedValue(status('stopped'));

    await expect(setInstalledAutomationRelayState(installation, true)).rejects.toThrow(
      'live MANUAL automation runtime'
    );
    expect(mocks.setRelayOn).not.toHaveBeenCalled();
  });
});
""",
)

write(
    "packages/script-generator/src/__tests__/manual-runtime.test.ts",
    """import { describe, expect, it, vi } from 'vitest';
import { createDefaultShellyThermostatConfig, generateShellyThermostatScript } from '../index.js';

const advertisement = (temperatureC: number, humidityPct: number): number[] => {
  const rawTemp = Math.round(temperatureC * 100);
  const rawHumidity = Math.round(humidityPct * 100);
  const payload = [
    0x40,
    0x02,
    rawTemp & 0xff,
    (rawTemp >> 8) & 0xff,
    0x03,
    rawHumidity & 0xff,
    (rawHumidity >> 8) & 0xff
  ];
  return [payload.length + 3, 0x16, 0xd2, 0xfc, ...payload];
};

type ResponseState = { code: number; body: string; sent: boolean };

const createRuntime = (script: string) => {
  let physicalRelayOn = false;
  let scanner: ((event: string, packet: { addr: string; advData: number[]; rssi: number }) => void) | undefined;
  const switchCalls: boolean[] = [];
  const endpoints = new Map<string, (_q: unknown, response: Record<string, unknown>) => void>();
  const scheduled: Array<() => void> = [];
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
      stop: () => undefined,
      subscribe: (callback: typeof scanner) => {
        scanner = callback;
      },
      start: () => true
    }
  };
  const timer = {
    set: (_duration: number, _repeat: boolean, callback: () => void) => {
      scheduled.push(callback);
    }
  };
  const httpServer = {
    registerEndpoint: (name: string, handler: (_q: unknown, response: Record<string, unknown>) => void) => {
      endpoints.set(name, handler);
    }
  };
  const runtime = new Function(
    'Shelly',
    'BLE',
    'Timer',
    'HTTPServer',
    `${script}\nreturn {diag:function(){return JSON.parse(diag());}};`
  )(shelly, ble, timer, httpServer) as { diag(): { md: number; g: unknown[] } };

  const invoke = (name: 'manual' | 'auto') => {
    const handler = endpoints.get(name);
    if (!handler) throw new Error(`Missing endpoint ${name}`);
    const state: ResponseState = { code: 0, body: '', sent: false };
    const response: Record<string, unknown> = {
      code: 0,
      headers: [],
      body: '',
      send: () => {
        state.code = response.code as number;
        state.body = response.body as string;
        state.sent = true;
      }
    };
    handler({}, response);
    while (!state.sent && scheduled.length > 0) scheduled.shift()?.();
    return state;
  };

  return {
    runtime,
    switchCalls,
    invoke,
    scan: (temperatureC: number, humidityPct: number) => {
      if (!scanner) throw new Error('Scanner was not subscribed');
      scanner('scan-result', {
        addr: 'A4:C1:38:4F:24:CD',
        advData: advertisement(temperatureC, humidityPct),
        rssi: -35
      });
    },
    setPhysicalRelayOn: (on: boolean) => {
      physicalRelayOn = on;
    },
    physicalRelayOn: () => physicalRelayOn
  };
};

describe('generated MANUAL runtime mode', () => {
  it('keeps telemetry alive while automatic relay decisions are disabled', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      const base = createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2', 'heating');
      const script = generateShellyThermostatScript({
        ...base,
        sensor: { ...base.sensor, runtimeAddress: 'A4:C1:38:4F:24:CD' },
        rule: { ...base.rule, consecutiveHits: 1, minChangeMs: 1 }
      });
      const runtime = createRuntime(script);

      runtime.scan(18, 50);
      expect(runtime.physicalRelayOn()).toBe(true);
      expect(runtime.runtime.diag().g[1]).toBe(18);

      const manual = runtime.invoke('manual');
      expect(manual.code).toBe(200);
      expect(JSON.parse(manual.body)).toEqual({ m: 1 });
      expect(runtime.runtime.diag().md).toBe(1);
      expect(runtime.physicalRelayOn()).toBe(false);

      const callsAfterManual = runtime.switchCalls.length;
      runtime.setPhysicalRelayOn(true);
      runtime.scan(23.5, 61);
      expect(runtime.runtime.diag().g[1]).toBe(23.5);
      expect(runtime.runtime.diag().g[2]).toBe(61);
      expect(runtime.physicalRelayOn()).toBe(true);
      expect(runtime.switchCalls).toHaveLength(callsAfterManual);

      const auto = runtime.invoke('auto');
      expect(auto.code).toBe(200);
      expect(JSON.parse(auto.body)).toEqual({ m: 0 });
      expect(runtime.runtime.diag().md).toBe(0);
      expect(runtime.physicalRelayOn()).toBe(false);

      runtime.scan(18, 50);
      expect(runtime.physicalRelayOn()).toBe(true);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('exposes compact runtime mode endpoints without stopping the script', () => {
    const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());
    expect(script).toContain('HTTPServer.registerEndpoint("manual"');
    expect(script).toContain('HTTPServer.registerEndpoint("auto"');
    expect(script).toContain('md:R.md');
    expect(script).not.toContain('Script.Stop');
    expect(script).not.toContain('Script.Start');
  });
});
""",
)

# Architecture documentation stays narrowly scoped to the runtime boundary.
write(
    "docs/architecture/runtime-control.md",
    """# Climate runtime control

## Runtime and control mode are separate states

A managed climate Shelly Script is a long-lived runtime. It owns BLE scanning, live diagnostics and AUTO control. Normal user switching between AUTO and MANUAL must not stop or start the script.

Runtime process state:

- `running`: the script process is alive and its `/diag` endpoint can serve live sensor data.
- `stopped`: the managed script exists but the process is not running. This is a recovery state, not MANUAL.
- `missing`: the managed script cannot be matched to the stored installation.

Control mode while the runtime is running:

- `AUTO`: BLE measurements update diagnostics and may drive the relay through the configured rule.
- `MANUAL`: BLE measurements and diagnostics continue, but automatic code cannot change the relay. The app may issue explicit ON/OFF commands.

## AUTO -> MANUAL safety boundary

The generated runtime changes to MANUAL before it releases automatic control. It then forces relay OFF, waits for already-issued automatic switch callbacks to drain, forces OFF again, and only then acknowledges MANUAL. New automatic switch requests are blocked as soon as MANUAL is selected.

This preserves the previous race-closing intent of OFF -> stop -> OFF without killing telemetry.

## MANUAL -> AUTO safety boundary

The runtime stays in MANUAL while it forces relay OFF. Only after the OFF call succeeds does it reset counters/state and expose AUTO. The next valid BLE measurement may then make a normal rule decision.

## Runtime upgrade

Generator 0.2 adds in-process AUTO/MANUAL support. A stored 0.1 runtime remains readable because the new `md` diagnostic field is optional. On the first MANUAL transition the app upgrades an old running runtime in place using the existing managed script id. The upgrade is OFF-first, verifies the same script id, starts the new runtime, confirms AUTO + relay OFF, persists the new script hash, and only then enters MANUAL.

An actually stopped runtime uses the explicit recovery path; it is never silently interpreted as MANUAL.

## Separation of responsibilities

- `runtimeStatus.ts`: maps low-level Script.List state plus `/diag` into `auto | manual | stopped | missing`.
- `runtimeModeTransport.ts`: calls only the runtime `auto`/`manual` HTTP endpoints.
- `relaySafety.ts`: reusable physical relay OFF confirmation for upgrade/delete paths.
- `runtimeUpgrade.ts`: capability migration and stopped-runtime recovery.
- `runtimeControl.ts`: ownership checks and high-level user actions.
- `useInstalledAutomationRuntime.ts`: React Query/store synchronization only.

Keep BLE parsing and climate rule decisions inside the script generator; do not move them into UI/runtime-control modules.
""",
)

refactor_doc = "docs/architecture/refactor-boundaries.md"
if Path(refactor_doc).exists():
    text = read(refactor_doc)
    marker = "\n## Climate runtime control boundary\n"
    if marker not in text:
        text += marker + "\nAUTO/MANUAL is an in-process runtime state. Keep transport, status interpretation, relay safety, upgrade/recovery, and React synchronization in their dedicated modules documented in `runtime-control.md`; do not fold them into `useHardwareSetupFlow`, Dashboard, or Installation Detail.\n"
        write(refactor_doc, text)

handoff = "docs/HANDOFF_NEXT_CHAT.md"
if Path(handoff).exists():
    text = read(handoff)
    marker = "\n## Climate AUTO/MANUAL runtime semantics (0.2)\n"
    if marker not in text:
        text += marker + "\nMANUAL keeps the managed Shelly Script running so BLE telemetry and `/diag` stay live. `stopped` is a separate recovery state. Existing 0.1 runtimes upgrade in place on the first MANUAL transition with OFF-first verification and the same script id. See `docs/architecture/runtime-control.md`.\n"
        write(handoff, text)

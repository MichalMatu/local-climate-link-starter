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
        raise SystemExit(f"{path}: expected at least {count} matches, found {actual}: {old[:120]!r}")
    text = text.replace(old, new, count)
    write(path, text)


# Generator capability/version.
replace(
    "packages/script-generator/src/shelly/config.ts",
    "export const GENERATOR_VERSION = '0.1.0';",
    "export const GENERATOR_VERSION = '0.2.0';",
)

generate = "packages/script-generator/src/shelly/generate.ts"
replace(
    generate,
    '"var R={ls:null,l:0,t:null,h:null,tt:null,ht:null,b:null,r:null,on:false,rs:\\"boot\\",ds:\\"boot\\",lc:0,os:null,nh:0,fh:0,cv:null,vp:null,eo:null,ef:null,sa:0};"',
    '"var R={ls:null,l:0,t:null,h:null,tt:null,ht:null,b:null,r:null,on:false,rs:\\"boot\\",ds:\\"boot\\",lc:0,os:null,nh:0,fh:0,cv:null,vp:null,eo:null,ef:null,md:0,sa:0};"',
)
replace(
    generate,
    '"var R={ls:null,l:0,t:null,h:null,b:null,r:null,on:false,rs:\\"boot\\",ds:\\"boot\\",lc:0,os:null,nh:0,fh:0,cv:null,vp:null,eo:null,ef:null,sa:0};"',
    '"var R={ls:null,l:0,t:null,h:null,b:null,r:null,on:false,rs:\\"boot\\",ds:\\"boot\\",lc:0,os:null,nh:0,fh:0,cv:null,vp:null,eo:null,ef:null,md:0,sa:0};"',
)
replace(
    generate,
    "'R.ds=\"ok\";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;var go=C.d?v>T.o:v<T.o,stop=C.d?v<T.f:v>T.f,gr=C.d?\"ab\":\"bl\",sr=C.d?\"bl\":\"ab\";if(go){R.nh++;R.fh=0;if(R.nh<C.h){sw(R.on,gr+\"h\",false);return;}sw(true,gr,false);return;}if(stop){R.fh++;R.nh=0;sw(false,sr,false);return;}R.nh=0;R.fh=0;sw(R.on,\"ib\",false);'",
    "'R.ds=\"ok\";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;if(R.md){R.nh=0;R.fh=0;R.rs=\"mn\";return;}var go=C.d?v>T.o:v<T.o,stop=C.d?v<T.f:v>T.f,gr=C.d?\"ab\":\"bl\",sr=C.d?\"bl\":\"ab\";if(go){R.nh++;R.fh=0;if(R.nh<C.h){sw(R.on,gr+\"h\",false);return;}sw(true,gr,false);return;}if(stop){R.fh++;R.nh=0;sw(false,sr,false);return;}R.nh=0;R.fh=0;sw(R.on,\"ib\",false);'",
)
replace(
    generate,
    'function sw(o,rs,f){var n=nw(),ch=R.on!=o;if(o&&!f&&ch&&n-R.lc<C.c){R.rs="mc";return;}Shelly.call("Switch.Set",{id:C.i,on:o},function(r,e){if(e){R.rs="se";Shelly.call("Switch.Set",{id:C.i,on:false});R.on=false;return;}R.on=o;R.rs=rs;if(ch)R.lc=n;R.os=o?n:null;});}',
    'function sw(o,rs,f){if(R.md&&o)return;var n=nw(),ch=R.on!=o;if(o&&!f&&ch&&n-R.lc<C.c){R.rs="mc";return;}Shelly.call("Switch.Set",{id:C.i,on:o},function(r,e){if(e){R.rs="se";Shelly.call("Switch.Set",{id:C.i,on:false});R.on=false;return;}R.on=o;R.rs=rs;if(ch)R.lc=n;R.os=o?n:null;});}',
)
replace(
    generate,
    'function stale(){var n=nw();if(R.ls===null||n-R.ls>C.s){R.ds="st";R.nh=0;R.fh=0;sw(false,"st",true);return;}if(R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}',
    'function stale(){var n=nw();if(R.ls===null||n-R.ls>C.s){R.ds="st";R.nh=0;R.fh=0;if(!R.md)sw(false,"st",true);return;}if(!R.md&&R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}',
)
replace(
    generate,
    'function diag(){var y=Shelly.getComponentStatus("sys"),w=Shelly.getComponentStatus("switch:0");return JSON.stringify({v:C.v,z:C.k,s:[C.fa,C.n],q:[C.m,C.d,C.on,C.off,C.s/1000,C.r],y:y?[y.time||null,y.unixtime||null,y.uptime||null]:null,p:w?[!!w.output,fv(w,"apower"),fv(w,"voltage"),fv(w,"current"),w.aenergy?fv(w.aenergy,"total"):null,w.temperature?fv(w.temperature,"tC"):null]:null,g:[R.ls,R.t,R.h,R.b,R.r,R.on,R.rs,R.lc,R.os,R.nh,R.fh,R.cv,R.vp,R.eo,R.ef,R.l,R.ds]});}\nif(typeof HTTPServer!=="undefined"&&HTTPServer.registerEndpoint){HTTPServer.registerEndpoint("diag",function(q,p){p.code=200;p.headers=[["Content-Type","application/json"]];p.body=diag();p.send();});}',
    'function diag(){var y=Shelly.getComponentStatus("sys"),w=Shelly.getComponentStatus("switch:0");return JSON.stringify({v:C.v,md:R.md,z:C.k,s:[C.fa,C.n],q:[C.m,C.d,C.on,C.off,C.s/1000,C.r],y:y?[y.time||null,y.unixtime||null,y.uptime||null]:null,p:w?[!!w.output,fv(w,"apower"),fv(w,"voltage"),fv(w,"current"),w.aenergy?fv(w.aenergy,"total"):null,w.temperature?fv(w.temperature,"tC"):null]:null,g:[R.ls,R.t,R.h,R.b,R.r,R.on,R.rs,R.lc,R.os,R.nh,R.fh,R.cv,R.vp,R.eo,R.ef,R.l,R.ds]});}\nfunction cm(m,p){R.nh=0;R.fh=0;if(m)R.md=1;Shelly.call("Switch.Set",{id:C.i,on:false},function(r,e){p.headers=[["Content-Type","application/json"]];if(e){p.code=500;p.body=JSON.stringify({m:R.md,e:1});p.send();return;}R.on=false;R.os=null;R.rs=m?"mn":"ar";R.md=m?1:0;p.code=200;p.body=JSON.stringify({m:R.md});p.send();});}\nif(typeof HTTPServer!=="undefined"&&HTTPServer.registerEndpoint){HTTPServer.registerEndpoint("diag",function(q,p){p.code=200;p.headers=[["Content-Type","application/json"]];p.body=diag();p.send();});HTTPServer.registerEndpoint("manual",function(q,p){cm(1,p);});HTTPServer.registerEndpoint("auto",function(q,p){cm(0,p);});}',
)

# Diagnostics expose runtime-control capability while remaining backward-compatible with old scripts.
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
  const shellyStatus = unwrapShellyResult(await client.getStatus());
  if (shellyStatus.relayOn) {
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

const modeEndpoint = (
  installation: ClimateInstalledAutomation,
  mode: InstalledAutomationRuntimeMode
): URL => new URL(`/script/${installation.script.id}/${mode}`, installation.shelly.baseUrl);

export const setInstalledAutomationRuntimeMode = async (
  installation: ClimateInstalledAutomation,
  mode: InstalledAutomationRuntimeMode
): Promise<void> => {
  const payload = await fetchShellyJson(modeEndpoint(installation, mode), 5000);
  const parsed = runtimeModeResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  const expected = mode === 'manual' ? 1 : 0;
  if (parsed.data.m !== expected) {
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

const stoppedOrBaseMode = (
  status: ShellyControlStatus
): InstalledAutomationControlMode =>
  status.automationMode === 'manual' ? 'stopped' : status.automationMode;

export const readInstalledAutomationControlStatus = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationControlStatus> => {
  const base = await readShellyControlStatus(installation.shelly.baseUrl);
  if (
    base.automationScriptId === null ||
    base.automationScriptId !== installation.script.id ||
    base.automationMode !== 'auto'
  ) {
    return {
      ...base,
      automationMode: stoppedOrBaseMode(base),
      runtimeModeSupported: false
    };
  }

  const snapshot = await fetchInstalledAutomationDiagnostics(installation);
  return {
    ...base,
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

const requireStoredScriptOwnership = async (
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
  await requireStoredScriptOwnership(installation);
  const relayId = installation.config.output.relayId;
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));

  await forceRelayOffAndConfirm(client, relayId);
  const code = generateShellyThermostatScript(installation.config);
  const installResult = unwrapShellyResult(await client.installScript(createInstallPlan(code)));
  if (installResult.scriptId !== installation.script.id) {
    throw new Error('Runtime upgrade changed the stored Shelly script id.');
  }
  await forceRelayOffAndConfirm(client, relayId);

  const upgradedInstallation: ClimateInstalledAutomation = {
    ...installation,
    script: {
      id: installResult.scriptId,
      hash: installResult.scriptHash
    },
    updatedAtMs: Date.now()
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
  if (status.automationScriptId !== installation.script.id) {
    throw new Error('Stored automation script does not match Shelly.');
  }
  if (status.automationMode === 'stopped') {
    throw new Error('Stopped automation runtime requires recovery.');
  }
  if (status.automationMode === 'missing') {
    throw new Error('Stored automation script does not match Shelly.');
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
  unwrapShellyResult,
  type ShellyControlStatus
} from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';
import { forceRelayOffAndConfirm } from './relaySafety.js';
import { setInstalledAutomationRuntimeMode } from './runtimeModeTransport.js';
import {
  readInstalledAutomationControlStatus,
  type InstalledAutomationControlStatus
} from './runtimeStatus.js';

export type InstalledAutomationScriptMatch = 'matched' | 'missing' | 'mismatch';

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

export const pauseInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationControlStatus> => {
  const initialStatus = await requireMatchedInstalledAutomation(installation);
  if (initialStatus.automationMode !== 'auto') {
    throw new Error('Automation must be running before it can enter manual mode.');
  }

  const relayId = installation.config.output.relayId;
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  let modeError: unknown;
  try {
    await setInstalledAutomationRuntimeMode(installation, 'manual');
  } catch (error) {
    modeError = error;
  }

  // MANUAL is armed inside the script before it requests OFF. Independently force
  // and verify OFF here as well, including when the endpoint itself reports failure.
  await forceRelayOffAndConfirm(client, relayId);
  if (modeError) {
    throw modeError;
  }

  const controlStatus = await requireMatchedInstalledAutomation(installation);
  if (controlStatus.automationMode !== 'manual' || controlStatus.relayOn) {
    throw new Error('Shelly did not confirm a safely paused automation.');
  }
  return controlStatus;
};

export const resumeInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationControlStatus> => {
  const initialStatus = await requireMatchedInstalledAutomation(installation);
  if (initialStatus.automationMode !== 'manual') {
    throw new Error('Automation must be manual before it can resume AUTO.');
  }

  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  await forceRelayOffAndConfirm(client, installation.config.output.relayId);
  await setInstalledAutomationRuntimeMode(installation, 'auto');

  const controlStatus = await requireMatchedInstalledAutomation(installation);
  if (controlStatus.automationMode !== 'auto' || controlStatus.relayOn) {
    throw new Error('Shelly did not confirm a running AUTO automation.');
  }
  return controlStatus;
};

export const setInstalledAutomationRelayState = async (
  installation: ClimateInstalledAutomation,
  on: boolean
): Promise<InstalledAutomationControlStatus> => {
  const initialStatus = await requireMatchedInstalledAutomation(installation);
  if (initialStatus.automationMode !== 'manual') {
    throw new Error('Manual relay control requires MANUAL runtime mode.');
  }

  const relayId = installation.config.output.relayId;
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  unwrapShellyResult(
    on ? await client.setRelayOn({ relayId }) : await client.setRelayOff({ relayId })
  );

  const verified = await requireMatchedInstalledAutomation(installation);
  if (verified.automationMode !== 'manual' || verified.relayOn !== on) {
    throw new Error(`Shelly did not confirm relay ${on ? 'ON' : 'OFF'} in manual mode.`);
  }
  return verified;
};

export const deleteInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<void> => {
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  const relayId = installation.config.output.relayId;
  const setup = await readShellySetupStatus(installation.shelly.baseUrl);
  const targetScript = setup.scripts.find((script) => script.id === installation.script.id);
  const conflictingManagedScript = setup.scripts.find(
    (script) =>
      script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME && script.id !== installation.script.id
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
  if (
    verified.status.relayOn ||
    verified.scripts.some((script) => script.id === installation.script.id)
  ) {
    throw new Error('Shelly did not confirm a safely deleted automation.');
  }
};

export type { InstalledAutomationControlStatus, ShellyControlStatus };
""",
)

write(
    "apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts",
    """import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClimateInstalledAutomation } from './model.js';
import { fetchInstalledAutomationDiagnostics } from './runtimeDiagnostics.js';
import {
  pauseInstalledAutomation,
  resumeInstalledAutomation,
  setInstalledAutomationRelayState
} from './runtimeControl.js';
import { readInstalledAutomationControlStatus } from './runtimeStatus.js';
import {
  ensureInstalledAutomationRuntimeCurrent,
  recoverInstalledAutomationRuntime
} from './runtimeUpgrade.js';
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

type InstalledAutomationActionResult = {
  installation: ClimateInstalledAutomation;
  status: Awaited<ReturnType<typeof readInstalledAutomationControlStatus>>;
};

export const useInstalledAutomationActions = (
  installation: ClimateInstalledAutomation
) => {
  const queryClient = useQueryClient();
  const upsertInstallation = useInstalledAutomationStore((state) => state.upsertInstallation);

  return useMutation({
    mutationFn: async (
      action: InstalledAutomationControlAction
    ): Promise<InstalledAutomationActionResult> => {
      if (action === 'recover') {
        const recovered = await recoverInstalledAutomationRuntime(installation);
        return { installation: recovered.installation, status: recovered.status };
      }

      let effectiveInstallation = installation;
      if (action === 'manual') {
        const prepared = await ensureInstalledAutomationRuntimeCurrent(installation);
        effectiveInstallation = prepared.installation;
      }

      const status =
        action === 'auto'
          ? await resumeInstalledAutomation(effectiveInstallation)
          : action === 'manual'
            ? await pauseInstalledAutomation(effectiveInstallation)
            : await setInstalledAutomationRelayState(effectiveInstallation, action === 'on');
      return { installation: effectiveInstallation, status };
    },
    onSuccess: ({ installation: effectiveInstallation, status }) => {
      const upgraded =
        effectiveInstallation.script.hash !== installation.script.hash ||
        effectiveInstallation.updatedAtMs !== installation.updatedAtMs;
      if (upgraded) {
        queryClient.removeQueries({
          queryKey: installedAutomationControlQueryKey(installation),
          exact: true
        });
        queryClient.removeQueries({
          queryKey: installedAutomationDiagnosticsQueryKey(installation),
          exact: true
        });
        upsertInstallation(effectiveInstallation);
      }

      queryClient.setQueryData(
        installedAutomationControlQueryKey(effectiveInstallation),
        status
      );
      void queryClient.invalidateQueries({
        queryKey: installedAutomationDiagnosticsQueryKey(effectiveInstallation),
        exact: true
      });
    }
  });
};
""",
)

# Recovery now means a genuinely stopped process; MANUAL is a healthy running runtime.
replace(
    "apps/mobile/src/flows/installations/healthRecovery.ts",
    "import type { ShellyAutomationMode } from '../hardware-setup/shellyRequests.js';",
    "import type { InstalledAutomationControlMode } from './runtimeStatus.js';",
)
replace(
    "apps/mobile/src/flows/installations/healthRecovery.ts",
    "  automationMode: ShellyAutomationMode | null;",
    "  automationMode: InstalledAutomationControlMode | null;",
)
replace(
    "apps/mobile/src/flows/installations/healthRecovery.ts",
    "  if (scriptMatch === 'matched' && automationMode === 'manual') {",
    "  if (scriptMatch === 'matched' && automationMode === 'stopped') {",
)

# Dashboard should not offer normal mode controls for a genuinely stopped runtime.
dashboard = "apps/mobile/src/screens/AutomationDashboardScreen.tsx"
replace(
    dashboard,
    "  const automationRunning = controlsVerified && controlStatus?.automationMode === 'auto';\n  const manualControl = controlsVerified && controlStatus?.automationMode === 'manual';",
    "  const modeControllable =\n    controlsVerified &&\n    (controlStatus?.automationMode === 'auto' || controlStatus?.automationMode === 'manual');\n  const automationRunning = modeControllable && controlStatus?.automationMode === 'auto';\n  const manualControl = modeControllable && controlStatus?.automationMode === 'manual';",
)
replace(
    dashboard,
    "            disabled={action.isPending || !controlsVerified}",
    "            disabled={action.isPending || !modeControllable}",
    2,
)

# Detail uses the shared runtime action orchestration, including one-time legacy upgrade/recovery.
detail = "apps/mobile/src/screens/InstallationDetailScreen.tsx"
replace(
    detail,
    "import {\n  deleteInstalledAutomation,\n  installedAutomationScriptMatch,\n  pauseInstalledAutomation,\n  resumeInstalledAutomation\n} from '../flows/installations/runtimeControl.js';",
    "import {\n  deleteInstalledAutomation,\n  installedAutomationScriptMatch\n} from '../flows/installations/runtimeControl.js';",
)
replace(
    detail,
    "  useInstalledAutomationControl,\n  useInstalledAutomationDiagnostics\n} from '../flows/installations/useInstalledAutomationRuntime.js';",
    "  useInstalledAutomationActions,\n  useInstalledAutomationControl,\n  useInstalledAutomationDiagnostics\n} from '../flows/installations/useInstalledAutomationRuntime.js';",
)
replace(
    detail,
    "  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation);\n  const controlQuery = useInstalledAutomationControl(installation);",
    "  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation);\n  const controlQuery = useInstalledAutomationControl(installation);\n  const runtimeAction = useInstalledAutomationActions(installation);",
)
replace(
    detail,
    "  const visibleRecovery =\n    recovery?.issue === 'script-stopped' && isPaused ? null : recovery;",
    "  const visibleRecovery = recovery;",
)
old_mutation = """  const automationMutation = useMutation({
    mutationFn: () =>
      isPaused
        ? resumeInstalledAutomation(installation)
        : pauseInstalledAutomation(installation),
    onSuccess: async (nextControl) => {
      queryClient.setQueryData(
        installedAutomationControlQueryKey(installation),
        nextControl
      );
      if (nextControl.automationMode === 'manual') {
        queryClient.removeQueries({
          queryKey: installedAutomationDiagnosticsQueryKey(installation),
          exact: true
        });
        pushToast('ok', t('detail.pauseSuccess'));
      } else {
        await queryClient.invalidateQueries({
          queryKey: installedAutomationDiagnosticsQueryKey(installation),
          exact: true
        });
        pushToast('ok', t('detail.resumeSuccess'));
      }
    },
    onError: () => pushToast('warning', t('detail.actionFailed'))
  });

"""
replace(detail, old_mutation, "")
replace(
    detail,
    "                  visibleRecovery.action === 'resume'\n                    ? automationMutation.isPending\n                    : diagnosticsQuery.isFetching || controlQuery.isFetching",
    "                  visibleRecovery.action === 'resume'\n                    ? runtimeAction.isPending\n                    : diagnosticsQuery.isFetching || controlQuery.isFetching",
)
replace(
    detail,
    "                  if (visibleRecovery.action === 'resume') {\n                    automationMutation.mutate();\n                    return;\n                  }",
    "                  if (visibleRecovery.action === 'resume') {\n                    runtimeAction.mutate('recover', {\n                      onSuccess: () => pushToast('ok', t('detail.resumeSuccess')),\n                      onError: () => pushToast('warning', t('detail.actionFailed'))\n                    });\n                    return;\n                  }",
)
replace(
    detail,
    "                {visibleRecovery.action === 'resume' && automationMutation.isPending",
    "                {visibleRecovery.action === 'resume' && runtimeAction.isPending",
)
replace(detail, "                  automationMutation.isPending ||", "                  runtimeAction.isPending ||", 2)
replace(
    detail,
    "                  if (isPaused) automationMutation.mutate();",
    "                  if (isPaused) {\n                    runtimeAction.mutate('auto', {\n                      onSuccess: () => pushToast('ok', t('detail.resumeSuccess')),\n                      onError: () => pushToast('warning', t('detail.actionFailed'))\n                    });\n                  }",
)
replace(
    detail,
    "                  if (control?.automationMode === 'auto') automationMutation.mutate();",
    "                  if (control?.automationMode === 'auto') {\n                    runtimeAction.mutate('manual', {\n                      onSuccess: () => pushToast('ok', t('detail.pauseSuccess')),\n                      onError: () => pushToast('warning', t('detail.actionFailed'))\n                    });\n                  }",
)
replace(
    detail,
    "              disabled={automationMutation.isPending || deleteMutation.isPending}",
    "              disabled={runtimeAction.isPending || deleteMutation.isPending}",
)

write(
    "docs/architecture/runtime-control.md",
    """# Climate runtime control

The climate Shelly script is a long-lived runtime, not an AUTO-only process. It owns two
separate responsibilities: BLE/diagnostic telemetry and automatic relay decisions.
Normal user mode changes must not start or stop that process.

## Runtime states

- `AUTO`: the script runs, BLE scanning and `/diag` stay active, and validated sensor
  samples may drive the relay through the configured rule.
- `MANUAL`: the same script keeps running and updating temperature, humidity, VPD,
  thresholds and freshness diagnostics, but automatic decisions cannot change the relay.
  The app may control the relay directly after exact script ownership is verified.
- `STOPPED`: the managed script exists but is not running. This is a recovery state, not
  a synonym for MANUAL.
- `MISSING`: the managed script cannot be found.

The generated runtime keeps the mode in its compact runtime state and exposes it in
`/diag`. `AUTO -> MANUAL` arms the manual guard before forcing the relay OFF. `MANUAL ->
AUTO` keeps the manual guard active until OFF has been confirmed and only then re-enables
automatic decisions. Hit counters are cleared on both transitions.

## Safety invariants

1. Entering MANUAL finishes with a separately verified physical relay OFF state.
2. While MANUAL, BLE samples continue to update diagnostics but never issue automatic ON
   or OFF decisions. Stale/max-on automation guards also do not override a manually
   selected relay state, matching the previous stopped-script MANUAL behavior.
3. Returning to AUTO starts from confirmed OFF and cleared decision counters.
4. Direct relay ON/OFF is accepted only for the exact stored script while its runtime
   reports MANUAL.
5. Script stop/start remains reserved for install/upgrade, recovery, BLE maintenance and
   deletion; it is not part of normal AUTO/MANUAL switching.

## Existing installations

Runtime mode support was introduced in generator `0.2.0`. A running legacy climate
script is detected through the diagnostics capability bit. The first request to enter
MANUAL performs a safe in-place reinstall of the current generated runtime: relay OFF is
verified before and after upload, the script id must remain unchanged, and the persisted
script hash is refreshed. A genuinely stopped runtime uses the explicit recovery path.
""",
)

# Keep refactor boundaries explicit so this feature does not grow existing orchestration hotspots.
refactor_doc = "docs/architecture/refactor-boundaries.md"
text = read(refactor_doc)
addition = """

## Climate runtime control boundary

Normal AUTO/MANUAL control is split across small installation-flow modules: runtime
status interpretation, mode transport, relay safety and legacy runtime upgrade. Keep
these concerns separate rather than moving them into `useHardwareSetupFlow.ts` or the
screen components. Script stop/start is a lifecycle/recovery operation; runtime mode is
a control-plane operation while the script remains alive.
"""
if "## Climate runtime control boundary" not in text:
    write(refactor_doc, text.rstrip() + addition + "\n")

print("MANUAL_RUNTIME_SOURCE_EDIT_OK")

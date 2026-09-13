#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='83f889a424ed1128c34b8586118f0c58e6ae9d26'
git fetch --prune origin "$BRANCH" agent-control
test -z "$(git status --porcelain)"
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

cat > apps/mobile/src/flows/hardware-setup/shellyRuntimeMode.ts <<'EOF'
import {
  RPC_METHODS,
  type FetchShellyRpcTransport,
  type ShellyClientError
} from '@lcl/shelly-client';
import { z } from 'zod';

export type ShellyRuntimeMode = 'auto' | 'manual';
export type ShellyRuntimeModeState = {
  mode: ShellyRuntimeMode;
  supported: boolean;
};

type RuntimeModeTransport = Pick<FetchShellyRpcTransport, 'call'>;
const scriptEvalResponseSchema = z.object({ result: z.string() });
const runtimeModeEvalCode: Record<ShellyRuntimeMode, string> = {
  manual: 'R.m=1;R.nh=R.fh=0;R.on=false;R.os=null;R.rs="mn";R.m',
  auto: 'R.nh=R.fh=0;R.on=false;R.os=null;R.rs="ar";R.m=0;R.m'
};
const readModeEvalCode = 'typeof R==="object"&&typeof R.m==="number"?R.m:-1';

const resultMessage = (error: ShellyClientError): string =>
  error.technicalMessage ?? `Shelly RPC: ${error.kind}`;

const evaluateRuntime = async (
  transport: RuntimeModeTransport,
  scriptId: number,
  code: string
): Promise<string> => {
  const response = await transport.call<unknown>({
    method: RPC_METHODS.ScriptEval,
    params: { id: scriptId, code }
  });
  if (!response.ok) {
    throw new Error(resultMessage(response.error));
  }
  return scriptEvalResponseSchema.parse(response.value).result;
};

export const readShellyRuntimeMode = async (
  transport: RuntimeModeTransport,
  scriptId: number
): Promise<ShellyRuntimeModeState> => {
  const result = await evaluateRuntime(transport, scriptId, readModeEvalCode);
  if (result === '1') return { mode: 'manual', supported: true };
  if (result === '0') return { mode: 'auto', supported: true };
  return { mode: 'auto', supported: false };
};

export const setShellyRuntimeMode = async (
  transport: RuntimeModeTransport,
  scriptId: number,
  mode: ShellyRuntimeMode
): Promise<void> => {
  const result = await evaluateRuntime(transport, scriptId, runtimeModeEvalCode[mode]);
  const expected = mode === 'manual' ? '1' : '0';
  if (result !== expected) {
    throw new Error(`Shelly did not confirm ${mode.toUpperCase()} runtime mode.`);
  }
};
EOF

cat > apps/mobile/src/flows/installations/runtimeModeTransport.ts <<'EOF'
import { createShellyTransport } from '../hardware-setup/shellyRequests.js';
import {
  readShellyRuntimeMode,
  setShellyRuntimeMode,
  type ShellyRuntimeMode,
  type ShellyRuntimeModeState
} from '../hardware-setup/shellyRuntimeMode.js';
import type { ClimateInstalledAutomation } from './model.js';

export type InstalledAutomationRuntimeMode = ShellyRuntimeMode;
export type InstalledAutomationRuntimeModeState = ShellyRuntimeModeState;

export const readInstalledAutomationRuntimeMode = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimeModeState> =>
  readShellyRuntimeMode(
    createShellyTransport(installation.shelly.baseUrl),
    installation.script.id
  );

export const setInstalledAutomationRuntimeMode = async (
  installation: ClimateInstalledAutomation,
  mode: InstalledAutomationRuntimeMode
): Promise<void> =>
  setShellyRuntimeMode(
    createShellyTransport(installation.shelly.baseUrl),
    installation.script.id,
    mode
  );
EOF

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/flows/hardware-setup/shellyRequests.ts')
s=p.read_text()
old="""import { t } from '../../app/i18n.js';\n"""
new="""import { t } from '../../app/i18n.js';\nimport { readShellyRuntimeMode, setShellyRuntimeMode } from './shellyRuntimeMode.js';\n"""
if old not in s: raise SystemExit('import anchor missing')
s=s.replace(old,new,1)
s=s.replace("""export type ShellyBleDiscoveryPreparation = {\n  automationScriptId: number | null;\n  automationWasRunning: boolean;\n};\n\nexport type ShellyAutomationMode = 'auto' | 'manual' | 'missing';\n""","""export type ShellyBleDiscoveryPreparation = {\n  automationScriptId: number | null;\n  automationWasRunning: boolean;\n  automationMode: ShellyAutomationMode;\n};\n\nexport type ShellyAutomationMode = 'auto' | 'manual' | 'stopped' | 'missing';\n""",1)
old="""const toControlStatus = (\n  deviceInfo: ShellyDeviceInfo,\n  status: HardwareSetupStatus['status'],\n  scripts: ScriptListEntry[]\n): ShellyControlStatus => {\n  const automationScript = findAutomationScript(scripts);\n  return {\n    relayOn: status.relayOn,\n    automationMode: automationScript\n      ? automationScript.running\n        ? 'auto'\n        : 'manual'\n      : 'missing',\n    automationScriptId: automationScript?.id ?? null,\n    firmwareId: deviceInfo.firmwareId ?? null,\n    telemetry: status.telemetry,\n    clock: status.clock\n  };\n};\n"""
new="""const readAutomationMode = async (\n  transport: FetchShellyRpcTransport,\n  scripts: ScriptListEntry[]\n): Promise<ShellyAutomationMode> => {\n  const automationScript = findAutomationScript(scripts);\n  if (!automationScript) return 'missing';\n  if (!automationScript.running) return 'stopped';\n  const runtime = await readShellyRuntimeMode(transport, automationScript.id);\n  return runtime.supported ? runtime.mode : 'auto';\n};\n\nconst toControlStatus = (\n  deviceInfo: ShellyDeviceInfo,\n  status: HardwareSetupStatus['status'],\n  scripts: ScriptListEntry[],\n  automationMode: ShellyAutomationMode\n): ShellyControlStatus => {\n  const automationScript = findAutomationScript(scripts);\n  return {\n    relayOn: status.relayOn,\n    automationMode,\n    automationScriptId: automationScript?.id ?? null,\n    firmwareId: deviceInfo.firmwareId ?? null,\n    telemetry: status.telemetry,\n    clock: status.clock\n  };\n};\n"""
if old not in s: raise SystemExit('toControlStatus anchor missing')
s=s.replace(old,new,1)
old="""  const automationScript = findAutomationScript(scripts);\n  if (automationScript?.running) {\n    unwrapShellyResult(await client.stopScript(automationScript.id));\n  }\n\n  return {\n    automationScriptId: automationScript?.id ?? null,\n    automationWasRunning: automationScript?.running ?? false\n  };\n};\n"""
new="""  const automationScript = findAutomationScript(scripts);\n  const automationMode = await readAutomationMode(transport, scripts);\n  if (automationScript?.running) {\n    unwrapShellyResult(await client.stopScript(automationScript.id));\n  }\n\n  return {\n    automationScriptId: automationScript?.id ?? null,\n    automationWasRunning: automationScript?.running ?? false,\n    automationMode\n  };\n};\n"""
if old not in s: raise SystemExit('prepare anchor missing')
s=s.replace(old,new,1)
old="""  return toControlStatus(\n    unwrapShellyResult(deviceInfo),\n    unwrapShellyResult(status),\n    scripts\n  );\n};\n"""
new="""  return toControlStatus(\n    unwrapShellyResult(deviceInfo),\n    unwrapShellyResult(status),\n    scripts,\n    await readAutomationMode(transport, scripts)\n  );\n};\n"""
if old not in s: raise SystemExit('read control anchor missing')
s=s.replace(old,new,1)
old="""    status: toControlStatus(\n      unwrapShellyResult(deviceInfo),\n      unwrapShellyResult(status),\n      scripts\n    )\n  };\n};\n"""
new="""    status: toControlStatus(\n      unwrapShellyResult(deviceInfo),\n      unwrapShellyResult(status),\n      scripts,\n      await readAutomationMode(transport, scripts)\n    )\n  };\n};\n"""
if old not in s: raise SystemExit('script state anchor missing')
s=s.replace(old,new,1)
old="""  options: {\n    discoveryScriptId: number | null;\n    automationScriptId: number | null;\n    restartAutomation: boolean;\n  }\n): Promise<void> => {\n  const client = new RpcShellyClient(createShellyTransport(baseUrl));\n"""
new="""  options: {\n    discoveryScriptId: number | null;\n    automationScriptId: number | null;\n    automationWasRunning: boolean;\n    automationMode: ShellyAutomationMode;\n  }\n): Promise<void> => {\n  const transport = createShellyTransport(baseUrl);\n  const client = new RpcShellyClient(transport);\n"""
if old not in s: raise SystemExit('stop options anchor missing')
s=s.replace(old,new,1)
old="""  if (\n    options.restartAutomation &&\n    options.automationScriptId !== null &&\n    discoveryStopped\n  ) {\n    unwrapShellyResult(await client.startScript(options.automationScriptId));\n  }\n\n  if (stopError) {\n    throw stopError;\n  }\n};\n"""
new="""  let restoreError: Error | null = null;\n  if (\n    options.automationWasRunning &&\n    options.automationScriptId !== null &&\n    discoveryStopped\n  ) {\n    try {\n      unwrapShellyResult(await client.startScript(options.automationScriptId));\n      if (options.automationMode === 'auto' || options.automationMode === 'manual') {\n        await setShellyRuntimeMode(\n          transport,\n          options.automationScriptId,\n          options.automationMode\n        );\n      }\n    } catch (error) {\n      restoreError =\n        error instanceof Error ? error : new Error(t('common.operationFailed'));\n    } finally {\n      try {\n        unwrapShellyResult(await client.setRelayOff());\n      } catch (error) {\n        if (!restoreError) {\n          restoreError =\n            error instanceof Error ? error : new Error(t('common.operationFailed'));\n        }\n      }\n    }\n  }\n\n  if (stopError) throw stopError;\n  if (restoreError) throw restoreError;\n};\n"""
if old not in s: raise SystemExit('restore anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
PY

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts')
s=p.read_text()
s=s.replace("""import type { BleDiscoverySnapshot } from './schemas.js';\n""","""import type { BleDiscoverySnapshot } from './schemas.js';\nimport type { ShellyAutomationMode } from './shellyRequests.js';\n""",1)
s=s.replace("""  automationScriptId: number | null;\n  automationWasRunning: boolean;\n};\n""","""  automationScriptId: number | null;\n  automationWasRunning: boolean;\n  automationMode: ShellyAutomationMode;\n};\n""",1)
s=s.replace("""          automationScriptId: preparation.automationScriptId,\n          automationWasRunning: preparation.automationWasRunning\n""","""          automationScriptId: preparation.automationScriptId,\n          automationWasRunning: preparation.automationWasRunning,\n          automationMode: preparation.automationMode\n""",1)
s=s.replace("""              automationScriptId: preparation.automationScriptId,\n              restartAutomation: preparation.automationWasRunning\n""","""              automationScriptId: preparation.automationScriptId,\n              automationWasRunning: preparation.automationWasRunning,\n              automationMode: preparation.automationMode\n""",1)
s=s.replace("""        automationScriptId: session.automationScriptId,\n        restartAutomation: session.automationWasRunning\n""","""        automationScriptId: session.automationScriptId,\n        automationWasRunning: session.automationWasRunning,\n        automationMode: session.automationMode\n""",1)
p.write_text(s)
PY

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts')
s=p.read_text()
s=s.replace("""import type { ShellyDraftDevice } from './setupDraftStore.js';\n""","""import type { ShellyDraftDevice } from './setupDraftStore.js';\nimport { setShellyRuntimeMode } from './shellyRuntimeMode.js';\n""",1)
s=s.replace("""    automationMode: automationScript\n      ? automationScript.running\n        ? 'auto'\n        : 'manual'\n      : 'missing',\n""","""    automationMode: automationScript\n      ? automationScript.running\n        ? 'auto'\n        : 'stopped'\n      : 'missing',\n""",1)
old="""      const currentStatus = await readShellyControlStatus(device.baseUrl);\n      const scriptId = requireAutomationScript(currentStatus);\n      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));\n      unwrapShellyResult(await client.startScript(scriptId));\n      return {\n        device,\n        status: await readShellyControlStatus(device.baseUrl)\n      };\n"""
new="""      const currentStatus = await readShellyControlStatus(device.baseUrl);\n      const scriptId = requireAutomationScript(currentStatus);\n      if (currentStatus.automationMode === 'stopped') {\n        throw new Error(t('hardware.rule.automationScriptMissing'));\n      }\n      const transport = createShellyTransport(device.baseUrl);\n      const client = new RpcShellyClient(transport);\n      unwrapShellyResult(await client.setRelayOff());\n      await setShellyRuntimeMode(transport, scriptId, 'auto');\n      const status = await readShellyControlStatus(device.baseUrl);\n      if (status.automationMode !== 'auto' || status.relayOn) {\n        throw new Error(t('common.operationFailed'));\n      }\n      return { device, status };\n"""
if old not in s: raise SystemExit('auto mutation anchor missing')
s=s.replace(old,new,1)
old="""      const currentStatus = await readShellyControlStatus(device.baseUrl);\n      const scriptId = requireAutomationScript(currentStatus);\n      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));\n      const stopResult = await client.stopScript(scriptId);\n      const offResult = await client.setRelayOff();\n      unwrapShellyResult(offResult);\n      unwrapShellyResult(stopResult);\n      return {\n        device,\n        status: await readShellyControlStatus(device.baseUrl)\n      };\n"""
new="""      const currentStatus = await readShellyControlStatus(device.baseUrl);\n      const scriptId = requireAutomationScript(currentStatus);\n      if (currentStatus.automationMode === 'stopped') {\n        throw new Error(t('hardware.rule.automationScriptMissing'));\n      }\n      const transport = createShellyTransport(device.baseUrl);\n      const client = new RpcShellyClient(transport);\n      await setShellyRuntimeMode(transport, scriptId, 'manual');\n      unwrapShellyResult(await client.setRelayOff());\n      unwrapShellyResult(await client.setRelayOff());\n      const status = await readShellyControlStatus(device.baseUrl);\n      if (status.automationMode !== 'manual' || status.relayOn) {\n        throw new Error(t('common.operationFailed'));\n      }\n      return { device, status };\n"""
if old not in s: raise SystemExit('manual mutation anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
PY

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s=p.read_text()
s=s.replace("""    let thermostatRunning = true;\n    let thermostatDeleted = false;\n""","""    let thermostatRunning = true;\n    let thermostatMode: 0 | 1 = 0;\n    let thermostatDeleted = false;\n""",1)
anchor="""          case 'Script.GetCode':\n            return rpcResult({ data: thermostatCode, left: 0 });\n"""
insert="""          case 'Script.Eval': {\n            const params = body.params as { id?: number; code?: string } | undefined;\n            if (params?.id !== 1 || !thermostatRunning) {\n              return rpcResult({ result: '-1' });\n            }\n            const code = params.code ?? '';\n            if (code.includes('R.m=1')) thermostatMode = 1;\n            if (code.includes('R.m=0')) thermostatMode = 0;\n            return rpcResult({ result: String(thermostatMode) });\n          }\n"""
if anchor not in s: raise SystemExit('eval insertion anchor missing')
s=s.replace(anchor,anchor+insert,1)
old="""    const controlCalls = vi\n      .mocked(fetch)\n      .mock.calls.map((call) => requestBody(call[1]))\n      .filter((body) =>\n        ['Script.Stop', 'Script.Start', 'Switch.Set'].includes(body.method ?? '')\n      );\n\n    expect(controlCalls).toEqual(\n      expect.arrayContaining([\n        expect.objectContaining({ method: 'Script.Stop', params: { id: 1 } }),\n        expect.objectContaining({\n          method: 'Switch.Set',\n          params: { id: 0, on: false }\n        }),\n        expect.objectContaining({ method: 'Script.Start', params: { id: 1 } })\n      ])\n    );\n"""
new="""    const controlCalls = vi\n      .mocked(fetch)\n      .mock.calls.map((call) => requestBody(call[1]))\n      .filter((body) =>\n        ['Script.Eval', 'Script.Stop', 'Script.Start', 'Switch.Set'].includes(\n          body.method ?? ''\n        )\n      );\n    const evalCodes = controlCalls\n      .filter((body) => body.method === 'Script.Eval')\n      .map((body) => (body.params as { code?: string } | undefined)?.code ?? '');\n\n    expect(evalCodes.some((code) => code.includes('R.m=1'))).toBe(true);\n    expect(evalCodes.some((code) => code.includes('R.m=0'))).toBe(true);\n    expect(controlCalls.some((body) => body.method === 'Script.Stop')).toBe(false);\n    expect(controlCalls.some((body) => body.method === 'Script.Start')).toBe(false);\n    expect(controlCalls).toEqual(\n      expect.arrayContaining([\n        expect.objectContaining({\n          method: 'Switch.Set',\n          params: { id: 0, on: false }\n        })\n      ])\n    );\n"""
if old not in s: raise SystemExit('control expectation anchor missing')
s=s.replace(old,new,1)
# Add explicit BLE MANUAL restoration test before stale scanner test.
anchor="""  it('removes a stale BLE discovery script before starting a new Shelly BLE scan', async () => {\n"""
test="""  it('restores MANUAL runtime mode after temporary Shelly BLE discovery', async () => {\n    renderHardwareSetup();\n    await addShellyThroughUi();\n\n    const savedPlugList = screen.getByLabelText('Dodane gniazdka');\n    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);\n    fireEvent.click(within(actionRow).getByRole('button', { name: 'MANUAL' }));\n    await screen.findByText('Tryb MANUAL. Przekaźnik OFF.');\n\n    const callsBeforeScan = vi.mocked(fetch).mock.calls.length;\n    await openShellyBleScanFromSettings();\n    const dialog = await screen.findByRole('dialog', { name: 'Skanuj termometry BLE' });\n    expect(await findBleScanCandidate(dialog)).toBeInTheDocument();\n    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));\n\n    await waitFor(() => {\n      const bodies = vi\n        .mocked(fetch)\n        .mock.calls.slice(callsBeforeScan)\n        .map((call) => requestBody(call[1]));\n      const restartIndex = bodies.findIndex(\n        (body) =>\n          body.method === 'Script.Start' &&\n          (body.params as { id?: number } | undefined)?.id === 1\n      );\n      expect(restartIndex).toBeGreaterThanOrEqual(0);\n      const restoreCodes = bodies\n        .slice(restartIndex + 1)\n        .filter((body) => body.method === 'Script.Eval')\n        .map((body) => (body.params as { code?: string } | undefined)?.code ?? '');\n      expect(restoreCodes.some((code) => code.includes('R.m=1'))).toBe(true);\n    });\n  });\n\n"""
if test not in s:
  if anchor not in s: raise SystemExit('manual BLE test anchor missing')
  s=s.replace(anchor,test+anchor,1)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/shellyRuntimeMode.ts \
  apps/mobile/src/flows/installations/runtimeModeTransport.ts \
  apps/mobile/src/flows/hardware-setup/shellyRequests.ts \
  apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts \
  apps/mobile/src/__tests__/hardware-setup.test.tsx

git diff --check
pnpm --dir apps/mobile exec vitest run \
  src/flows/installations/runtimeModeTransport.test.ts \
  src/__tests__/hardware-setup.test.tsx
pnpm quality:repo
pnpm typecheck

python3 - <<'PY'
from pathlib import Path
p=Path('docs/implementation/device-rule-decoupling-progress.md')
s=p.read_text()
entry="""\n### Runtime mode checkpoint — canonical R.m and BLE restoration\n\n- Extracted shared Shelly runtime-mode `Script.Eval` transport so setup and installed-runtime paths use the same `R.m` protocol.\n- Normal AUTO/MANUAL control no longer uses `Script.Stop` / `Script.Start`; MANUAL keeps the managed thermostat script running and forces relay OFF.\n- A stopped thermostat script is now represented separately from MANUAL instead of being treated as MANUAL.\n- Temporary Shelly BLE discovery records the prior AUTO/MANUAL state and restores that exact `R.m` mode after restarting the temporarily stopped automation script.\n- Added focused coverage proving normal mode changes avoid Script.Stop/Start and BLE discovery restores MANUAL.\n- Focused runtime/hardware-setup tests, repository gate and workspace typecheck passed before commit.\n\nExact next step: move climate/time creation and dashboard persistence from `InstalledAutomation`/device draft snapshots to the dedicated rule/device registries, then remove legacy product callers.\n"""
if entry.strip() not in s: s += entry
p.write_text(s)
PY
pnpm exec prettier --write docs/implementation/device-rule-decoupling-progress.md
git diff --check

git add \
  apps/mobile/src/flows/hardware-setup/shellyRuntimeMode.ts \
  apps/mobile/src/flows/installations/runtimeModeTransport.ts \
  apps/mobile/src/flows/hardware-setup/shellyRequests.ts \
  apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts \
  apps/mobile/src/__tests__/hardware-setup.test.tsx \
  docs/implementation/device-rule-decoupling-progress.md
git commit -m 'Preserve runtime mode across BLE discovery'
git push origin HEAD:"$BRANCH"
test -z "$(git status --porcelain)"
echo RUNTIME_MODE_HEAD=$(git rev-parse HEAD)

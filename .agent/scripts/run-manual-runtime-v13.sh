#!/bin/sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-manual-runtime-v9.sh > /tmp/run-manual-runtime-v13-expanded.sh

cat > /tmp/manual-runtime-v13.py <<'PY'
from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count < 1:
        raise SystemExit(f"{path}: missing expected text: {old[:180]!r}")
    write(path, text.replace(old, new, 1))


# V11 compact-runtime fixes: keep the accepted 4500-byte budget without
# relaxing safety, and keep /diag telemetry-only.
p = Path('packages/script-generator/src/__tests__/manual-runtime.test.ts')
s = p.read_text()
s = s.replace(
    "keeps runtime control compact and uses diagnostics as the mode source of truth",
    "keeps runtime control compact and exposes mode through runtime state",
    1,
)
old = "    expect(script).toContain('md:0');\n    expect(script).toContain('md:R.m');\n"
new = "    expect(script).toContain('m:0');\n    expect(script).not.toContain('md:');\n"
if old not in s:
    raise SystemExit('v13 could not locate obsolete diagnostics-mode assertions')
p.write_text(s.replace(old, new, 1))

p = Path('packages/script-generator/src/shelly/generate.ts')
s = p.read_text()
old = 'function sw(o,rs,f){if(R.m)return;var n=nw(),ch=R.on!=o;if(o&&!f&&ch&&n-R.lc<C.c){R.rs="mc";return;}Shelly.call("Switch.Set",{id:C.i,on:o},function(r,e){if(R.m)return Shelly.call("Switch.Set",{id:C.i,on:false});if(e){R.rs="se";Shelly.call("Switch.Set",{id:C.i,on:false});R.on=false;return;}R.on=o;R.rs=rs;if(ch)R.lc=n;R.os=o?n:null;});}'
new = 'function s(o,c){Shelly.call("Switch.Set",{id:C.i,on:o},c)}\nfunction sw(o,q,f){if(R.m)return;var n=nw(),c=R.on!=o;if(o&&!f&&c&&n-R.lc<C.c){R.rs="mc";return;}s(o,function(r,e){if(R.m)return s(false);if(e){R.rs="se";s(false);R.on=false;return;}R.on=o;R.rs=q;if(c)R.lc=n;R.os=o?n:null;});}'
if s.count(old) != 1:
    raise SystemExit(f'v13 expected one MANUAL-safe sw(), found {s.count(old)}')
p.write_text(s.replace(old, new, 1))

# The canonical handoff lives on main and must not be replaced by the older
# continuation note carried by the baseline-era patch scripts.
import subprocess
subprocess.run(
    ['git', 'checkout', '377b7bf7a2bca37ab4371b42be82136c2b2aaf13', '--', 'docs/HANDOFF_NEXT_CHAT.md'],
    check=True,
)

# Fix the three stale UI/mock contracts from V11. MANUAL is a live supported
# runtime; diagnostics stay available and Script.Eval owns mode transitions.
dashboard_test = 'apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx'
replace_once(
    dashboard_test,
    '''  useInstalledAutomationDiagnostics: () => ({
    data: undefined,
    isError: true,''',
    '''  useInstalledAutomationDiagnostics: () => ({
    data: undefined,
    isError: false,''',
)
replace_once(
    dashboard_test,
    '''      automationMode: 'manual',
      automationScriptId: 7,''',
    '''      automationMode: 'manual',
      runtimeModeSupported: true,
      automationScriptId: 7,''',
)

detail_test = 'apps/mobile/src/__tests__/automation-detail.test.tsx'
replace_once(
    detail_test,
    '''  let scriptRunning = true;
  let relayOn = true;''',
    '''  let scriptRunning = true;
  let relayOn = true;
  let runtimeMode = 0;''',
)
replace_once(
    detail_test,
    '''      params?: { id?: number; on?: boolean };''',
    '''      params?: { id?: number; on?: boolean; code?: string };''',
)
replace_once(
    detail_test,
    '''      case 'Script.Stop':
        scriptRunning = false;''',
    '''      case 'Script.Eval': {
        const code = body.params?.code ?? '';
        if (code.includes('R.m=1')) {
          runtimeMode = 1;
        } else if (code.includes('R.m=0')) {
          runtimeMode = 0;
        }
        result = { result: String(runtimeMode) };
        break;
      }
      case 'Script.Stop':
        scriptRunning = false;''',
)
replace_once(
    detail_test,
    "    expect(rpcMethods).toContain('Script.Stop');\n",
    "    expect(rpcMethods).toContain('Script.Eval');\n    expect(rpcMethods).not.toContain('Script.Stop');\n    expect(screen.getByText('21.4°C')).toBeVisible();\n",
)
replace_once(
    detail_test,
    "    expect(rpcMethods).toContain('Script.Start');\n",
    "    expect(rpcMethods).not.toContain('Script.Start');\n    expect(screen.getByText('21.4°C')).toBeVisible();\n",
)

# RPC-only resource diagnostics. Keep these app-side so generated /diag and the
# thermostat byte/runtime budgets remain unchanged.
write(
    'apps/mobile/src/flows/hardware-setup/resourceDiagnostics.ts',
    '''import { RPC_METHODS } from '@lcl/shelly-client';
import { z } from 'zod';
import { createShellyTransport } from './shellyRequests.js';

const optionalMetric = z.number().nonnegative().nullable().optional();

const scriptResourceStatusSchema = z.object({
  running: z.boolean().nullable().optional(),
  mem_used: optionalMetric,
  mem_peak: optionalMetric,
  mem_free: optionalMetric,
  cpu: optionalMetric
});

const systemResourceStatusSchema = z.object({
  ram_size: optionalMetric,
  ram_free: optionalMetric
});

export type ShellyResourceDiagnostics = {
  script: {
    running: boolean | null;
    memUsedBytes: number | null;
    memPeakBytes: number | null;
    memFreeBytes: number | null;
    cpuPercent: number | null;
  } | null;
  system: {
    ramSizeBytes: number | null;
    ramFreeBytes: number | null;
  } | null;
};

const metricOrNull = (value: number | null | undefined): number | null => value ?? null;

const readPayload = async (
  transport: ReturnType<typeof createShellyTransport>,
  request: { method: string; params?: Record<string, unknown> }
): Promise<unknown | null> => {
  try {
    const result = await transport.call<unknown>(request);
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
};

export const readShellyResourceDiagnostics = async (
  baseUrl: string,
  scriptId: number
): Promise<ShellyResourceDiagnostics> => {
  const transport = createShellyTransport(baseUrl);
  const [scriptPayload, systemPayload] = await Promise.all([
    readPayload(transport, {
      method: RPC_METHODS.ScriptGetStatus,
      params: { id: scriptId }
    }),
    readPayload(transport, { method: 'Sys.GetStatus' })
  ]);

  const script = scriptResourceStatusSchema.safeParse(scriptPayload);
  const system = systemResourceStatusSchema.safeParse(systemPayload);

  return {
    script: script.success
      ? {
          running: script.data.running ?? null,
          memUsedBytes: metricOrNull(script.data.mem_used),
          memPeakBytes: metricOrNull(script.data.mem_peak),
          memFreeBytes: metricOrNull(script.data.mem_free),
          cpuPercent: metricOrNull(script.data.cpu)
        }
      : null,
    system: system.success
      ? {
          ramSizeBytes: metricOrNull(system.data.ram_size),
          ramFreeBytes: metricOrNull(system.data.ram_free)
        }
      : null
  };
};
''',
)

write(
    'apps/mobile/src/flows/hardware-setup/resourceDiagnostics.test.ts',
    '''import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ShellyRequestsModule from './shellyRequests.js';

const mocks = vi.hoisted(() => ({ call: vi.fn() }));

vi.mock('./shellyRequests.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyRequestsModule>();
  return {
    ...actual,
    createShellyTransport: vi.fn(() => ({ call: mocks.call }))
  };
});

import { readShellyResourceDiagnostics } from './resourceDiagnostics.js';

describe('Shelly resource diagnostics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads exact script resources and whole-device RAM directly over RPC', async () => {
    mocks.call.mockImplementation(({ method }: { method: string }) =>
      Promise.resolve(
        method === 'Script.GetStatus'
          ? {
              ok: true,
              value: {
                running: true,
                mem_used: 12_288,
                mem_peak: 16_384,
                mem_free: 25_116,
                cpu: 0.3
              }
            }
          : {
              ok: true,
              value: { ram_size: 259_128, ram_free: 96_180 }
            }
      )
    );

    await expect(
      readShellyResourceDiagnostics('http://192.168.0.20/', 7)
    ).resolves.toEqual({
      script: {
        running: true,
        memUsedBytes: 12_288,
        memPeakBytes: 16_384,
        memFreeBytes: 25_116,
        cpuPercent: 0.3
      },
      system: { ramSizeBytes: 259_128, ramFreeBytes: 96_180 }
    });

    expect(mocks.call).toHaveBeenCalledWith({
      method: 'Script.GetStatus',
      params: { id: 7 }
    });
    expect(mocks.call).toHaveBeenCalledWith({ method: 'Sys.GetStatus' });
  });

  it('keeps firmware-dependent script fields optional', async () => {
    mocks.call
      .mockResolvedValueOnce({
        ok: true,
        value: { running: false, mem_free: 25_116, cpu: 0 }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { ram_size: 259_128, ram_free: 96_180 }
      });

    const result = await readShellyResourceDiagnostics('http://192.168.0.20/', 1);

    expect(result.script).toEqual({
      running: false,
      memUsedBytes: null,
      memPeakBytes: null,
      memFreeBytes: 25_116,
      cpuPercent: 0
    });
  });

  it('preserves available device RAM when Script.GetStatus is unavailable', async () => {
    mocks.call
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: 'rpc-error', userMessageKey: 'errors.shellyInvalidResponse' }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { ram_size: 259_128, ram_free: 96_180 }
      });

    await expect(
      readShellyResourceDiagnostics('http://192.168.0.20/', 1)
    ).resolves.toEqual({
      script: null,
      system: { ramSizeBytes: 259_128, ramFreeBytes: 96_180 }
    });
  });
});
''',
)

# Join the resource RPC read to the existing manual diagnostics refresh. It is a
# separate mutation/state so resource failure cannot invalidate /diag telemetry.
flow = 'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts'
replace_once(
    flow,
    '''} from './shellyRequests.js';
import {''',
    '''} from './shellyRequests.js';
import {
  readShellyResourceDiagnostics,
  type ShellyResourceDiagnostics
} from './resourceDiagnostics.js';
import {''',
)
replace_once(
    flow,
    '''  const [diagnosticSnapshot, setDiagnosticSnapshot] =
    useState<HardwareDiagnosticSnapshot | null>(null);
  const [diagnosticFetchedAtMs, setDiagnosticFetchedAtMs] = useState<number | null>(null);''',
    '''  const [diagnosticSnapshot, setDiagnosticSnapshot] =
    useState<HardwareDiagnosticSnapshot | null>(null);
  const [diagnosticResources, setDiagnosticResources] =
    useState<ShellyResourceDiagnostics | null>(null);
  const [diagnosticFetchedAtMs, setDiagnosticFetchedAtMs] = useState<number | null>(null);''',
)
replace_once(
    flow,
    '''  const clearDiagnosticSnapshot = () => {
    setDiagnosticSnapshot(null);
    setDiagnosticFetchedAtMs(null);
  };''',
    '''  const clearDiagnosticSnapshot = () => {
    setDiagnosticSnapshot(null);
    setDiagnosticResources(null);
    setDiagnosticFetchedAtMs(null);
  };''',
)
replace_once(
    flow,
    '''  const diagnosticMutation = useMutation({
    mutationFn: fetchDiagnostics,
    onSuccess: (snapshot) => {
      setDiagnosticSnapshot(snapshot);
      setDiagnosticFetchedAtMs(Date.now());
    }
  });

  const installMutation = useMutation({''',
    '''  const diagnosticMutation = useMutation({
    mutationFn: fetchDiagnostics,
    onSuccess: (snapshot) => {
      setDiagnosticSnapshot(snapshot);
      setDiagnosticFetchedAtMs(Date.now());
    }
  });

  const diagnosticResourceMutation = useMutation({
    mutationFn: async (
      scriptId = Math.trunc(toNumberOrFallback(diagnosticShelly?.scriptIdInput ?? '1', 1))
    ): Promise<ShellyResourceDiagnostics> => {
      if (!diagnosticShelly) {
        throw new Error(t('hardware.flow.noSelectedDiagnosticShelly'));
      }
      return readShellyResourceDiagnostics(diagnosticShelly.baseUrl, scriptId);
    },
    onSuccess: (resources) => setDiagnosticResources(resources)
  });

  const refreshDiagnostics = (scriptId?: number) => {
    diagnosticMutation.mutate(scriptId);
    diagnosticResourceMutation.mutate(scriptId);
  };

  const installMutation = useMutation({''',
)
replace_once(
    flow,
    '''      diagnosticMutation.mutate(install.scriptId);''',
    '''      refreshDiagnostics(install.scriptId);''',
)
replace_once(
    flow,
    '''    diagnosticSnapshot,
    diagnosticFetchedAtMs,''',
    '''    diagnosticSnapshot,
    diagnosticResources,
    diagnosticFetchedAtMs,''',
)
replace_once(
    flow,
    '''    safeRelayTestMutation,
    diagnosticMutation
  };''',
    '''    safeRelayTestMutation,
    diagnosticMutation,
    diagnosticResourceMutation,
    refreshDiagnostics
  };''',
)

# Present the resource values inside the existing Runtime and Shelly groups.
page = 'apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx'
replace_once(
    page,
    '''const formatEnergy = (value: number | null | undefined, missingLabel: string): string => {
  if (value == null) {
    return missingLabel;
  }
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kWh` : `${value.toFixed(0)} Wh`;
};''',
    '''const formatEnergy = (value: number | null | undefined, missingLabel: string): string => {
  if (value == null) {
    return missingLabel;
  }
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kWh` : `${value.toFixed(0)} Wh`;
};

const formatBytes = (value: number | null | undefined, missingLabel: string): string => {
  if (value == null) {
    return missingLabel;
  }
  return value < 1024 ? `${Math.round(value)} B` : `${(value / 1024).toFixed(1)} KiB`;
};''',
)
replace_once(
    page,
    '''  const diagnostics = flow.diagnosticSnapshot?.diagnostics;
  const shellyTime = flow.diagnosticSnapshot?.time;''',
    '''  const diagnostics = flow.diagnosticSnapshot?.diagnostics;
  const resources = flow.diagnosticResources;
  const shellyTime = flow.diagnosticSnapshot?.time;''',
)
replace_once(
    page,
    '''          aria-busy={flow.diagnosticMutation.isPending || undefined}
          disabled={flow.diagnosticShelly === null || flow.diagnosticMutation.isPending}
          title={t('hardware.diagnostics.actionRefreshTitle')}
          onClick={() => flow.diagnosticMutation.mutate(undefined)}
        >
          {flow.diagnosticMutation.isPending''',
    '''          aria-busy={
            flow.diagnosticMutation.isPending ||
            flow.diagnosticResourceMutation.isPending ||
            undefined
          }
          disabled={
            flow.diagnosticShelly === null ||
            flow.diagnosticMutation.isPending ||
            flow.diagnosticResourceMutation.isPending
          }
          title={t('hardware.diagnostics.actionRefreshTitle')}
          onClick={() => flow.refreshDiagnostics()}
        >
          {flow.diagnosticMutation.isPending || flow.diagnosticResourceMutation.isPending''',
)
replace_once(
    page,
    '''            <DiagnosticRow
              label={t('hardware.metrics.configHash')}
              value={script?.configHash ?? t('common.missing')}
            />''',
    '''            <DiagnosticRow
              label={t('hardware.metrics.configHash')}
              value={script?.configHash ?? t('common.missing')}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptRpcState')}
              value={
                resources?.script?.running === true
                  ? 'RUNNING'
                  : resources?.script?.running === false
                    ? 'STOPPED'
                    : t('common.missing')
              }
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptMemUsed')}
              value={formatBytes(resources?.script?.memUsedBytes, t('common.missing'))}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptMemPeak')}
              value={formatBytes(resources?.script?.memPeakBytes, t('common.missing'))}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptMemFree')}
              value={formatBytes(resources?.script?.memFreeBytes, t('common.missing'))}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptCpu')}
              value={formatDiagnosticNumber(resources?.script?.cpuPercent, '%', 1)}
            />''',
)
replace_once(
    page,
    '''            <DiagnosticRow
              label={t('hardware.metrics.plugTemperature')}
              value={formatDiagnosticNumber(plug?.deviceTemperatureC, '°C')}
            />''',
    '''            <DiagnosticRow
              label={t('hardware.metrics.plugTemperature')}
              value={formatDiagnosticNumber(plug?.deviceTemperatureC, '°C')}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.deviceRamFree')}
              value={formatBytes(resources?.system?.ramFreeBytes, t('common.missing'))}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.deviceRamTotal')}
              value={formatBytes(resources?.system?.ramSizeBytes, t('common.missing'))}
            />''',
)

translations = {
    'pl.ts': [
        "      scriptRpcState: 'Stan skryptu RPC',",
        "      scriptMemUsed: 'JS użyte teraz',",
        "      scriptMemPeak: 'JS peak',",
        "      scriptMemFree: 'JS wolne',",
        "      scriptCpu: 'CPU skryptu',",
        "      deviceRamFree: 'RAM Shelly wolny',",
        "      deviceRamTotal: 'RAM Shelly razem',",
    ],
    'en.ts': [
        "      scriptRpcState: 'RPC script state',",
        "      scriptMemUsed: 'JS used now',",
        "      scriptMemPeak: 'JS peak',",
        "      scriptMemFree: 'JS free',",
        "      scriptCpu: 'Script CPU',",
        "      deviceRamFree: 'Shelly RAM free',",
        "      deviceRamTotal: 'Shelly RAM total',",
    ],
    'de.ts': [
        "      scriptRpcState: 'RPC-Skriptstatus',",
        "      scriptMemUsed: 'JS aktuell',",
        "      scriptMemPeak: 'JS Spitze',",
        "      scriptMemFree: 'JS frei',",
        "      scriptCpu: 'Skript-CPU',",
        "      deviceRamFree: 'Shelly-RAM frei',",
        "      deviceRamTotal: 'Shelly-RAM gesamt',",
    ],
    'es.ts': [
        "      scriptRpcState: 'Estado RPC del script',",
        "      scriptMemUsed: 'JS usado ahora',",
        "      scriptMemPeak: 'Pico de JS',",
        "      scriptMemFree: 'JS libre',",
        "      scriptCpu: 'CPU del script',",
        "      deviceRamFree: 'RAM Shelly libre',",
        "      deviceRamTotal: 'RAM Shelly total',",
    ],
    'fr.ts': [
        "      scriptRpcState: 'État RPC du script',",
        "      scriptMemUsed: 'JS utilisé',",
        "      scriptMemPeak: 'Pic JS',",
        "      scriptMemFree: 'JS libre',",
        "      scriptCpu: 'CPU du script',",
        "      deviceRamFree: 'RAM Shelly libre',",
        "      deviceRamTotal: 'RAM Shelly totale',",
    ],
    'it.ts': [
        "      scriptRpcState: 'Stato RPC script',",
        "      scriptMemUsed: 'JS usata ora',",
        "      scriptMemPeak: 'Picco JS',",
        "      scriptMemFree: 'JS libera',",
        "      scriptCpu: 'CPU script',",
        "      deviceRamFree: 'RAM Shelly libera',",
        "      deviceRamTotal: 'RAM Shelly totale',",
    ],
    'ptBr.ts': [
        "      scriptRpcState: 'Estado RPC do script',",
        "      scriptMemUsed: 'JS usada agora',",
        "      scriptMemPeak: 'Pico de JS',",
        "      scriptMemFree: 'JS livre',",
        "      scriptCpu: 'CPU do script',",
        "      deviceRamFree: 'RAM Shelly livre',",
        "      deviceRamTotal: 'RAM Shelly total',",
    ],
}
for filename, lines in translations.items():
    path = Path('apps/mobile/src/app/locales') / filename
    text = path.read_text()
    marker = 'groupRuntimeHint:'
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f'{path}: missing {marker}')
    end = text.find(',\n', start)
    if end < 0:
        raise SystemExit(f'{path}: could not find end of groupRuntimeHint')
    insert_at = end + 2
    block = '\n'.join(lines) + '\n'
    path.write_text(text[:insert_at] + block + text[insert_at:])

# Extend the existing diagnostics integration fixture with realistic direct-RPC
# resource values and assert they render in the existing groups.
hardware_test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
replace_once(
    hardware_test,
    '''          case 'Script.GetStatus':
            return rpcResult({
              id: 4,
              running: true,
              mem_used: 12,
              mem_free: 34
            });
          default:''',
    '''          case 'Script.GetStatus':
            return rpcResult({
              id: 4,
              running: true,
              mem_used: 12_288,
              mem_peak: 16_384,
              mem_free: 25_116,
              cpu: 0.3
            });
          case 'Sys.GetStatus':
            return rpcResult({ ram_size: 259_128, ram_free: 96_180 });
          default:''',
)
replace_once(
    hardware_test,
    "    await waitFor(() => expect(screen.getAllByText('69.6%')).toHaveLength(2));\n",
    "    await waitFor(() => expect(screen.getAllByText('69.6%')).toHaveLength(2));\n    expect(screen.getByText('Stan skryptu RPC').closest('.lcl-diagnostic-row')).toHaveTextContent('RUNNING');\n    expect(screen.getByText('JS użyte teraz').closest('.lcl-diagnostic-row')).toHaveTextContent('12.0 KiB');\n    expect(screen.getByText('JS peak').closest('.lcl-diagnostic-row')).toHaveTextContent('16.0 KiB');\n    expect(screen.getByText('JS wolne').closest('.lcl-diagnostic-row')).toHaveTextContent('24.5 KiB');\n    expect(screen.getByText('CPU skryptu').closest('.lcl-diagnostic-row')).toHaveTextContent('0.3%');\n    expect(screen.getByText('RAM Shelly wolny').closest('.lcl-diagnostic-row')).toHaveTextContent('93.9 KiB');\n    expect(screen.getByText('RAM Shelly razem').closest('.lcl-diagnostic-row')).toHaveTextContent('253.1 KiB');\n",
)

# Architecture documentation: resource telemetry is direct RPC and never part of
# the generated thermostat /diag payload.
docs = Path('docs/architecture/runtime-control.md')
text = docs.read_text()
if '### Resource diagnostics' not in text:
    text += '''\n\n### Resource diagnostics\n\nThe phone reads `Script.GetStatus` for the exact managed script id and `Sys.GetStatus` directly over Shelly RPC during the normal diagnostics refresh. Script `running`, `mem_used`, `mem_peak`, `mem_free`, optional CPU, and device `ram_size` / `ram_free` therefore add no code or state to the generated thermostat runtime. `/diag` remains telemetry-only. Resource parsing is best-effort and independent from climate telemetry, so missing firmware-dependent fields or a failed resource RPC do not disable otherwise-valid diagnostics or control.\n'''
    docs.write_text(text)
PY

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-manual-runtime-v13-expanded.sh')
s = p.read_text()
needle = "pnpm exec prettier --write \\\n"
if needle not in s:
    raise SystemExit('v13 could not locate prettier stage')
s = s.replace(needle, 'python3 /tmp/manual-runtime-v13.py\n\n' + needle, 1)

# Format all newly touched files in addition to the V9/V11 list.
s = s.replace(
    '  apps/mobile/src/flows/installations/relaySafety.ts \\\n',
    '  apps/mobile/src/flows/installations/relaySafety.ts \\\n  apps/mobile/src/flows/hardware-setup/resourceDiagnostics.ts \\\n  apps/mobile/src/flows/hardware-setup/resourceDiagnostics.test.ts \\\n  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts \\\n  apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx \\\n  apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx \\\n  apps/mobile/src/__tests__/automation-detail.test.tsx \\\n  apps/mobile/src/__tests__/hardware-setup.test.tsx \\\n  apps/mobile/src/app/locales/pl.ts \\\n  apps/mobile/src/app/locales/en.ts \\\n  apps/mobile/src/app/locales/de.ts \\\n  apps/mobile/src/app/locales/es.ts \\\n  apps/mobile/src/app/locales/fr.ts \\\n  apps/mobile/src/app/locales/it.ts \\\n  apps/mobile/src/app/locales/ptBr.ts \\\n',
    1,
)

# Extend the targeted mobile gate with the new reader and screen integration.
s = s.replace(
    '  src/flows/installations/runtimeDiagnostics.test.ts \\\n',
    '  src/flows/installations/runtimeDiagnostics.test.ts \\\n  src/flows/hardware-setup/resourceDiagnostics.test.ts \\\n',
    1,
)
s = s.replace(
    '  src/__tests__/automation-detail.test.tsx\n',
    '  src/__tests__/automation-detail.test.tsx \\\n  src/__tests__/hardware-setup.test.tsx\n',
    1,
)

# Full validation before commit/push; the resulting commit contains exactly the
# already-validated working tree.
anchor = 'git diff --check\ngit status --short\ngit add -A\n'
if anchor not in s:
    raise SystemExit('v13 could not locate final commit gate')
full_gate = '''pnpm --filter @lcl/script-generator test
pnpm --filter @lcl/mobile test
pnpm --filter @lcl/mobile lint
pnpm --filter @lcl/mobile typecheck
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build
pnpm --filter @lcl/mobile exec playwright test

python3 - <<'PY_AUDIT'
from pathlib import Path
for path in [
    'apps/mobile/src/flows/installations/runtimeModeTransport.ts',
    'apps/mobile/src/flows/installations/runtimeStatus.ts',
    'apps/mobile/src/flows/installations/runtimeControl.ts',
]:
    text = Path(path).read_text()
    for forbidden in ('Script.Stop', 'Script.Start', '.stopScript(', '.startScript('):
        if forbidden in text:
            raise SystemExit(f'{path}: normal AUTO/MANUAL path contains forbidden {forbidden}')
text = Path('apps/mobile/src/flows/hardware-setup/schemas.ts').read_text()
if 'mem_used' in text or 'mem_peak' in text or 'mem_free' in text:
    raise SystemExit('generated /diag schema was polluted with resource metrics')
PY_AUDIT

git diff --check
git status --short
git add -A
'''
s = s.replace(anchor, full_gate, 1)
s = s.replace(
    'git commit -m "feat(climate): keep telemetry live in manual mode"',
    'git commit -m "feat(climate): keep manual telemetry live and expose resources"',
    1,
)
s = s.replace('MANUAL_RUNTIME_V9_SHA=', 'MANUAL_RUNTIME_V13_SHA=', 1)
p.write_text(s)
PY

sh /tmp/run-manual-runtime-v13-expanded.sh

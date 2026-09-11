#!/bin/sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-manual-runtime-v11.sh > /tmp/run-manual-runtime-v12-driver.sh

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-manual-runtime-v12-driver.sh')
s = p.read_text()
old = 'sh /tmp/run-manual-runtime-v11-expanded.sh\n'
if old not in s:
    raise SystemExit('v12 could not locate v11 expanded runner execution')

new = r'''python3 - <<'PY3'
from pathlib import Path
p = Path('/tmp/run-manual-runtime-v11-expanded.sh')
s = p.read_text()
needle = "pnpm exec prettier --write \\\n"
if needle not in s:
    raise SystemExit('v12 could not locate prettier stage')

patch = r'''python3 - <<'PY4'
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


# Dashboard MANUAL now keeps diagnostics live. The old control test deliberately
# mocked diagnostics as failed because MANUAL used to stop the script.
replace_once(
    'apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx',
    '''  useInstalledAutomationDiagnostics: () => ({
    data: undefined,
    isError: true,''',
    '''  useInstalledAutomationDiagnostics: () => ({
    data: undefined,
    isError: false,''',
)

# Detail screen fixture: model Script.Eval state in the still-running managed
# runtime. Normal AUTO/MANUAL transitions must not call Script.Stop/Start.
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
        if (code.includes('R.m=1')) runtimeMode = 1;
        else if (code.includes('R.m=0')) runtimeMode = 0;
        result = { result: String(runtimeMode) };
        break;
      }
      case 'Script.Stop':
        scriptRunning = false;''',
)
replace_once(
    detail_test,
    "    expect(rpcMethods).toContain('Script.Stop');\n",
    "    expect(rpcMethods).toContain('Script.Eval');\n    expect(rpcMethods).not.toContain('Script.Stop');\n",
)
replace_once(
    detail_test,
    "    expect(rpcMethods).toContain('Script.Start');\n",
    "    expect(rpcMethods).not.toContain('Script.Start');\n",
)

# RPC-only resource diagnostics. This intentionally stays outside generated
# Shelly code, so it costs zero bytes and zero runtime state in the thermostat.
write(
    'apps/mobile/src/flows/hardware-setup/resourceDiagnostics.ts',
    '''import { z } from 'zod';
import { createShellyTransport, unwrapShellyResult } from './shellyRequests.js';

const optionalResourceMetric = z.number().nonnegative().nullable().optional();

const scriptResourceStatusSchema = z.object({
  running: z.boolean().optional(),
  mem_used: optionalResourceMetric,
  mem_peak: optionalResourceMetric,
  mem_free: optionalResourceMetric,
  cpu: optionalResourceMetric
});

const systemResourceStatusSchema = z.object({
  ram_size: optionalResourceMetric,
  ram_free: optionalResourceMetric
});

export type ShellyResourceDiagnostics = {
  script: {
    running: boolean | null;
    memUsedBytes: number | null;
    memPeakBytes: number | null;
    memFreeBytes: number | null;
    cpuPercent: number | null;
  };
  system: {
    ramSizeBytes: number | null;
    ramFreeBytes: number | null;
  };
};

const metricOrNull = (value: number | null | undefined): number | null => value ?? null;

export const readShellyResourceDiagnostics = async (
  baseUrl: string,
  scriptId: number
): Promise<ShellyResourceDiagnostics> => {
  const transport = createShellyTransport(baseUrl);
  const [scriptResult, systemResult] = await Promise.all([
    transport.call<unknown>({
      method: 'Script.GetStatus',
      params: { id: scriptId }
    }),
    transport.call<unknown>({ method: 'Sys.GetStatus' })
  ]);

  const script = scriptResourceStatusSchema.parse(unwrapShellyResult(scriptResult));
  const system = systemResourceStatusSchema.parse(unwrapShellyResult(systemResult));

  return {
    script: {
      running: script.running ?? null,
      memUsedBytes: metricOrNull(script.mem_used),
      memPeakBytes: metricOrNull(script.mem_peak),
      memFreeBytes: metricOrNull(script.mem_free),
      cpuPercent: metricOrNull(script.cpu)
    },
    system: {
      ramSizeBytes: metricOrNull(system.ram_size),
      ramFreeBytes: metricOrNull(system.ram_free)
    }
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

  it('reads Script.GetStatus and Sys.GetStatus without another Shelly script', async () => {
    mocks.call.mockImplementation(({ method }: { method: string }) =>
      Promise.resolve(
        method === 'Script.GetStatus'
          ? {
              ok: true,
              value: {
                running: true,
                mem_used: 18_432,
                mem_peak: 24_576,
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
        memUsedBytes: 18_432,
        memPeakBytes: 24_576,
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

  it('keeps optional per-script metrics null when Shelly omits them for a stopped script', async () => {
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
});
''',
)

# Keep resource reads independent from /diag so stopped/crashed legacy runtimes
# can still report shared JS free memory and device RAM.
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
    '''  useEffect(() => {
    if (flow.diagnosticFetchedAtMs === null) {''',
    '''  useEffect(() => {
    if (!flow.diagnosticResourceMutation.isError) {
      return;
    }

    pushToast(
      'warning',
      mutationError(flow.diagnosticResourceMutation.error),
      t('common.operationFailed')
    );
    flow.diagnosticResourceMutation.reset();
  }, [flow.diagnosticResourceMutation, pushToast, t]);

  useEffect(() => {
    if (flow.diagnosticFetchedAtMs === null) {''',
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
    '''      )}
      <ToastViewport''',
    '''      )}

      {resources && (
        <div className="diagnostic-groups">
          <DiagnosticGroup
            title={t('hardware.diagnostics.groupResources')}
            description={t('hardware.diagnostics.groupResourcesHint')}
          >
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptMemUsed')}
              value={formatBytes(resources.script.memUsedBytes, t('common.missing'))}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptMemPeak')}
              value={formatBytes(resources.script.memPeakBytes, t('common.missing'))}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptMemFree')}
              value={formatBytes(resources.script.memFreeBytes, t('common.missing'))}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptCpu')}
              value={formatDiagnosticNumber(resources.script.cpuPercent, '%', 1)}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.deviceRamFree')}
              value={formatBytes(resources.system.ramFreeBytes, t('common.missing'))}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.deviceRamTotal')}
              value={formatBytes(resources.system.ramSizeBytes, t('common.missing'))}
            />
          </DiagnosticGroup>
        </div>
      )}
      <ToastViewport''',
)

# Add the same translation key shape to every supported locale. Technical
# mem_* concepts stay recognizable while surrounding copy is localized.
translations = {
    'pl.ts': [
        "      groupResources: 'Zasoby runtime',",
        "      groupResourcesHint: 'Pamięć JS skryptu i RAM Shelly odczytane bezpośrednio przez RPC.',",
        "      scriptMemUsed: 'JS użyte teraz',",
        "      scriptMemPeak: 'JS peak',",
        "      scriptMemFree: 'JS wolne',",
        "      scriptCpu: 'CPU skryptu',",
        "      deviceRamFree: 'RAM Shelly wolny',",
        "      deviceRamTotal: 'RAM Shelly razem',",
    ],
    'en.ts': [
        "      groupResources: 'Runtime resources',",
        "      groupResourcesHint: 'Script JS memory and Shelly RAM read directly over RPC.',",
        "      scriptMemUsed: 'JS used now',",
        "      scriptMemPeak: 'JS peak',",
        "      scriptMemFree: 'JS free',",
        "      scriptCpu: 'Script CPU',",
        "      deviceRamFree: 'Shelly RAM free',",
        "      deviceRamTotal: 'Shelly RAM total',",
    ],
    'de.ts': [
        "      groupResources: 'Runtime-Ressourcen',",
        "      groupResourcesHint: 'JS-Speicher des Skripts und Shelly-RAM direkt per RPC.',",
        "      scriptMemUsed: 'JS aktuell',",
        "      scriptMemPeak: 'JS Spitze',",
        "      scriptMemFree: 'JS frei',",
        "      scriptCpu: 'Skript-CPU',",
        "      deviceRamFree: 'Shelly-RAM frei',",
        "      deviceRamTotal: 'Shelly-RAM gesamt',",
    ],
    'es.ts': [
        "      groupResources: 'Recursos de runtime',",
        "      groupResourcesHint: 'Memoria JS del script y RAM de Shelly leídas directamente por RPC.',",
        "      scriptMemUsed: 'JS usado ahora',",
        "      scriptMemPeak: 'Pico de JS',",
        "      scriptMemFree: 'JS libre',",
        "      scriptCpu: 'CPU del script',",
        "      deviceRamFree: 'RAM Shelly libre',",
        "      deviceRamTotal: 'RAM Shelly total',",
    ],
    'fr.ts': [
        "      groupResources: 'Ressources runtime',",
        "      groupResourcesHint: 'Mémoire JS du script et RAM Shelly lues directement par RPC.',",
        "      scriptMemUsed: 'JS utilisé',",
        "      scriptMemPeak: 'Pic JS',",
        "      scriptMemFree: 'JS libre',",
        "      scriptCpu: 'CPU du script',",
        "      deviceRamFree: 'RAM Shelly libre',",
        "      deviceRamTotal: 'RAM Shelly totale',",
    ],
    'it.ts': [
        "      groupResources: 'Risorse runtime',",
        "      groupResourcesHint: 'Memoria JS dello script e RAM Shelly lette direttamente via RPC.',",
        "      scriptMemUsed: 'JS usata ora',",
        "      scriptMemPeak: 'Picco JS',",
        "      scriptMemFree: 'JS libera',",
        "      scriptCpu: 'CPU script',",
        "      deviceRamFree: 'RAM Shelly libera',",
        "      deviceRamTotal: 'RAM Shelly totale',",
    ],
    'ptBr.ts': [
        "      groupResources: 'Recursos de runtime',",
        "      groupResourcesHint: 'Memória JS do script e RAM do Shelly lidas diretamente por RPC.',",
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

# Document that resource diagnostics are app-side RPC and do not consume the
# generated runtime byte budget.
docs = Path('docs/architecture/runtime-control.md')
text = docs.read_text()
if '### Resource diagnostics' not in text:
    text += '''\n\n### Resource diagnostics\n\nThe phone reads `Script.GetStatus` for the exact managed script and `Sys.GetStatus` directly over Shelly RPC. `mem_used`, `mem_peak`, `mem_free`, script CPU, and device RAM therefore add no code or state to the generated thermostat runtime. Resource reads are independent from `/diag`, so shared JS free memory and device RAM remain inspectable even when a legacy or failed script is stopped.\n'''
    docs.write_text(text)
PY4

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/resourceDiagnostics.ts \
  apps/mobile/src/flows/hardware-setup/resourceDiagnostics.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts \
  apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx \
  apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx \
  apps/mobile/src/__tests__/automation-detail.test.tsx \
  apps/mobile/src/app/locales/pl.ts \
  apps/mobile/src/app/locales/en.ts \
  apps/mobile/src/app/locales/de.ts \
  apps/mobile/src/app/locales/es.ts \
  apps/mobile/src/app/locales/fr.ts \
  apps/mobile/src/app/locales/it.ts \
  apps/mobile/src/app/locales/ptBr.ts \
  docs/architecture/runtime-control.md

'''
s = s.replace(needle, patch + needle, 1)

# Extend targeted mobile verification to the new RPC reader and diagnostics UI.
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

# Run the complete mobile suite after targeted tests before committing.
anchor = 'pnpm --filter @lcl/script-generator typecheck\n'
if anchor not in s:
    raise SystemExit('v12 could not locate typecheck stage')
s = s.replace(anchor, 'pnpm --filter @lcl/mobile test\n\n' + anchor, 1)
s = s.replace(
    'git commit -m "feat(climate): keep telemetry live in manual mode"',
    'git commit -m "feat(climate): keep manual telemetry live and expose resources"',
    1,
)
s = s.replace('MANUAL_RUNTIME_V11_SHA=', 'MANUAL_RUNTIME_V12_SHA=', 1)
p.write_text(s)
PY3
sh /tmp/run-manual-runtime-v11-expanded.sh
'''

p.write_text(s.replace(old, new, 1))
PY

sh /tmp/run-manual-runtime-v12-driver.sh

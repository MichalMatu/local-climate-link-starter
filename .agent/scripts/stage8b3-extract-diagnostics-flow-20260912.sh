#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='464f6b59a412b4f738b8b6c275123d739e586173'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

cat > apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts <<'EOF'
import { useMutation } from '@tanstack/react-query';
import { RPC_METHODS, scriptStatusSchema } from '@lcl/shelly-client';
import { useState } from 'react';
import { t } from '../../app/i18n.js';
import {
  readShellyResourceDiagnostics,
  type ShellyResourceDiagnostics
} from './resourceDiagnostics.js';
import {
  diagnosticSnapshotSchema,
  type HardwareDiagnosticSnapshot
} from './schemas.js';
import {
  createShellyTransport,
  fetchShellyJson,
  unwrapShellyResult
} from './shellyRequests.js';
import type { ShellyDraftDevice } from './setupDraftStore.js';
import { toNumberOrFallback } from './validation.js';

export const resolveScriptDiagnosticStatusMessage = (payload: unknown): string | null => {
  const parsed = scriptStatusSchema.safeParse(payload);
  if (
    !parsed.success ||
    parsed.data.running === true ||
    (parsed.data.running === undefined &&
      parsed.data.error === undefined &&
      parsed.data.errors === undefined)
  ) {
    return null;
  }

  const status = parsed.data.errors?.map(String).join(', ') || 'stopped';
  return status.includes('out_of_memory')
    ? t('hardware.diagnostics.scriptOutOfMemory')
    : t('hardware.diagnostics.scriptNotRunning', { status });
};

const diagnosticScriptStatusMessage = async (
  baseUrl: string,
  scriptId: number
): Promise<string | null> => {
  const response = await createShellyTransport(baseUrl).call<unknown>({
    method: RPC_METHODS.ScriptGetStatus,
    params: { id: scriptId }
  });
  if (!response.ok) {
    return null;
  }

  return resolveScriptDiagnosticStatusMessage(unwrapShellyResult(response));
};

export const useHardwareDiagnosticsFlow = (diagnosticShelly: ShellyDraftDevice | null) => {
  const [diagnosticSnapshot, setDiagnosticSnapshot] =
    useState<HardwareDiagnosticSnapshot | null>(null);
  const [diagnosticResources, setDiagnosticResources] =
    useState<ShellyResourceDiagnostics | null>(null);
  const [diagnosticFetchedAtMs, setDiagnosticFetchedAtMs] = useState<number | null>(null);

  const clearDiagnosticSnapshot = () => {
    setDiagnosticSnapshot(null);
    setDiagnosticResources(null);
    setDiagnosticFetchedAtMs(null);
  };

  const defaultScriptId = () =>
    Math.trunc(toNumberOrFallback(diagnosticShelly?.scriptIdInput ?? '1', 1));

  const fetchDiagnostics = async (
    scriptId = defaultScriptId()
  ): Promise<HardwareDiagnosticSnapshot> => {
    if (!diagnosticShelly) {
      throw new Error(t('hardware.flow.noSelectedDiagnosticShelly'));
    }
    const endpoint = new URL(`/script/${scriptId}/diag`, diagnosticShelly.baseUrl);
    try {
      const payload = await fetchShellyJson(endpoint, 5000);
      const parsed = diagnosticSnapshotSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.message);
      }
      return parsed.data;
    } catch {
      const scriptStatusMessage = await diagnosticScriptStatusMessage(
        diagnosticShelly.baseUrl,
        scriptId
      ).catch(() => null);
      throw new Error(scriptStatusMessage ?? t('hardware.diagnostics.readFailed'));
    }
  };

  const diagnosticMutation = useMutation({
    mutationFn: fetchDiagnostics,
    onSuccess: (snapshot) => {
      setDiagnosticSnapshot(snapshot);
      setDiagnosticFetchedAtMs(Date.now());
    }
  });

  const diagnosticResourceMutation = useMutation<
    ShellyResourceDiagnostics,
    Error,
    number | undefined
  >({
    mutationFn: async (scriptId = defaultScriptId()): Promise<ShellyResourceDiagnostics> => {
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

  return {
    diagnosticSnapshot,
    diagnosticResources,
    diagnosticFetchedAtMs,
    clearDiagnosticSnapshot,
    diagnosticMutation,
    diagnosticResourceMutation,
    refreshDiagnostics
  };
};
EOF

cat > apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import { t } from '../../app/i18n.js';
import { resolveScriptDiagnosticStatusMessage } from './useHardwareDiagnosticsFlow.js';

describe('hardware diagnostics status derivation', () => {
  it('does not report a diagnostic failure for a running script', () => {
    expect(resolveScriptDiagnosticStatusMessage({ running: true })).toBeNull();
  });

  it('maps out-of-memory failures to the dedicated diagnostic message', () => {
    expect(
      resolveScriptDiagnosticStatusMessage({ running: false, errors: ['out_of_memory'] })
    ).toBe(t('hardware.diagnostics.scriptOutOfMemory'));
  });

  it('maps other stopped script failures to the generic stopped diagnostic message', () => {
    expect(
      resolveScriptDiagnosticStatusMessage({ running: false, errors: ['runtime_failure'] })
    ).toBe(
      t('hardware.diagnostics.scriptNotRunning', {
        status: 'runtime_failure'
      })
    );
  });
});
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s = p.read_text()

s = s.replace(
"""  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RPC_METHODS,
  RpcShellyClient,
  RpcShellyScheduleClient,
  scriptStatusSchema,
""",
"""  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RpcShellyClient,
  RpcShellyScheduleClient,
""",
1)

s = s.replace(
"""import {
  diagnosticSnapshotSchema,
  type HardwareDiagnosticSnapshot,
  type HardwareSetupStatus
} from './schemas.js';""",
"import type { HardwareSetupStatus } from './schemas.js';",
1)

s = s.replace(
"""  cleanupStaleShellyBleDiscoveryScripts,
  createShellyTransport,
  deleteShellyAutomationScript,
  fetchShellyJson,
  readShellyAutomationScriptState,
""",
"""  cleanupStaleShellyBleDiscoveryScripts,
  createShellyTransport,
  deleteShellyAutomationScript,
  readShellyAutomationScriptState,
""",
1)

s = s.replace(
"""import {
  readShellyResourceDiagnostics,
  type ShellyResourceDiagnostics
} from './resourceDiagnostics.js';
""",
'',
1)

s = s.replace("import { toNumberOrFallback } from './validation.js';\n", '', 1)

anchor = "import { usePhoneSensorFlow } from './usePhoneSensorFlow.js';\n"
assert anchor in s
s = s.replace(
    anchor,
    "import { useHardwareDiagnosticsFlow } from './useHardwareDiagnosticsFlow.js';\n" + anchor,
    1,
)

helper_start = s.index("const diagnosticScriptStatusMessage = async (")
helper_end = s.index("export const useHardwareSetupFlow = () => {", helper_start)
s = s[:helper_start] + s[helper_end:]

state_block = """  const [diagnosticSnapshot, setDiagnosticSnapshot] =
    useState<HardwareDiagnosticSnapshot | null>(null);
  const [diagnosticResources, setDiagnosticResources] =
    useState<ShellyResourceDiagnostics | null>(null);
  const [diagnosticFetchedAtMs, setDiagnosticFetchedAtMs] = useState<number | null>(null);
"""
assert state_block in s
s = s.replace(state_block, '', 1)

clear_block = """  const clearDiagnosticSnapshot = () => {
    setDiagnosticSnapshot(null);
    setDiagnosticResources(null);
    setDiagnosticFetchedAtMs(null);
  };

"""
assert clear_block in s
s = s.replace(clear_block, '', 1)

diag_memo = """  const diagnosticShelly = useMemo(
    () => shellyDevices.find((device) => device.id === diagnosticShellyId) ?? null,
    [diagnosticShellyId, shellyDevices]
  );
"""
assert diag_memo in s
diag_hook = diag_memo + """  const {
    diagnosticSnapshot,
    diagnosticResources,
    diagnosticFetchedAtMs,
    clearDiagnosticSnapshot,
    diagnosticMutation,
    diagnosticResourceMutation,
    refreshDiagnostics
  } = useHardwareDiagnosticsFlow(diagnosticShelly);
"""
s = s.replace(diag_memo, diag_hook, 1)

fetch_start = s.index("  const fetchDiagnostics = async (")
refresh_marker = """  const refreshDiagnostics = (scriptId?: number) => {
    diagnosticMutation.mutate(scriptId);
    diagnosticResourceMutation.mutate(scriptId);
  };

"""
fetch_end = s.index(refresh_marker, fetch_start) + len(refresh_marker)
s = s[:fetch_start] + s[fetch_end:]

p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts

pnpm --dir apps/mobile exec vitest run src/flows/hardware-setup/useHardwareDiagnosticsFlow.test.ts
pnpm check
LCL_E2E_PORT=5199 pnpm e2e:responsive

git diff --check
LINES=$(wc -l < apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts | tr -d ' ')
echo HARDWARE_FLOW_LINES="$LINES"
test "$LINES" -lt 730

git add \
  apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
git commit -m 'Extract hardware diagnostics flow'
git push origin HEAD:"$BRANCH"

echo STAGE8B3_SHA=$(git rev-parse HEAD)
echo STAGE8B3_PARENT=$(git rev-parse HEAD^)
echo STAGE8B3_CHECK=1
echo STAGE8B3_E2E=1
echo STAGE8B3_FLOW_LINES="$LINES"
test -z "$(git status --porcelain)"

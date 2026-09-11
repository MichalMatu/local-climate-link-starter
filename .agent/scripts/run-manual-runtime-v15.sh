#!/bin/sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-manual-runtime-v14.sh > /tmp/run-manual-runtime-v15-driver.sh

cat > /tmp/manual-runtime-v15-adjust.py <<'PY'
from pathlib import Path
p = Path('/tmp/run-manual-runtime-v14-expanded.sh')
s = p.read_text()

marker = '# RPC-only resource diagnostics. Keep these app-side so generated /diag and the\n'
insert = '''# Register the device-status RPC centrally instead of scattering an untyped method name.
replace_once(
    'packages/shelly-client/src/model.ts',
    "  ShellyGetStatus: 'Shelly.GetStatus',\\n",
    "  ShellyGetStatus: 'Shelly.GetStatus',\\n  SysGetStatus: 'Sys.GetStatus',\\n",
)

'''
if marker not in s:
    raise SystemExit('v15 could not locate resource diagnostics marker')
s = s.replace(marker, insert + marker, 1)

s = s.replace(
    "import { RPC_METHODS } from '@lcl/shelly-client';",
    "import { RPC_METHODS, type ShellyRpcRequest } from '@lcl/shelly-client';",
    1,
)
s = s.replace(
    "  request: { method: string; params?: Record<string, unknown> }",
    "  request: ShellyRpcRequest",
    1,
)
s = s.replace(
    "    readPayload(transport, { method: 'Sys.GetStatus' })",
    "    readPayload(transport, { method: RPC_METHODS.SysGetStatus })",
    1,
)
s = s.replace(
    "    expect(mocks.call).toHaveBeenCalledWith({ method: 'Sys.GetStatus' });",
    "    expect(mocks.call).toHaveBeenCalledWith({ method: 'Sys.GetStatus' });",
    1,
)

old = '''  const diagnosticResourceMutation = useMutation({
    mutationFn: async (
      scriptId = Math.trunc(toNumberOrFallback(diagnosticShelly?.scriptIdInput ?? '1', 1))
    ): Promise<ShellyResourceDiagnostics> => {'''
new = '''  const diagnosticResourceMutation = useMutation<
    ShellyResourceDiagnostics,
    Error,
    number | undefined
  >({
    mutationFn: async (
      scriptId = Math.trunc(toNumberOrFallback(diagnosticShelly?.scriptIdInput ?? '1', 1))
    ): Promise<ShellyResourceDiagnostics> => {'''
if old not in s:
    raise SystemExit('v15 could not locate diagnosticResourceMutation')
s = s.replace(old, new, 1)

# Format the new shared RPC constant as part of the deterministic runner.
needle = '  packages/script-generator/src/shelly/config.ts \\\\n'
if needle not in s:
    raise SystemExit('v15 could not locate prettier package list')
s = s.replace(needle, '  packages/shelly-client/src/model.ts \\\\n' + needle, 1)
s = s.replace('MANUAL_RUNTIME_V14_SHA', 'MANUAL_RUNTIME_V15_SHA')
p.write_text(s)
PY

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-manual-runtime-v15-driver.sh')
s = p.read_text()
old = 'sh /tmp/run-manual-runtime-v14-expanded.sh\n'
new = 'python3 /tmp/manual-runtime-v15-adjust.py\nsh /tmp/run-manual-runtime-v14-expanded.sh\n'
if old not in s:
    raise SystemExit('v15 could not locate v14 execution')
p.write_text(s.replace(old, new, 1))
PY

sh /tmp/run-manual-runtime-v15-driver.sh

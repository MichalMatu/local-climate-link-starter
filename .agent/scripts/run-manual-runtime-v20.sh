#!/bin/sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-manual-runtime-v14.sh > /tmp/run-manual-runtime-v20-driver.sh

cat > /tmp/manual-runtime-v20-adjust.py <<'PY'
from pathlib import Path

p = Path('/tmp/run-manual-runtime-v14-expanded.sh')
s = p.read_text()

# V16 type-safe direct RPC fixes.
marker = '# RPC-only resource diagnostics. Keep these app-side so generated /diag and the\n'
insert = '''# Register the device-status RPC centrally instead of scattering an untyped method name.
replace_once(
    'packages/shelly-client/src/model.ts',
    "  ShellyGetStatus: 'Shelly.GetStatus',\\n",
    "  ShellyGetStatus: 'Shelly.GetStatus',\\n  SysGetStatus: 'Sys.GetStatus',\\n",
)

'''
if marker not in s:
    raise SystemExit('v20 could not locate resource diagnostics marker')
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
    raise SystemExit('v20 could not locate diagnosticResourceMutation')
s = s.replace(old, new, 1)

# V16 reached the full mobile suite; the only failure was a stale dashboard
# helper that did not model the new Script.Eval runtime-mode read. Append this
# patch to the V13 feature patch itself, so V9's baseline reset cannot erase it.
run_needle = '\nsh /tmp/run-manual-runtime-v13-expanded.sh\n'
if s.count(run_needle) != 1:
    raise SystemExit(f'v20 expected one V13 execution line, found {s.count(run_needle)}')
append_patch = r'''
cat >> /tmp/manual-runtime-v13.py <<'PYV20'

# Full-suite stale mock: runtime control now reads mode through Script.Eval.
p = Path('apps/mobile/src/__tests__/automation-dashboard.test.tsx')
s = p.read_text()
old = """    default:
      return {};
  }
};"""
new = """    case 'Script.Eval':
      return { result: '0' };
    default:
      return {};
  }
};"""
if s.count(old) != 1:
    raise SystemExit(f'v20 expected one controlRpcResult default, found {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PYV20

sh /tmp/run-manual-runtime-v13-expanded.sh
'''
s = s.replace(run_needle, '\n' + append_patch, 1)
s = s.replace('MANUAL_RUNTIME_V14_SHA', 'MANUAL_RUNTIME_V20_SHA')
p.write_text(s)
PY

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-manual-runtime-v20-driver.sh')
s = p.read_text()
old = 'sh /tmp/run-manual-runtime-v14-expanded.sh\n'
new = 'python3 /tmp/manual-runtime-v20-adjust.py\nsh /tmp/run-manual-runtime-v14-expanded.sh\n'
if s.count(old) != 1:
    raise SystemExit(f'v20 expected one V14 execution line, found {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PY

sh /tmp/run-manual-runtime-v20-driver.sh

#!/bin/sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-manual-runtime-v14.sh > /tmp/run-manual-runtime-v22-driver.sh

cat > /tmp/manual-runtime-v22-adjust.py <<'PY'
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
    raise SystemExit('v22 could not locate resource diagnostics marker')
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
    raise SystemExit('v22 could not locate diagnosticResourceMutation')
s = s.replace(old, new, 1)

# The broad audit in V13 accidentally included the delete path, where stopping a
# running script is intentional. Keep whole-file checks for transport/status,
# then audit runtimeControl only before deleteInstalledAutomation.
audit_path = "    'apps/mobile/src/flows/installations/runtimeControl.ts',\n"
if s.count(audit_path) != 1:
    raise SystemExit(f'v22 expected one runtimeControl audit path, found {s.count(audit_path)}')
s = s.replace(audit_path, '', 1)

audit_marker = "text = Path('apps/mobile/src/flows/hardware-setup/schemas.ts').read_text()\n"
audit_insert = '''runtime_control = Path('apps/mobile/src/flows/installations/runtimeControl.ts').read_text()
delete_marker = 'export const deleteInstalledAutomation'
if delete_marker not in runtime_control:
    raise SystemExit('runtimeControl audit could not locate delete boundary')
normal_runtime = runtime_control.split(delete_marker, 1)[0]
for forbidden in ('Script.Stop', 'Script.Start', '.stopScript(', '.startScript('):
    if forbidden in normal_runtime:
        raise SystemExit(f'runtimeControl normal AUTO/MANUAL path contains forbidden {forbidden}')
'''
if s.count(audit_marker) != 1:
    raise SystemExit(f'v22 expected one resource schema audit marker, found {s.count(audit_marker)}')
s = s.replace(audit_marker, audit_insert + audit_marker, 1)

# Apply the full-suite stale mocks inside the V13 feature patch itself so the
# baseline reset in V9 cannot erase them.
run_needle = '\nsh /tmp/run-manual-runtime-v13-expanded.sh\n'
if s.count(run_needle) != 1:
    raise SystemExit(f'v22 expected one V13 execution line, found {s.count(run_needle)}')
append_patch = r'''
cat >> /tmp/manual-runtime-v13.py <<'PYV22'

# Vitest dashboard helper: runtime mode is read through Script.Eval.
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
    raise SystemExit(f'v22 expected one controlRpcResult default, found {s.count(old)}')
p.write_text(s.replace(old, new, 1))

# Playwright Shelly mock: MANUAL/AUTO keeps the script running and changes only
# R.m through Script.Eval. /diag therefore remains live in MANUAL.
p = Path('apps/mobile/e2e/responsive.spec.ts')
s = p.read_text()
old = """const mockShellyRpc = async (page: Page) => {
  let scriptRunning = true;
  let relayOn = true;"""
new = """const mockShellyRpc = async (page: Page) => {
  let scriptRunning = true;
  let relayOn = true;
  let runtimeMode = 0;"""
if s.count(old) != 1:
    raise SystemExit(f'v22 expected one mockShellyRpc state block, found {s.count(old)}')
s = s.replace(old, new, 1)

old = "      params?: { id?: number; on?: boolean };"
new = "      params?: { id?: number; on?: boolean; code?: string };"
if s.count(old) != 1:
    raise SystemExit(f'v22 expected one responsive RPC params type, found {s.count(old)}')
s = s.replace(old, new, 1)

old = """      case 'Script.Stop':
        scriptRunning = false;"""
new = """      case 'Script.Eval': {
        const code = requestBody.params?.code ?? '';
        if (code.includes('R.m=1')) {
          runtimeMode = 1;
        } else if (code.includes('R.m=0')) {
          runtimeMode = 0;
        }
        result = { result: String(runtimeMode) };
        break;
      }
      case 'Script.Stop':
        scriptRunning = false;"""
if s.count(old) != 1:
    raise SystemExit(f'v22 expected one responsive Script.Stop block, found {s.count(old)}')
s = s.replace(old, new, 1)
p.write_text(s)
PYV22

sh /tmp/run-manual-runtime-v13-expanded.sh
'''
s = s.replace(run_needle, '\n' + append_patch, 1)
s = s.replace('MANUAL_RUNTIME_V14_SHA', 'MANUAL_RUNTIME_V22_SHA')
p.write_text(s)
PY

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-manual-runtime-v22-driver.sh')
s = p.read_text()
old = 'sh /tmp/run-manual-runtime-v14-expanded.sh\n'
new = 'python3 /tmp/manual-runtime-v22-adjust.py\nsh /tmp/run-manual-runtime-v14-expanded.sh\n'
if s.count(old) != 1:
    raise SystemExit(f'v22 expected one V14 execution line, found {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PY

sh /tmp/run-manual-runtime-v22-driver.sh

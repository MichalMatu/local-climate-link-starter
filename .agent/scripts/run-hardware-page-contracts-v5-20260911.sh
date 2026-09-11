#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-hardware-page-contracts-v4-20260911.sh > /tmp/run-hardware-page-contracts-v4-expected-lint.sh
set +e
sh /tmp/run-hardware-page-contracts-v4-expected-lint.sh
CODE=$?
set -e
test "$CODE" -eq 1

git diff -- apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts | grep -q 'automationScriptState'

python3 - <<'PY'
from pathlib import Path
import re
p=Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s=p.read_text()

# The narrowed public API proves these values were not consumed. Remove the dead
# parent state and stop destructuring raw mutations that only wrapper actions use.
for line in [
  '    refreshShellyControlMutation,\n',
  '    turnRelayOnMutation,\n',
  '    turnRelayOffMutation,\n',
  '    setAutomationAutoMutation,\n',
  '    setAutomationManualMutation,\n'
]:
    if s.count(line)!=1: raise SystemExit(f'destructuring marker mismatch: {line!r} -> {s.count(line)}')
    s=s.replace(line,'',1)

rx=r"type ShellyAutomationScriptViewState = ShellyAutomationScriptState & \{\n  deviceId: string;\n  updatedAtMs: number;\n\};\n\n"
s,n=re.subn(rx,'',s,count=1)
if n!=1: raise SystemExit(f'automation view type marker mismatch: {n}')
rx=r"  const \[automationScriptState, setAutomationScriptState\] =\n    useState<ShellyAutomationScriptViewState \| null>\(null\);\n"
s,n=re.subn(rx,'',s,count=1)
if n!=1: raise SystemExit(f'automation state marker mismatch: {n}')
for rx in [
 r"      setAutomationScriptState\(\{\n        \.\.\.state,\n        deviceId: device\.id,\n        updatedAtMs: Date\.now\(\)\n      \}\);\n",
 r"      setAutomationScriptState\(\{\n        deviceId: device\.id,\n        script: null,\n        code: null,\n        status,\n        updatedAtMs: Date\.now\(\)\n      \}\);\n"
]:
    s,n=re.subn(rx,'',s,count=1)
    if n!=1: raise SystemExit(f'automation state write marker mismatch: {n}')
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts \
  apps/mobile/src/screens/hardware-setup/helpers.ts \
  apps/mobile/src/screens/hardware-setup/pageContracts.ts \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx \
  scripts/quality/repository-gate.mjs \
  scripts/quality/ux-gate.mjs

git diff --check
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile test -- --run src/__tests__/hardware-setup.test.tsx
pnpm check:full

python3 - <<'PY'
from pathlib import Path
import re
p=Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s=p.read_text()
start=s.rfind('\n  return {'); end=s.find('\n  };',start)
body=s[start:end]
fields=re.findall(r'^    ([A-Za-z_$][\w$]*)(?:,|:|$)',body,re.M)
print(f'FINAL_HARDWARE_SETUP_FLOW_LINES={len(s.splitlines())}')
print(f'FINAL_HARDWARE_SETUP_PUBLIC_FIELDS={len(fields)}')
if len(fields)>110: raise SystemExit('public flow surface exceeds ratchet')
if len(s.splitlines())>1150: raise SystemExit('orchestrator exceeds ratchet')
if 'automationScriptState' in s: raise SystemExit('dead automationScriptState remains')
print('HARDWARE_PAGE_CONTRACTS_OK=1')
PY

git add apps/mobile/src scripts/quality/repository-gate.mjs scripts/quality/ux-gate.mjs
git diff --cached --check
git commit -m "refactor(mobile): narrow hardware setup contracts"
git push origin work/production-readiness-hardening-20260911
echo "HARDWARE_PAGE_CONTRACTS_SHA=$(git rev-parse HEAD)"

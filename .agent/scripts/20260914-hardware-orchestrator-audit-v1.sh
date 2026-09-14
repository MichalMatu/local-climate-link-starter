#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=ad67e2f115ecd6f48200bfef83d27f8402d41de9
cd "$REPO"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

python3 - <<'PY'
from pathlib import Path

roots = [Path('apps/mobile/src'), Path('apps/mobile/e2e')]
files = []
for root in roots:
    if root.exists():
        files.extend(p for p in root.rglob('*') if p.is_file() and p.suffix in {'.ts', '.tsx', '.js', '.mjs'})

needles = [
    'useHardwareSetupFlow',
    'HardwareSetupFlow',
    'useClimateAutomationInstallFlow',
    'useTimeAutomationSetupFlow',
    'InstalledAutomation',
    'flows/installations',
    'time-automation/'
]

print('=== EXACT LEGACY IMPORTERS ===')
for path in sorted(files):
    for lineno, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
        stripped = line.strip()
        if ('import ' in stripped or 'from ' in stripped) and any(n in stripped for n in needles):
            print(f'{path}:{lineno}:{stripped}')

print('=== SYMBOL REFERENCES ===')
for symbol in ['useHardwareSetupFlow', 'HardwareSetupFlow', 'useClimateAutomationInstallFlow', 'useTimeAutomationSetupFlow']:
    print(f'--- {symbol}')
    for path in sorted(files):
        for lineno, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
            if symbol in line:
                print(f'{path}:{lineno}:{line.strip()}')

print('=== LEGACY PRODUCTION FILES ===')
for raw in [
    'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts',
    'apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts',
    'apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.test.ts',
    'apps/mobile/src/flows/time-automation/useTimeAutomationSetupFlow.ts',
    'apps/mobile/src/screens/hardware-setup/pageContracts.ts',
    'apps/mobile/src/screens/hardware-setup/helpers.ts',
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx'
]:
    path = Path(raw)
    if path.exists():
        print(raw)

print('=== ROUTED SCREEN IMPORTS ===')
route = Path('apps/mobile/src/routes/AppRoutes.tsx')
for lineno, line in enumerate(route.read_text().splitlines(), 1):
    if line.strip().startswith('import '):
        print(f'{lineno}:{line.strip()}')
PY

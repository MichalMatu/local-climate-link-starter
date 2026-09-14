#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=16a3371339f7150fc368c48053b978737b7cda54
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
    'InstalledAutomation', 'installationId', 'flows/installations',
    'HardwareSetupScreen', 'useHardwareSetupFlow', 'useClimateAutomationInstallFlow',
    'useTimeAutomationSetupFlow', 'flows/time-automation', 'setupDraftStore'
]

print('=== REMAINING LEGACY REFERENCES ===')
for path in sorted(files):
    for lineno, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
        if any(n in line for n in needles):
            print(f'{path}:{lineno}:{line.strip()}')

print('=== PRODUCTION LEGACY IMPORTS ===')
for path in sorted(p for p in files if '__tests__' not in p.parts and '.test.' not in p.name):
    for lineno, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
        stripped = line.strip()
        if ('import ' in stripped or 'from ' in stripped) and any(n in stripped for n in [
            'installations/', 'time-automation/', 'HardwareSetupScreen', 'useHardwareSetupFlow',
            'useClimateAutomationInstallFlow', 'useTimeAutomationSetupFlow', 'setupDraftStore'
        ]):
            print(f'{path}:{lineno}:{stripped}')

print('=== IMPORTERS OF HARDWARE LEGACY TYPES/SCREENS ===')
for symbol in [
    'HardwareSetupScreen', 'useHardwareSetupFlow', 'useClimateAutomationInstallFlow',
    'useTimeAutomationSetupFlow', 'HardwareSetupFlow', 'TimeScheduleSetupPage',
    'RuleSetupPage', 'RuleAdvancedSettingsModal'
]:
    print(f'--- {symbol}')
    for path in sorted(files):
        for lineno, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
            if symbol in line:
                print(f'{path}:{lineno}:{line.strip()}')

print('=== INSTALLATIONS FILES ===')
base = Path('apps/mobile/src/flows/installations')
if base.exists():
    for path in sorted(p for p in base.rglob('*') if p.is_file()):
        print(path)

print('=== TIME AUTOMATION FILES ===')
base = Path('apps/mobile/src/flows/time-automation')
if base.exists():
    for path in sorted(p for p in base.rglob('*') if p.is_file()):
        print(path)

print('=== HARDWARE SETUP FILES ===')
base = Path('apps/mobile/src/flows/hardware-setup')
if base.exists():
    for path in sorted(p for p in base.rglob('*') if p.is_file()):
        print(path)
base = Path('apps/mobile/src/screens/hardware-setup')
if base.exists():
    for path in sorted(p for p in base.rglob('*') if p.is_file()):
        print(path)

print('=== CURRENT PRODUCT ROUTE IMPORTS ===')
route = Path('apps/mobile/src/routes/AppRoutes.tsx')
for lineno, line in enumerate(route.read_text().splitlines(), 1):
    if line.strip().startswith('import '):
        print(f'{lineno}:{line.strip()}')
PY

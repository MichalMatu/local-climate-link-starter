#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=1cd94a6b6defc041bd53e313624a23de2ab6d068
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
    'HardwareSetupScreen', 'useHardwareSetupFlow',
    'InstallationDetailScreen', 'InstallationRuntimeControls',
    'InstallationDiagnosticsModal', 'TimeInstallationDetail', 'TimeAutomationCard',
    'ShellyLedSettingsCard', 'useClimateAutomationInstallFlow',
    'useTimeAutomationSetupFlow', 'flows/time-automation'
]

print('=== SOURCE LEGACY REFERENCES ===')
for path in sorted(files):
    for lineno, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
        if any(n in line for n in needles):
            print(f'{path}:{lineno}:{line.strip()}')

print('=== PRODUCTION IMPORTERS ONLY ===')
for path in sorted(p for p in files if '__tests__' not in p.parts and '.test.' not in p.name):
    for lineno, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
        stripped = line.strip()
        if ('import ' in stripped or 'from ' in stripped) and any(n in stripped for n in [
            'installations/', 'time-automation/', 'HardwareSetupScreen', 'useHardwareSetupFlow',
            'InstallationDetailScreen', 'InstallationRuntimeControls', 'InstallationDiagnosticsModal',
            'TimeInstallationDetail', 'TimeAutomationCard', 'ShellyLedSettingsCard',
            'useClimateAutomationInstallFlow', 'useTimeAutomationSetupFlow'
        ]):
            print(f'{path}:{lineno}:{stripped}')

print('=== LEGACY TEST FILES ===')
for path in sorted(p for p in files if '__tests__' in p.parts or '.test.' in p.name):
    text = path.read_text(errors='ignore')
    if any(n in text for n in needles):
        print(path)

print('=== CURRENT PRODUCT ROUTE IMPORTS ===')
route = Path('apps/mobile/src/routes/AppRoutes.tsx')
for lineno, line in enumerate(route.read_text().splitlines(), 1):
    if line.strip().startswith('import '):
        print(f'{lineno}:{line.strip()}')

print('=== LEGACY INVENTORY ===')
for base in [Path('apps/mobile/src/flows/installations'), Path('apps/mobile/src/flows/time-automation')]:
    if base.exists():
        for path in sorted(p for p in base.rglob('*') if p.is_file()):
            print(path)
for raw in [
    'apps/mobile/src/screens/InstallationDetailScreen.tsx',
    'apps/mobile/src/screens/InstallationDiagnosticsModal.tsx',
    'apps/mobile/src/screens/InstallationRuntimeControls.tsx',
    'apps/mobile/src/screens/ShellyLedSettingsCard.tsx',
    'apps/mobile/src/screens/TimeAutomationCard.tsx',
    'apps/mobile/src/screens/TimeInstallationDetail.tsx',
    'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx',
    'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts',
    'apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts',
]:
    path = Path(raw)
    if path.exists():
        print(path)
PY

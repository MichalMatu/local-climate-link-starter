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

ROOT = Path('apps/mobile')
FILES = [p for p in ROOT.rglob('*') if p.is_file() and p.suffix in {'.ts', '.tsx', '.js', '.mjs', '.css', '.json'}]

def scan(label, needles, exclude_parts=()):
    print(f'=== {label} ===')
    hits = []
    for path in FILES:
        if any(part in path.parts for part in exclude_parts):
            continue
        try:
            lines = path.read_text(errors='ignore').splitlines()
        except Exception:
            continue
        for lineno, line in enumerate(lines, 1):
            if any(needle in line for needle in needles):
                hits.append((str(path), lineno, line.strip()))
    for path, lineno, line in hits:
        print(f'{path}:{lineno}:{line}')
    print(f'COUNT={len(hits)}')

scan('PRODUCT LEGACY REFERENCES', [
    'InstalledAutomation',
    'installationId',
    'flows/installations',
    'useHardwareSetupFlow',
    'HardwareSetupScreen',
    'InstallationDetailScreen',
    'InstallationRuntimeControls',
    'TimeInstallationDetail',
    'TimeAutomationCard',
    'useClimateAutomationInstallFlow',
    'useTimeAutomationSetupFlow',
    'flows/time-automation',
])

for symbol in [
    'InstallationDetailScreen',
    'InstallationRuntimeControls',
    'InstallationDiagnosticsModal',
    'TimeInstallationDetail',
    'TimeAutomationCard',
    'ShellyLedSettingsCard',
    'HardwareSetupScreen',
    'useHardwareSetupFlow',
    'useClimateAutomationInstallFlow',
    'useTimeAutomationSetupFlow',
]:
    scan(f'IMPORTERS {symbol}', [symbol])

scan('INSTALLATIONS IMPORT PATHS', [
    "../flows/installations/",
    "../../flows/installations/",
    "../../../flows/installations/",
    "./flows/installations/",
    "flows/installations/",
])
scan('TIME AUTOMATION IMPORT PATHS', [
    "../flows/time-automation/",
    "../../flows/time-automation/",
    "../../../flows/time-automation/",
    "./flows/time-automation/",
    "flows/time-automation/",
])

print('=== LEGACY FILE INVENTORY ===')
for base in [
    Path('apps/mobile/src/flows/installations'),
    Path('apps/mobile/src/flows/time-automation'),
]:
    if base.exists():
        for path in sorted(p for p in base.rglob('*') if p.is_file()):
            print(path)
for path in [
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
    if Path(path).exists():
        print(path)

print('=== TEST FILES WITH LEGACY REFERENCES ===')
for path in sorted(Path('apps/mobile/src').rglob('*.test.*')):
    text = path.read_text(errors='ignore')
    if any(n in text for n in [
        'InstalledAutomation', 'flows/installations', 'InstallationDetailScreen',
        'ShellyLedSettingsCard', 'flows/time-automation', 'HardwareSetupScreen',
        'useHardwareSetupFlow', 'useClimateAutomationInstallFlow', 'useTimeAutomationSetupFlow'
    ]):
        print(path)
PY

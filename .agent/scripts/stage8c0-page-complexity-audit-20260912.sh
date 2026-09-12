#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='f39121476685416fc93662891e62dc4d53342c10'

git fetch --prune origin "$BRANCH"
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

echo 'STAGE8C0_PAGE_AUDIT=1'
echo "HEAD=$(git rev-parse HEAD)"

python3 - <<'PY'
from pathlib import Path
import re

paths = [
    Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'),
    Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx'),
    Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx'),
    Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'),
    Path('apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx'),
    Path('apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx'),
]
paths.extend(Path(p) for p in __import__('subprocess').check_output(
    ['git', 'ls-files', '*InstallationDetailScreen*.tsx'], text=True
).splitlines())

seen = set()
for path in paths:
    if not path.exists() or path in seen:
        continue
    seen.add(path)
    text = path.read_text()
    lines = text.splitlines()
    imports = sum(1 for line in lines if line.startswith('import '))
    hooks = {name: len(re.findall(rf'\b{name}\s*\(', text)) for name in [
        'useState','useEffect','useMemo','useCallback','useMutation','useRef'
    ]}
    modals = len(re.findall(r'<IonModal\b', text))
    alerts = len(re.findall(r'<IonAlert\b', text))
    component_defs = len(re.findall(r'\b(?:const|function)\s+[A-Z][A-Za-z0-9_]*', text))
    print(
        f'FILE={path} LINES={len(lines)} IMPORTS={imports} '
        f'HOOKS={sum(hooks.values())} HOOK_DETAIL={hooks} '
        f'MODALS={modals} ALERTS={alerts} COMPONENT_DEFS={component_defs}'
    )
PY

echo '--- QUALITY GATE HARDWARE FLOW / PAGE CONTRACT RULES ---'
grep -n -E 'useHardwareSetupFlow|pageContracts|hardware-setup/pages|1150|return.*110|subflow|350' scripts/quality/repository-gate.mjs || true

echo '--- TRACKED HARDWARE SETUP PAGE FILES ---'
git ls-files 'apps/mobile/src/screens/hardware-setup/pages/*' | sort

test -z "$(git status --porcelain)"

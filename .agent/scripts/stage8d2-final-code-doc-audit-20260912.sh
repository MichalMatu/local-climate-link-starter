#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='8fbed41c5a411f9071b94d810b1bbf0f79c70f12'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx')
s = p.read_text()
old = "            {t('intent.back')}"
new = "            {setupIntent === 'time' ? t('common.cancel') : t('intent.back')}"
if s.count(old) != 1:
    raise SystemExit(f'expected exactly one setup back label, found {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PY

pnpm exec prettier --write apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx

python3 - <<'PY'
from pathlib import Path
import re

roots = [Path('apps/mobile/src'), Path('packages')]
skip_parts = {'__tests__', 'locales', 'dist', 'generated'}
problems = []
scanned = 0
for root in roots:
    if not root.exists():
        continue
    for p in root.rglob('*'):
        if not p.is_file() or p.suffix not in {'.ts', '.tsx', '.js', '.mjs'}:
            continue
        if any(part in skip_parts for part in p.parts):
            continue
        if re.search(r'\.(?:test|spec)\.[^.]+$', p.name):
            continue
        text = p.read_text(errors='replace')
        scanned += 1
        checks = [
            (r'\b(?:TODO|FIXME|HACK)\b', 'TODO/FIXME/HACK marker'),
            (r'@ts-ignore', '@ts-ignore escape'),
            (r'\bas any\b', 'as any escape'),
        ]
        if p.as_posix() != 'apps/mobile/src/app/devConsole.ts':
            checks.append((r'console\.(?:log|debug)\s*\(', 'debug console call'))
        for pattern, label in checks:
            for match in re.finditer(pattern, text):
                line = text.count('\n', 0, match.start()) + 1
                problems.append(f'{p}:{line}: {label}')

print(f'FINAL_AUDIT_PRODUCTION_FILES={scanned}')
if problems:
    print('Production hygiene findings:')
    print('\n'.join(problems))
    raise SystemExit(1)
print('FINAL_AUDIT_HYGIENE=1')
PY

python3 - <<'PY'
from pathlib import Path
import re
from urllib.parse import unquote

broken = []
checked = 0
for doc in Path('docs').rglob('*.md'):
    text = doc.read_text(errors='replace')
    for match in re.finditer(r'(?<!!)\[[^\]]+\]\(([^)]+)\)', text):
        raw = match.group(1).strip().split()[0].strip('<>')
        if not raw or raw.startswith(('#', 'http://', 'https://', 'mailto:', 'tel:')):
            continue
        target = unquote(raw.split('#', 1)[0].split('?', 1)[0])
        if not target:
            continue
        checked += 1
        resolved = (doc.parent / target).resolve()
        if not resolved.exists():
            line = text.count('\n', 0, match.start()) + 1
            broken.append(f'{doc}:{line}: {raw}')
print(f'FINAL_AUDIT_DOC_LINKS_CHECKED={checked}')
if broken:
    print('Broken relative documentation links:')
    print('\n'.join(broken))
    raise SystemExit(1)
print('FINAL_AUDIT_DOC_LINKS=1')
PY

python3 - <<'PY'
from pathlib import Path
paths = [
    'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts',
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx',
    'apps/mobile/src/screens/InstallationDetailScreen.tsx',
]
for raw in paths:
    p = Path(raw)
    if p.exists():
        text = p.read_text()
        hooks = sum(text.count(token) for token in ('useState(', 'useEffect(', 'useMemo(', 'useCallback(', 'useRef('))
        print(f'FINAL_METRIC {raw} lines={len(text.splitlines())} hooks={hooks}')
PY

pnpm --dir apps/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm check:full

git diff --check

git add apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx
git commit -m 'Use contextual setup back label'
git push origin HEAD:"$BRANCH"

echo STAGE8D2_SHA=$(git rev-parse HEAD)
echo STAGE8D2_PARENT=$(git rev-parse HEAD^)
echo STAGE8D2_CHECK_FULL=1
echo STAGE8D2_FINAL_AUDIT=1
test -z "$(git status --porcelain)"

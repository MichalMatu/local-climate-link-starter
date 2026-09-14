#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=1cd94a6b6defc041bd53e313624a23de2ab6d068
cd "$REPO"

git fetch origin "$BRANCH"
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }
git checkout "$BRANCH"
git reset --hard "$REMOTE"
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

python3 - <<'PY'
from pathlib import Path

targets = {
    'apps/mobile/src/screens/InstallationDetailScreen.tsx',
    'apps/mobile/src/screens/InstallationDiagnosticsModal.tsx',
    'apps/mobile/src/screens/InstallationRuntimeControls.tsx',
    'apps/mobile/src/screens/ShellyLedSettingsCard.tsx',
    'apps/mobile/src/screens/TimeAutomationCard.tsx',
    'apps/mobile/src/screens/TimeInstallationDetail.tsx',
    'apps/mobile/src/__tests__/automation-detail.test.tsx',
    'apps/mobile/src/__tests__/climate-delete.test.tsx',
    'apps/mobile/src/__tests__/shelly-led-settings.test.tsx',
}
for target in targets:
    if not Path(target).exists():
        raise SystemExit(f'missing expected target: {target}')

symbols = [
    'InstallationDetailScreen',
    'InstallationDiagnosticsModal',
    'InstallationRuntimeControls',
    'ShellyLedSettingsCard',
    'TimeAutomationCard',
    'TimeInstallationDetail',
]
allowed = {Path(p) for p in targets}
violations = []
for root in [Path('apps/mobile/src'), Path('apps/mobile/e2e')]:
    if not root.exists():
        continue
    for path in root.rglob('*'):
        if not path.is_file() or path.suffix not in {'.ts', '.tsx', '.js', '.mjs'}:
            continue
        text = path.read_text(errors='ignore')
        if any(symbol in text for symbol in symbols) and path not in allowed:
            violations.append(str(path))
if violations:
    raise SystemExit('unexpected legacy screen importers: ' + ', '.join(sorted(set(violations))))
PY

rm \
  apps/mobile/src/screens/InstallationDetailScreen.tsx \
  apps/mobile/src/screens/InstallationDiagnosticsModal.tsx \
  apps/mobile/src/screens/InstallationRuntimeControls.tsx \
  apps/mobile/src/screens/ShellyLedSettingsCard.tsx \
  apps/mobile/src/screens/TimeAutomationCard.tsx \
  apps/mobile/src/screens/TimeInstallationDetail.tsx \
  apps/mobile/src/__tests__/automation-detail.test.tsx \
  apps/mobile/src/__tests__/climate-delete.test.tsx \
  apps/mobile/src/__tests__/shelly-led-settings.test.tsx

python3 - <<'PY'
from pathlib import Path
symbols = [
    'InstallationDetailScreen', 'InstallationDiagnosticsModal',
    'InstallationRuntimeControls', 'ShellyLedSettingsCard',
    'TimeAutomationCard', 'TimeInstallationDetail'
]
hits = []
for root in [Path('apps/mobile/src'), Path('apps/mobile/e2e')]:
    if not root.exists():
        continue
    for path in root.rglob('*'):
        if not path.is_file() or path.suffix not in {'.ts', '.tsx', '.js', '.mjs'}:
            continue
        text = path.read_text(errors='ignore')
        for symbol in symbols:
            if symbol in text:
                hits.append(f'{path}:{symbol}')
if hits:
    raise SystemExit('legacy screen references remain: ' + ', '.join(hits))
PY

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/__tests__/app-routes.test.tsx \
  src/__tests__/automation-dashboard.test.tsx \
  src/__tests__/rule-detail.test.tsx \
  src/__tests__/navigation-settings-regression.test.tsx
pnpm lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add -A \
  apps/mobile/src/screens \
  apps/mobile/src/__tests__
git commit -m "Remove legacy installation detail screens"

git fetch origin "$BRANCH"
REMOTE_AFTER=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE_AFTER" == "$EXPECTED" ]] || { echo "Remote head changed before push: $REMOTE_AFTER"; exit 4; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse "origin/$BRANCH")
echo "FINAL_HEAD=$FINAL_HEAD"

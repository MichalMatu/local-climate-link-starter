#!/usr/bin/env sh
set -eu

BASE=5a4a109f6d69bf468b6b408241e46cee1ecf75aa
BRANCH=work/installation-controls-diagnostics-20260911

git fetch --prune origin
test "$(git rev-parse origin/main)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$BASE"

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-installation-controls-diagnostics-v4.sh > /tmp/run-installation-controls-diagnostics-v4.sh
set +e
sh /tmp/run-installation-controls-diagnostics-v4.sh
V4_RC=$?
set -e
# V4 is expected to stop only at the known responsive E2E regressions.
test "$V4_RC" -ne 0
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
test -n "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path

p = Path('apps/mobile/src/screens/InstallationDetailScreen.tsx')
s = p.read_text()
old = '    <main className="demo-shell installation-detail-shell">'
new = '    <main className="demo-shell installation-detail-shell app-bottom-nav-shell">'
if s.count(old) != 1:
    raise SystemExit(f'detail bottom-nav shell marker mismatch: {s.count(old)}')
p.write_text(s.replace(old, new, 1))

p = Path('apps/mobile/src/components/AppBottomNavigation.css')
s = p.read_text()
old = "}\n\n.app-bottom-nav {\n"
new = "}\n\n.app-bottom-nav-shell .lcl-toast-viewport {\n  bottom: calc(\n    var(--app-bottom-nav-height) + var(--lcl-spacing-lg) + env(safe-area-inset-bottom)\n  );\n}\n\n.app-bottom-nav {\n"
if s.count(old) != 1:
    raise SystemExit(f'bottom-nav CSS marker mismatch: {s.count(old)}')
p.write_text(s.replace(old, new, 1))

p = Path('apps/mobile/e2e/responsive.spec.ts')
s = p.read_text()
old = "  await expect(page.getByText('OFF', { exact: true })).toBeVisible();"
new = "  await expect(page.getByRole('button', { name: 'OFF', exact: true })).toHaveAttribute(\n    'aria-pressed',\n    'true'\n  );"
if s.count(old) != 1:
    raise SystemExit(f'responsive OFF locator marker mismatch: {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/InstallationDetailScreen.tsx \
  apps/mobile/src/components/AppBottomNavigation.css \
  apps/mobile/e2e/responsive.spec.ts

grep -q 'installation-detail-shell app-bottom-nav-shell' apps/mobile/src/screens/InstallationDetailScreen.tsx
grep -q 'app-bottom-nav-shell .lcl-toast-viewport' apps/mobile/src/components/AppBottomNavigation.css
git diff --check

echo '=== FOCUSED E2E REGRESSION ==='
pnpm exec playwright test -c apps/mobile/playwright.config.ts \
  apps/mobile/e2e/led-settings.spec.ts \
  apps/mobile/e2e/responsive.spec.ts \
  --grep 'PLUGS_UI LED relay-state and off presets work end to end|installed automation detail safely pauses and resumes on phone'

echo '=== FULL VALIDATION ==='
pnpm check:full

test -z "$(git diff --name-only "$BASE" -- apps/mobile/src/screens/ShellyLedSettingsCard.tsx packages/shelly-client/src/plugsUi.ts)"
if git grep -n -E 'lastTemp|lastHumidity|lastVpd|lastEffectiveOnThreshold|lastEffectiveOffThreshold|relayState' -- apps/mobile/src/screens/InstallationDiagnosticsModal.tsx; then
  echo 'diagnostics modal duplicates primary installation summary data' >&2
  exit 31
fi

git add apps/mobile/src apps/mobile/e2e/responsive.spec.ts docs/HANDOFF_NEXT_CHAT.md
git commit -m 'feat(mobile): add installation controls and diagnostics'
git push -u origin "$BRANCH"

echo INSTALLATION_CONTROLS_DIAGNOSTICS_SHA=$(git rev-parse HEAD)
echo INSTALLATION_CONTROLS_DIAGNOSTICS_BRANCH=$BRANCH
echo INSTALLATION_CONTROLS_DIAGNOSTICS_OK=1

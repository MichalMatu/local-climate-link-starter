#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=ded8d77605131b728d66b64a4aee66ce347c1eca

git fetch --prune origin "$BRANCH" agent-control
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"

# Continue exact failed fix7 state. If runtime cleanup removed it, deterministically
# reproduce fix7 until its expected focused-test failure, then continue from there.
if test -z "$(git status --porcelain)"; then
  git show origin/agent-control:.agent/scripts/ux-modal-toast-polish-stage5-fix7-20260912.sh > /tmp/lcl-stage5-fix7.sh
  set +e
  sh /tmp/lcl-stage5-fix7.sh
  RC=$?
  set -e
  test "$RC" -eq 1
  test "$(git rev-parse HEAD)" = "$BASE"
fi

test -n "$(git status --porcelain)"
grep -q 'size="task"' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
grep -q "Wybierz: http://192.168.0.20/" apps/mobile/src/__tests__/hardware-setup.test.tsx
! grep -q "name: 'Skanuj sieć Shelly'" apps/mobile/src/__tests__/hardware-setup.test.tsx

python3 <<'PY'
from pathlib import Path
import re

page = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = page.read_text()

# Stopping a scan is state inside the active task, not a global completion event.
# Remove the remaining global "scan stopped" toast.
pattern = re.compile(
    r"const stopShellyScan = \(\) => \{\s*if \(flow\.stopShellyScan\(\)\) \{\s*pushToast\('ok', t\('hardware\.shelly\.scanStopped'\)\);\s*\}\s*\};",
    re.S,
)
s2, n = pattern.subn("const stopShellyScan = () => {\n    flow.stopShellyScan();\n  };", s, count=1)
if n != 1:
    raise SystemExit(f'expected one Shelly stop-scan toast block, got {n}')
page.write_text(s2)

test_path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
t = test_path.read_text()
old = """    expect(
      within(shellyAddDialog).getByRole('button', { name: 'Skanuj sieć' })
    ).toHaveAttribute('title', 'Szukaj gniazdek Shelly w lokalnej sieci');"""
new = """    const shellyScanSummary = within(shellyAddDialog).getByText('Skanuj sieć', {
      selector: 'summary'
    });
    expect(shellyScanSummary).toBeVisible();
    expect(shellyScanSummary.closest('details')).not.toHaveAttribute('open');"""
if old not in t:
    raise SystemExit('expected stale top-menu Shelly scan button assertion')
t = t.replace(old, new, 1)

test_path.write_text(t)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/__tests__/hardware-setup.test.tsx

pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile test -- --run
pnpm --filter @lcl/mobile build

CHANGED=$(git diff --name-only | sort)
printf '%s\n' "$CHANGED"
for f in $CHANGED; do
  case "$f" in
    apps/mobile/src/__tests__/hardware-setup.test.tsx|apps/mobile/src/app/locales/de.ts|apps/mobile/src/app/locales/en.ts|apps/mobile/src/app/locales/es.ts|apps/mobile/src/app/locales/fr.ts|apps/mobile/src/app/locales/it.ts|apps/mobile/src/app/locales/pl.ts|apps/mobile/src/app/locales/ptBr.ts|apps/mobile/src/components/AppBottomNavigation.css|apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx|apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx|apps/mobile/src/theme/theme.css|packages/ui/src/primitives/Modal.tsx|packages/ui/src/styles.css) ;;
    *) echo "Unexpected changed file: $f" >&2; exit 1 ;;
  esac
done

pnpm check

git add $CHANGED
git diff --cached --check
git commit -m "Unify mobile setup task flows"
git push origin "$BRANCH"

SHA=$(git rev-parse HEAD)
printf 'STAGE5_SHA=%s\n' "$SHA"
printf 'STAGE5_PARENT=%s\n' "$(git rev-parse HEAD^)"
printf 'STAGE5_BUILD=1\n'
test "$(git rev-parse HEAD^)" = "$BASE"
test -z "$(git status --porcelain)"

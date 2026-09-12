#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=a7b08d97f88750247823d8393ed53a26c90034d9
APP_ID=link.localclimate.app

git fetch --prune origin "$BRANCH" agent-control
git checkout "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

# Recreate the exact Stage 6B candidate plus the already-updated FAB tests.
git show origin/agent-control:.agent/scripts/ux-polish-stage6b-fix-tests-commit-install-20260912.sh > /tmp/lcl-stage6b-prev.sh
set +e
sh /tmp/lcl-stage6b-prev.sh
RC=$?
set -e
test "$RC" -eq 2

test "$(git rev-parse HEAD)" = "$BASE"
test -n "$(git status --porcelain)"

# The previous retry exposed one purely test-local TypeScript collision: an existing
# addSensorButton identifier already exists later in the same test block. Rename
# only the newly-added FAB assertion variable.
python3 <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = p.read_text()
old = """    const addSensorButton = screen.getByRole('button', { name: 'Dodaj termometr' });
    expect(addSensorButton).toHaveClass('setup-add-fab');
    expect(addSensorButton.querySelector('.setup-add-fab__icon')).not.toBeNull();"""
new = """    const addSensorFabButton = screen.getByRole('button', { name: 'Dodaj termometr' });
    expect(addSensorFabButton).toHaveClass('setup-add-fab');
    expect(addSensorFabButton.querySelector('.setup-add-fab__icon')).not.toBeNull();"""
if s.count(old) != 1:
    raise SystemExit(f'expected one newly-added sensor FAB assertion, got {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PY

pnpm exec prettier --write apps/mobile/src/__tests__/hardware-setup.test.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile test -- --run
pnpm --filter @lcl/mobile build
pnpm check

CHANGED="$(git diff --name-only | sort)"
printf '%s\n' "$CHANGED"
EXPECTED="apps/mobile/src/__tests__/hardware-setup.test.tsx
apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx
apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx
apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
apps/mobile/src/theme/theme.css"
test "$CHANGED" = "$EXPECTED"

git diff --check
git add $CHANGED
git diff --cached --check
git commit -m "Polish add actions and time controls"
git push origin "$BRANCH"

SHA="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = "$BASE"
test -z "$(git status --porcelain)"
printf 'STAGE6B_SHA=%s\n' "$SHA"
printf 'STAGE6B_PARENT=%s\n' "$(git rev-parse HEAD^)"
printf 'STAGE6B_BUILD=1\n'

pnpm --filter @lcl/mobile exec cap sync android
(
  cd apps/mobile/android
  ./gradlew installDebug
)
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" -eq 1
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "SM-S906B"
adb -s "$SERIAL" shell am force-stop "$APP_ID"
adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 2
FOCUS="$(adb -s "$SERIAL" shell dumpsys window | grep -m1 'mCurrentFocus' || true)"
printf 'ANDROID_DEVICE_MODEL=%s\n' "$MODEL"
printf 'ANDROID_FOCUS=%s\n' "$FOCUS"
printf 'STAGE6B_ANDROID_INSTALL=1\n'

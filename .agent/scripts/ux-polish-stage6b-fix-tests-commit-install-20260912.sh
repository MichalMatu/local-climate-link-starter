#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=a7b08d97f88750247823d8393ed53a26c90034d9
APP_ID=link.localclimate.app

git fetch --prune origin "$BRANCH" agent-control
git checkout "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"

# Recreate the exact verified Stage 6B candidate if the failed task workspace was cleaned.
if test -z "$(git status --porcelain)"; then
  git show origin/agent-control:.agent/scripts/ux-polish-stage6b-fix-type-install-picker-audit-20260912.sh > /tmp/lcl-stage6b-type.sh
  set +e
  sh /tmp/lcl-stage6b-type.sh
  RC=$?
  set -e
  test "$RC" -eq 1
fi

test "$(git rev-parse HEAD)" = "$BASE"
test -n "$(git status --porcelain)"
grep -q 'className="primary-action setup-add-fab"' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
grep -q 'className="primary-action setup-add-fab"' apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
grep -q 'className="time-schedule-time-input"' apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
grep -q 'minmax(min(100%, var(--lcl-size-form-column-min)), 1fr)' apps/mobile/src/theme/theme.css

python3 <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = p.read_text()
old1 = """    expect(screen.getByRole('button', { name: 'Dodaj gniazdko' })).toHaveTextContent(\n      'Dodaj gniazdko'\n    );"""
new1 = """    const addShellyButton = screen.getByRole('button', { name: 'Dodaj gniazdko' });\n    expect(addShellyButton).toHaveClass('setup-add-fab');\n    expect(addShellyButton.querySelector('.setup-add-fab__icon')).not.toBeNull();"""
old2 = """    expect(screen.getByRole('button', { name: 'Dodaj termometr' })).toHaveTextContent(\n      'Dodaj termometr'\n    );"""
new2 = """    const addSensorButton = screen.getByRole('button', { name: 'Dodaj termometr' });\n    expect(addSensorButton).toHaveClass('setup-add-fab');\n    expect(addSensorButton.querySelector('.setup-add-fab__icon')).not.toBeNull();"""
if s.count(old1) != 1:
    raise SystemExit(f'expected one Shelly text assertion, got {s.count(old1)}')
if s.count(old2) != 1:
    raise SystemExit(f'expected one sensor text assertion, got {s.count(old2)}')
s = s.replace(old1, new1, 1).replace(old2, new2, 1)
p.write_text(s)
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

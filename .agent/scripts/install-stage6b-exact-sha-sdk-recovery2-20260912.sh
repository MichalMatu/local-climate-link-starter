#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
CANDIDATE=4622d319ed90d1d03cb3eaa40d96fdf6cfa5160e
APP_ID=link.localclimate.app
EXPECTED_MODEL=SM-S906B
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk

git fetch --prune origin "$BRANCH" agent-control >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$CANDIDATE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"

command -v adb >/dev/null 2>&1
SDK_ROOT=""
for CANDIDATE_SDK in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Library/Android/sdk"; do
  if test -n "$CANDIDATE_SDK" && test -x "$CANDIDATE_SDK/platform-tools/adb" && test -d "$CANDIDATE_SDK/platforms" && test -d "$CANDIDATE_SDK/build-tools"; then
    SDK_ROOT="$CANDIDATE_SDK"
    break
  fi
done

if test -z "$SDK_ROOT"; then
  ADB_REAL="$(python3 - <<'PY'
import os, shutil
p = shutil.which('adb')
print(os.path.realpath(p) if p else '')
PY
)"
  if test -n "$ADB_REAL"; then
    ADB_PARENT="$(cd "$(dirname "$ADB_REAL")/.." && pwd -P)"
    if test -x "$ADB_PARENT/platform-tools/adb" && test -d "$ADB_PARENT/platforms" && test -d "$ADB_PARENT/build-tools"; then
      SDK_ROOT="$ADB_PARENT"
    fi
  fi
fi

test -n "$SDK_ROOT"
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
printf 'sdk.dir=%s\n' "$SDK_ROOT" > apps/mobile/android/local.properties
printf 'ANDROID_SDK_ROOT_RESOLVED=%s\n' "$SDK_ROOT"

adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" -eq 1
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "$EXPECTED_MODEL"

pnpm --filter @lcl/mobile build
(
  cd apps/mobile
  pnpm exec cap sync android
  cd android
  ./gradlew assembleDebug
)
test -f "$APK"
adb -s "$SERIAL" install -r "$APK" >/dev/null
adb -s "$SERIAL" shell am force-stop "$APP_ID"
adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 3
PACKAGE_PATH="$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r')"
FOCUS="$(adb -s "$SERIAL" shell dumpsys window 2>/dev/null | grep -E 'mCurrentFocus|mFocusedApp' | grep "$APP_ID" | head -n 1 || true)"
test -n "$PACKAGE_PATH"
test -n "$FOCUS"
test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"
printf 'INSTALLED_CANDIDATE_SHA=%s\n' "$CANDIDATE"
printf 'ANDROID_DEVICE_MODEL=%s\n' "$MODEL"
printf 'ANDROID_PACKAGE_PATH=%s\n' "$PACKAGE_PATH"
printf 'ANDROID_APP_FOREGROUND=1\n'
printf 'STAGE6B_ANDROID_INSTALL=1\n'

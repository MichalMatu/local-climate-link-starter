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

ADB_BIN="$(command -v adb)"
test -n "$ADB_BIN"
SDK_ROOT="$(cd "$(dirname "$ADB_BIN")/.." && pwd -P)"
test -x "$SDK_ROOT/platform-tools/adb"
test -d "$SDK_ROOT/platforms"
test -d "$SDK_ROOT/build-tools"
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
adb -s "$SERIAL" install -r "$APK"
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

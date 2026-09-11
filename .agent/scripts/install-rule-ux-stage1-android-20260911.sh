#!/usr/bin/env sh
set -eu

CANDIDATE=d8d7e08643923537386b9a1386debec8b0202a8e
BRANCH=work/rule-ux-polish-stage1-20260911
APP_ID=link.localclimate.app
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk

git fetch --prune origin "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$CANDIDATE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"

command -v adb >/dev/null 2>&1
adb start-server >/dev/null
DEVICE_LINES="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
DEVICE_COUNT="$(printf '%s\n' "$DEVICE_LINES" | sed '/^$/d' | wc -l | tr -d ' ')"
if [ "$DEVICE_COUNT" -ne 1 ]; then
  echo "ANDROID_DEVICE_COUNT=$DEVICE_COUNT"
  adb devices -l
  exit 21
fi
SERIAL="$(printf '%s\n' "$DEVICE_LINES" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
MANUFACTURER="$(adb -s "$SERIAL" shell getprop ro.product.manufacturer | tr -d '\r')"
echo "ANDROID_DEVICE_MODEL=$MANUFACTURER $MODEL"

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
sleep 2
PACKAGE_PATH="$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r')"
CURRENT_FOCUS="$(adb -s "$SERIAL" shell dumpsys window 2>/dev/null | grep -E 'mCurrentFocus|mFocusedApp' | grep "$APP_ID" | head -n 1 || true)"
test -n "$PACKAGE_PATH"

echo INSTALLED_CANDIDATE_SHA=$CANDIDATE
echo ANDROID_PACKAGE_PATH=$PACKAGE_PATH
if [ -n "$CURRENT_FOCUS" ]; then
  echo ANDROID_APP_FOREGROUND=1
else
  echo ANDROID_APP_FOREGROUND=0
fi
echo RULE_UX_STAGE1_ANDROID_INSTALL=1

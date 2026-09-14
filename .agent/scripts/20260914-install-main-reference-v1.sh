#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=main
BASE=56a90240029ce19690e96ad02057cc4150ba537f
ADB=/opt/homebrew/bin/adb
SERIAL=RFCT70L7E8J
PKG=link.localclimate.app
ACTIVITY=.MainActivity
OUT=/tmp/lcl-main-reference-20260914
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "Unexpected main HEAD: $(git rev-parse HEAD)"; exit 2; }
[ -z "$(git status --porcelain)" ] || { git status --short; exit 3; }

echo "SOURCE_BRANCH=$(git branch --show-current)"
echo "SOURCE_HEAD=$(git rev-parse HEAD)"
[ -x "$ADB" ] || { echo "ADB_MISSING=yes"; exit 4; }
"$ADB" -s "$SERIAL" get-state | grep -qx device || { echo "ANDROID_DEVICE_READY=no"; exit 5; }
echo "ANDROID_DEVICE_READY=yes"
"$ADB" -s "$SERIAL" shell getprop ro.product.model | sed 's/^/ANDROID_MODEL=/'

pnpm --filter @lcl/mobile build
pnpm --filter @lcl/mobile exec cap sync android
(
  cd apps/mobile/android
  ./gradlew assembleDebug
)
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
[ -f "$APK" ] || { echo "APK_MISSING=yes"; exit 6; }

# Replace the currently installed debug APK but preserve application data.
"$ADB" -s "$SERIAL" install -r "$APK"
echo "ANDROID_INSTALL_MODE=replace_preserve_data"
"$ADB" -s "$SERIAL" shell am force-stop "$PKG"
"$ADB" -s "$SERIAL" logcat -c
"$ADB" -s "$SERIAL" shell am start -W -n "$PKG/$ACTIVITY"
sleep 2
mkdir -p "$OUT"
"$ADB" -s "$SERIAL" exec-out screencap -p > "$OUT/main-current-launch.png"
file "$OUT/main-current-launch.png"
"$ADB" -s "$SERIAL" shell dumpsys package "$PKG" | grep -E 'versionName=|versionCode=' | head -n 4
"$ADB" -s "$SERIAL" logcat -d -t 250 | grep -E 'FATAL EXCEPTION|AndroidRuntime|link.localclimate.app|chromium|Capacitor' > "$OUT/logcat-filtered.txt" || true
if grep -q 'FATAL EXCEPTION' "$OUT/logcat-filtered.txt"; then
  echo "APP_FATAL_EXCEPTION=yes"
  cat "$OUT/logcat-filtered.txt"
  exit 7
fi
echo "APP_FATAL_EXCEPTION=no"
echo "MAIN_REFERENCE_INSTALLED=yes"
echo "FINAL_HEAD=$(git rev-parse HEAD)"

#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
BASE=0fbe83040ae0e41f932bb83a65a8b3438c26ba1b
ADB=/opt/homebrew/bin/adb
SERIAL=RFCT70L7E8J
PKG=link.localclimate.app
ACTIVITY=.MainActivity
OUT=/tmp/lcl-device-ux-android-smoke-v2
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }

[ -x "$ADB" ] || { echo "ADB_MISSING=yes"; exit 3; }
"$ADB" -s "$SERIAL" get-state | grep -qx device || { echo "ANDROID_DEVICE_READY=no"; exit 4; }
echo "ANDROID_DEVICE_READY=yes"

# The exact BASE APK was already successfully installed with -r by v1. Do not reinstall or clear data here.
"$ADB" -s "$SERIAL" shell dumpsys package "$PKG" | grep -E 'versionName=|versionCode=' | head -n 4
"$ADB" -s "$SERIAL" shell am force-stop "$PKG"
"$ADB" -s "$SERIAL" logcat -c
"$ADB" -s "$SERIAL" shell am start -W -n "$PKG/$ACTIVITY"
sleep 2
rm -rf "$OUT"
mkdir -p "$OUT"

capture() {
  local name="$1"
  "$ADB" -s "$SERIAL" exec-out screencap -p > "$OUT/$name.png"
  test -s "$OUT/$name.png"
  file "$OUT/$name.png" | sed "s#^$OUT/##" | sed 's/^/SCREENSHOT=/'
}

capture 01-current
# Navigate only between bottom tabs; no device-control actions.
"$ADB" -s "$SERIAL" shell input tap 405 2200
sleep 1
capture 02-plugs
"$ADB" -s "$SERIAL" shell input tap 675 2200
sleep 1
capture 03-thermometers
"$ADB" -s "$SERIAL" shell input tap 135 2200
sleep 1
capture 04-rules

"$ADB" -s "$SERIAL" logcat -d -t 300 | grep -E 'FATAL EXCEPTION|AndroidRuntime|link.localclimate.app|chromium|Capacitor' > "$OUT/logcat-filtered.txt" || true
if grep -q 'FATAL EXCEPTION' "$OUT/logcat-filtered.txt"; then
  echo "APP_FATAL_EXCEPTION=yes"
  cat "$OUT/logcat-filtered.txt"
  exit 6
fi
echo "APP_FATAL_EXCEPTION=no"
echo "SCREENSHOT_COUNT=$(find "$OUT" -name '*.png' -type f | wc -l | tr -d ' ')"
echo "ANDROID_UX_CAPTURE=passed"
echo "FINAL_HEAD=$(git rev-parse HEAD)"

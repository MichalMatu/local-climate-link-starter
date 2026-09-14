#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
BASE=0fbe83040ae0e41f932bb83a65a8b3438c26ba1b
ADB=/opt/homebrew/bin/adb
SERIAL=RFCT70L7E8J
PKG=link.localclimate.app
ACTIVITY=.MainActivity
OUT=/tmp/lcl-device-ux-android-smoke
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }

[ -x "$ADB" ] || { echo "ADB_MISSING=yes"; exit 3; }
"$ADB" -s "$SERIAL" get-state | grep -qx device || { echo "ANDROID_DEVICE_READY=no"; exit 4; }
echo "ANDROID_DEVICE_READY=yes"
"$ADB" -s "$SERIAL" shell getprop ro.product.model | sed 's/^/ANDROID_MODEL=/'
"$ADB" -s "$SERIAL" shell getprop ro.build.version.release | sed 's/^/ANDROID_VERSION=/'

pnpm --filter @lcl/mobile build
pnpm --filter @lcl/mobile exec cap sync android
(
  cd apps/mobile/android
  ./gradlew assembleDebug
)
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
[ -f "$APK" ] || { echo "APK_MISSING=yes"; exit 5; }

# Preserve current app data: update install only, never uninstall/clear.
"$ADB" -s "$SERIAL" install -r "$APK"
echo "ANDROID_INSTALL_MODE=replace_preserve_data"
"$ADB" -s "$SERIAL" shell am force-stop "$PKG"
"$ADB" -s "$SERIAL" logcat -c
"$ADB" -s "$SERIAL" shell am start -W -n "$PKG/$ACTIVITY"
sleep 2
mkdir -p "$OUT"
"$ADB" -s "$SERIAL" exec-out screencap -p > "$OUT/01-current.png"

# Navigate only between bottom tabs. No relay/device control actions.
# Rules, Plugs, Thermometers, Settings centers on 1080px display.
"$ADB" -s "$SERIAL" shell input tap 405 2200
sleep 1
"$ADB" -s "$SERIAL" exec-out screencap -p > "$OUT/02-plugs.png"
"$ADB" -s "$SERIAL" shell input tap 675 2200
sleep 1
"$ADB" -s "$SERIAL" exec-out screencap -p > "$OUT/03-thermometers.png"
"$ADB" -s "$SERIAL" shell input tap 135 2200
sleep 1
"$ADB" -s "$SERIAL" exec-out screencap -p > "$OUT/04-rules.png"

"$ADB" -s "$SERIAL" shell dumpsys package "$PKG" | grep -E 'versionName=|versionCode=' | head -n 4
"$ADB" -s "$SERIAL" logcat -d -t 250 | grep -E 'FATAL EXCEPTION|AndroidRuntime|link.localclimate.app|chromium|Capacitor' > "$OUT/logcat-filtered.txt" || true
if grep -q 'FATAL EXCEPTION' "$OUT/logcat-filtered.txt"; then
  echo "APP_FATAL_EXCEPTION=yes"
  cat "$OUT/logcat-filtered.txt"
  exit 6
fi
echo "APP_FATAL_EXCEPTION=no"
python3 - <<'PY'
from pathlib import Path
from PIL import Image
out=Path('/tmp/lcl-device-ux-android-smoke')
for path in sorted(out.glob('*.png')):
    with Image.open(path) as im:
        print(f'SCREENSHOT={path.name} {im.width}x{im.height}')
PY

echo "ANDROID_UX_SMOKE=passed"
echo "FINAL_HEAD=$(git rev-parse HEAD)"

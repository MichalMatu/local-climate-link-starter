#!/usr/bin/env sh
set -eu

APP_ID=link.localclimate.app
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

echo '--- PACKAGE ---'
adb -s "$SERIAL" shell dumpsys package "$APP_ID" | grep -E 'versionName=|versionCode=|lastUpdateTime=' | head -n 10 || true

echo '--- FOCUS ---'
adb -s "$SERIAL" shell dumpsys window 2>/dev/null | grep -E 'mCurrentFocus|mFocusedApp' | grep "$APP_ID" | head -n 4 || true

echo '--- UI HIERARCHY ---'
adb -s "$SERIAL" shell uiautomator dump /sdcard/lcl-window.xml >/dev/null 2>&1 || true
adb -s "$SERIAL" shell cat /sdcard/lcl-window.xml 2>/dev/null | tr '>' '>\n' | sed -n '1,240p' || true

echo '--- END ---'

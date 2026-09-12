#!/usr/bin/env sh
set -eu

APP_ID=link.localclimate.app
ARTIFACT_ID=20260912-stage5-ui-audit-initial
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-ui-audit.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-agent-control.XXXXXX)"
cleanup() {
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

command -v adb >/dev/null 2>&1
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
if [ "$COUNT" -ne 1 ]; then
  echo "ANDROID_DEVICE_COUNT=$COUNT"
  adb devices -l
  exit 21
fi
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
MANUFACTURER="$(adb -s "$SERIAL" shell getprop ro.product.manufacturer | tr -d '\r')"
test "$MODEL" = "SM-S906B"
echo "ANDROID_DEVICE_MODEL=$MANUFACTURER $MODEL"

PACKAGE_PATH="$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r')"
test -n "$PACKAGE_PATH"
adb -s "$SERIAL" shell am force-stop "$APP_ID"
adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 2
CURRENT_FOCUS="$(adb -s "$SERIAL" shell dumpsys window 2>/dev/null | grep -E 'mCurrentFocus|mFocusedApp' | grep "$APP_ID" | head -n 1 || true)"
test -n "$CURRENT_FOCUS"

adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/dashboard.png"
adb -s "$SERIAL" shell uiautomator dump /sdcard/lcl-ui.xml >/dev/null
adb -s "$SERIAL" pull /sdcard/lcl-ui.xml "$TMP_DIR/dashboard.xml" >/dev/null
adb -s "$SERIAL" shell wm size > "$TMP_DIR/device.txt"
adb -s "$SERIAL" shell wm density >> "$TMP_DIR/device.txt"
printf '%s\n' "$CURRENT_FOCUS" >> "$TMP_DIR/device.txt"
printf 'PACKAGE_PATH=%s\n' "$PACKAGE_PATH" >> "$TMP_DIR/device.txt"

# Publish read-only audit artifacts on the control branch without touching the app branch.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR/dashboard.png" "$CONTROL_DIR/$ARTIFACT_DIR/dashboard.png"
cp "$TMP_DIR/dashboard.xml" "$CONTROL_DIR/$ARTIFACT_DIR/dashboard.xml"
cp "$TMP_DIR/device.txt" "$CONTROL_DIR/$ARTIFACT_DIR/device.txt"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  if git diff --cached --quiet; then
    echo "AUDIT_ARTIFACTS_UNCHANGED=1"
  else
    git commit -m "Capture Stage 5 initial UI audit" >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  echo "AUDIT_CONTROL_SHA=$(git rev-parse HEAD)"
)

echo "AUDIT_ARTIFACT_ID=$ARTIFACT_ID"
echo "AUDIT_SCREENSHOT=$ARTIFACT_DIR/dashboard.png"
echo "AUDIT_UI_DUMP=$ARTIFACT_DIR/dashboard.xml"
echo STAGE5_UI_AUDIT_INITIAL_CAPTURE=1

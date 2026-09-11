#!/usr/bin/env bash
set -euo pipefail

EXPECTED=885f2ed99bf818da0b38785e9d794dd5e4df8994
PACKAGE=link.localclimate.app
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
ADB="$SDK/platform-tools/adb"

git fetch --prune origin main >/dev/null
test "$(git rev-parse origin/main)" = "$EXPECTED"
if git ls-remote --exit-code origin refs/heads/work/production-readiness-hardening-20260911 >/dev/null 2>&1; then
  echo "work branch unexpectedly exists" >&2
  exit 1
fi

SERIALS="$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" = "1"
SERIAL="$(printf '%s\n' "$SERIALS" | sed '/^$/d')"

"$ADB" -s "$SERIAL" shell pm path "$PACKAGE" | grep -q '^package:'
"$ADB" -s "$SERIAL" shell am force-stop "$PACKAGE"
"$ADB" -s "$SERIAL" shell am start -W -n "$PACKAGE/.MainActivity"
sleep 2
PID="$("$ADB" -s "$SERIAL" shell pidof "$PACKAGE" | tr -d '\r')"
test -n "$PID"

FOREGROUND=0
if "$ADB" -s "$SERIAL" shell dumpsys activity top 2>/dev/null | grep -q "$PACKAGE"; then
  FOREGROUND=1
elif "$ADB" -s "$SERIAL" shell dumpsys window 2>/dev/null | grep -E 'mCurrentFocus|mFocusedApp' | grep -q "$PACKAGE"; then
  FOREGROUND=1
elif "$ADB" -s "$SERIAL" shell dumpsys activity activities 2>/dev/null | grep -E 'ResumedActivity|topResumedActivity|mResumedActivity' | grep -q "$PACKAGE"; then
  FOREGROUND=1
fi
test "$FOREGROUND" = "1"

MODEL="$("$ADB" -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
echo "FINAL_MAIN_SHA=$EXPECTED"
echo "WORK_BRANCH_DELETED=1"
echo "ANDROID_PACKAGE_INSTALLED=1"
echo "ANDROID_MODEL=$MODEL"
echo "ANDROID_PID=$PID"
echo "ANDROID_APP_FOREGROUND=1"
echo "PHONE_SANITY_OK=1"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PACKAGE="link.localclimate.app"
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
ADB="$SDK/platform-tools/adb"
PROPERTIES="$HOME/.local-climate-link/android/alpha-signing.properties"
APK="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"

bash scripts/android/ensure-alpha-signing.sh
[[ -x "$ADB" ]]
[[ -d "$SDK" ]]

pnpm --filter @lcl/mobile build
pnpm --filter @lcl/mobile exec cap sync android
printf 'sdk.dir=%s\n' "$SDK" > apps/mobile/android/local.properties
(
  cd apps/mobile/android
  ./gradlew --no-daemon assembleDebug
)

[[ -f "$APK" ]]
[[ -f "$PROPERTIES" ]]

read_property() {
  local key="$1"
  sed -n "s/^${key}=//p" "$PROPERTIES" | head -1
}

STORE_FILE="$(read_property storeFile)"
STORE_PASSWORD="$(read_property storePassword)"
KEY_ALIAS="$(read_property keyAlias)"
KEY_PASSWORD="$(read_property keyPassword)"
APKSIGNER="$(find "$SDK/build-tools" -maxdepth 2 -type f -name apksigner | sort | tail -1)"

[[ -f "$STORE_FILE" ]]
[[ -x "$APKSIGNER" ]]

KEY_FINGERPRINT="$(keytool -list -v -keystore "$STORE_FILE" -storepass "$STORE_PASSWORD" -alias "$KEY_ALIAS" -keypass "$KEY_PASSWORD" 2>/dev/null | awk '/SHA256:/{print $2; exit}' | tr -d ':' | tr '[:upper:]' '[:lower:]')"
APK_FINGERPRINT="$("$APKSIGNER" verify --print-certs "$APK" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr '[:upper:]' '[:lower:]')"

[[ -n "$KEY_FINGERPRINT" && "$KEY_FINGERPRINT" == "$APK_FINGERPRINT" ]]
printf 'Alpha signer SHA-256: %s\n' "$APK_FINGERPRINT"

SERIALS="$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
if [[ "$COUNT" != "1" ]]; then
  echo "Expected exactly one authorized Android device; found $COUNT." >&2
  "$ADB" devices -l >&2
  exit 1
fi
SERIAL="$(printf '%s\n' "$SERIALS" | sed '/^$/d')"

printf '%s\n' '--- device ---'
"$ADB" -s "$SERIAL" shell getprop ro.product.manufacturer
"$ADB" -s "$SERIAL" shell getprop ro.product.model
"$ADB" -s "$SERIAL" shell getprop ro.build.version.release

printf '%s\n' '--- destructive clean uninstall ---'
UNINSTALL_RC=0
UNINSTALL_OUTPUT="$("$ADB" -s "$SERIAL" uninstall "$PACKAGE" 2>&1)" || UNINSTALL_RC=$?
printf '%s\n' "$UNINSTALL_OUTPUT"
if [[ "$UNINSTALL_RC" -ne 0 ]]; then
  if "$ADB" -s "$SERIAL" shell pm path "$PACKAGE" | grep -q '^package:'; then
    echo "Existing package remains installed after uninstall attempt." >&2
    exit "$UNINSTALL_RC"
  fi
fi

printf '%s\n' '--- install ---'
"$ADB" -s "$SERIAL" install "$APK"
"$ADB" -s "$SERIAL" shell pm path "$PACKAGE"
"$ADB" -s "$SERIAL" shell dumpsys package "$PACKAGE" | grep -E 'versionCode=|versionName=|targetSdk=' | head -10

printf '%s\n' '--- cold start ---'
"$ADB" -s "$SERIAL" shell am force-stop "$PACKAGE"
"$ADB" -s "$SERIAL" logcat -c
"$ADB" -s "$SERIAL" shell am start -W -n "$PACKAGE/.MainActivity"
sleep 2
PID="$("$ADB" -s "$SERIAL" shell pidof "$PACKAGE" | tr -d '\r')"
[[ -n "$PID" ]]
printf 'PID=%s\n' "$PID"
"$ADB" -s "$SERIAL" shell dumpsys activity activities | grep -m1 'mResumedActivity' || true

printf '%s\n' '--- app warnings/errors after cold start ---'
"$ADB" -s "$SERIAL" logcat -d --pid="$PID" -v brief '*:W' | tail -120 || true

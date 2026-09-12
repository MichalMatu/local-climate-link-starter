#!/usr/bin/env sh
set -eu

APP_ID=link.localclimate.app
ARTIFACT_ID=20260912-stage5-ui-audit-secondary-screens
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-cdp-secondary.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-agent-control.XXXXXX)"
PORT=9225
cleanup() {
  adb forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

command -v adb >/dev/null 2>&1
command -v curl >/dev/null 2>&1
command -v node >/dev/null 2>&1
command -v sips >/dev/null 2>&1
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
[ "$COUNT" -eq 1 ] || { echo "ANDROID_DEVICE_COUNT=$COUNT"; exit 21; }
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
[ "$MODEL" = "SM-S906B" ]

# Reuse the already verified CDP helper implementation from this repository.
git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/capture-stage5-major-screens-cdp-20260912.sh > "$TMP_DIR/source.sh"
python3 - "$TMP_DIR/source.sh" "$TMP_DIR/cdp.mjs" <<'PY'
import sys
source=open(sys.argv[1], encoding='utf-8').read()
marker="cat > \"$TMP_DIR/cdp.mjs\" <<'JS'\n"
body=source.split(marker,1)[1].split('\nJS\n',1)[0]
open(sys.argv[2],'w',encoding='utf-8').write(body+'\n')
PY

adb -s "$SERIAL" shell am force-stop "$APP_ID"
adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 2
PID="$(adb -s "$SERIAL" shell pidof "$APP_ID" | tr -d '\r' | awk '{print $1}')"
[ -n "$PID" ]
SOCKET="$(adb -s "$SERIAL" shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | awk '{print $NF}' | sed 's/^@//' | grep "webview_devtools_remote_${PID}$" | head -n 1 || true)"
[ -n "$SOCKET" ]
adb -s "$SERIAL" forward "tcp:$PORT" "localabstract:$SOCKET" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:$PORT/json" > "$TMP_DIR/targets.json"
WS_URL="$(python3 - "$TMP_DIR/targets.json" <<'PY'
import json,sys
for t in json.load(open(sys.argv[1],encoding='utf-8')):
    if t.get('type')=='page' and t.get('webSocketDebuggerUrl'):
        print(t['webSocketDebuggerUrl']); break
PY
)"
[ -n "$WS_URL" ]

cdp() { node "$TMP_DIR/cdp.mjs" "$WS_URL" "$@"; }
wait_selector() { cdp wait-selector "$1" >/dev/null; }
click_selector() { cdp click-selector "$1" "${2:-0}" >/dev/null; sleep 0.55; }
click_text() { cdp click-text "$1" >/dev/null; sleep 0.55; }
capture() {
  name="$1"
  cdp dump > "$TMP_DIR/$name.json"
  adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/$name.png"
  sips -Z 780 -s format jpeg -s formatOptions 62 "$TMP_DIR/$name.png" --out "$TMP_DIR/$name-thumb.jpg" >/dev/null
  [ -s "$TMP_DIR/$name-thumb.jpg" ]
  printf '%s\n' "$name" >> "$TMP_DIR/screens.txt"
}

wait_selector '.dashboard-shell'
# Installed automation detail.
click_selector '.automation-card__menu'
wait_selector '.installation-detail-shell'
capture installation-detail
click_selector '[data-dashboard-kind="climate"]'
wait_selector '.dashboard-shell'

# Enter climate hardware setup.
click_selector '.dashboard-fab'
wait_selector '.intent-shell'
click_selector '.intent-choice' 0
wait_selector '.hardware-shell'

# Shelly BLE scanner task modal.
click_text 'Skanuj termometry BLE przez to gniazdko'
wait_selector '.lcl-modal'
sleep 1
capture setup-shelly-ble-modal
click_selector '.lcl-modal__close'
wait_selector '.setup-top-nav'

# Phone BLE scanner task modal.
click_selector '.setup-top-nav__item' 1
wait_selector '.sensor-setup-panel'
click_text 'Dodaj termometr'
wait_selector '.lcl-modal'
click_text 'Skanuj BLE'
sleep 1
capture setup-sensor-ble-modal
click_selector '.lcl-modal__close'
wait_selector '.sensor-setup-panel'

# Diagnostics screen from the rule developer disclosure.
click_selector '.setup-top-nav__item' 2
sleep 0.4
click_text 'Narzędzia deweloperskie'
click_text 'Otwórz diagnostykę techniczną'
wait_selector '.developer-context'
capture setup-diagnostics

# Time setup path, including schedule screen.
click_selector '[data-dashboard-kind="time"]'
wait_selector '.dashboard-shell'
click_selector '.dashboard-fab'
wait_selector '.intent-shell'
click_selector '.intent-choice' 2
wait_selector '.hardware-shell'
capture setup-time-shelly
click_selector '.setup-top-nav__item' 1
sleep 0.6
capture setup-time-schedule

printf 'APP_PID=%s\nSOCKET=%s\nWS_URL=%s\n' "$PID" "$SOCKET" "$WS_URL" > "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm size >> "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm density >> "$TMP_DIR/meta.txt"

# Publish audit artifacts only on agent-control, retrying a benign concurrent daemon update.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR"/*.json "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-thumb.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR/meta.txt" "$CONTROL_DIR/$ARTIFACT_DIR/meta.txt"
cp "$TMP_DIR/screens.txt" "$CONTROL_DIR/$ARTIFACT_DIR/screens.txt"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  if ! git diff --cached --quiet; then
    git commit -m "Capture Stage 5 secondary UI screens" >/dev/null
    if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
      git fetch origin agent-control >/dev/null
      git rebase origin/agent-control >/dev/null
      git push origin HEAD:agent-control >/dev/null
    fi
  fi
  echo "AUDIT_CONTROL_SHA=$(git rev-parse HEAD)"
)

sed 's/^/CAPTURED_SCREEN=/' "$TMP_DIR/screens.txt"
echo STAGE5_SECONDARY_SCREENS_CDP_CAPTURE=1

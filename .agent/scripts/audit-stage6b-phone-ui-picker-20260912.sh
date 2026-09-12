#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
CANDIDATE=4622d319ed90d1d03cb3eaa40d96fdf6cfa5160e
APP_ID=link.localclimate.app
EXPECTED_MODEL=SM-S906B
ARTIFACT_ID=20260912-stage6b-phone-ui-picker-audit
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-stage6b-audit.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-stage6b-control.XXXXXX)"
PORT=9227
cleanup() {
  adb forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

git fetch --prune origin "$BRANCH" agent-control >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$CANDIDATE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"

command -v adb >/dev/null 2>&1
command -v curl >/dev/null 2>&1
command -v node >/dev/null 2>&1
command -v sips >/dev/null 2>&1
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" -eq 1
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "$EXPECTED_MODEL"
PACKAGE_PATH="$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r')"
test -n "$PACKAGE_PATH"

# Reuse the previously verified CDP helper.
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
test -n "$PID"
SOCKET="$(adb -s "$SERIAL" shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | awk '{print $NF}' | sed 's/^@//' | grep "webview_devtools_remote_${PID}$" | head -n 1 || true)"
test -n "$SOCKET"
adb -s "$SERIAL" forward "tcp:$PORT" "localabstract:$SOCKET" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:$PORT/json" > "$TMP_DIR/targets.json"
WS_URL="$(python3 - "$TMP_DIR/targets.json" <<'PY'
import json,sys
for t in json.load(open(sys.argv[1],encoding='utf-8')):
    if t.get('type')=='page' and t.get('webSocketDebuggerUrl'):
        print(t['webSocketDebuggerUrl']); break
PY
)"
test -n "$WS_URL"

cdp() { node "$TMP_DIR/cdp.mjs" "$WS_URL" "$@"; }
wait_selector() { cdp wait-selector "$1" >/dev/null; }
click_selector() { cdp click-selector "$1" "${2:-0}" >/dev/null; sleep 0.55; }
capture() {
  name="$1"
  cdp dump > "$TMP_DIR/$name.json"
  adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/$name.png"
  sips -Z 780 -s format jpeg -s formatOptions 65 "$TMP_DIR/$name.png" --out "$TMP_DIR/$name-thumb.jpg" >/dev/null
  test -s "$TMP_DIR/$name-thumb.jpg"
  printf '%s\n' "$name" >> "$TMP_DIR/screens.txt"
}

wait_selector '.dashboard-shell'
# Climate setup: Shelly and sensor FABs.
click_selector '.dashboard-fab'
wait_selector '.intent-shell'
click_selector '.intent-choice' 0
wait_selector '.hardware-shell'
wait_selector '.setup-add-fab'
capture climate-shelly
click_selector '.setup-top-nav__item' 1
wait_selector '.sensor-setup-panel'
wait_selector '.setup-add-fab'
capture climate-sensor

# Time setup: Shelly page should have FAB but no BLE affordance.
click_selector '[data-dashboard-kind="time"]'
wait_selector '.dashboard-shell'
click_selector '.dashboard-fab'
wait_selector '.intent-shell'
click_selector '.intent-choice' 2
wait_selector '.hardware-shell'
wait_selector '.setup-add-fab'
capture time-shelly

# Time schedule: two large, non-overlapping controls and no raw URL.
click_selector '.setup-top-nav__item' 1
wait_selector '.time-schedule-grid'
wait_selector '.time-schedule-time-input'
capture time-schedule

python3 - "$TMP_DIR/climate-shelly.json" "$TMP_DIR/climate-sensor.json" "$TMP_DIR/time-shelly.json" "$TMP_DIR/time-schedule.json" <<'PY'
import json, sys
climate_shelly, climate_sensor, time_shelly, schedule = [json.load(open(p, encoding='utf-8')) for p in sys.argv[1:]]

def visible(d, cls):
    return [e for e in d['elements'] if e.get('visible') and cls in (e.get('className') or '').split()]
for name, d in [('climate-shelly', climate_shelly), ('climate-sensor', climate_sensor), ('time-shelly', time_shelly)]:
    fabs=visible(d,'setup-add-fab')
    assert len(fabs)==1, (name, fabs)
    r=fabs[0]['rect']
    assert 50 <= r['width'] <= 64 and 50 <= r['height'] <= 64, (name,r)
    assert r['x'] > d['viewport']['width'] / 2 and r['y'] > d['viewport']['height'] / 2, (name,r,d['viewport'])
assert 'Skanuj termometry BLE przez to gniazdko' in climate_shelly['bodyText']
assert 'Skanuj termometry BLE przez to gniazdko' not in time_shelly['bodyText']
inputs=visible(schedule,'time-schedule-time-input')
assert len(inputs)==2, inputs
inputs=sorted(inputs,key=lambda e:e['rect']['x'])
a,b=inputs
ra,rb=a['rect'],b['rect']
assert ra['width'] >= 130 and rb['width'] >= 130, (ra,rb)
assert ra['height'] >= 52 and rb['height'] >= 52, (ra,rb)
assert ra['x'] + ra['width'] <= rb['x'], (ra,rb)
assert abs(ra['width']-rb['width']) <= 2, (ra,rb)
assert 'http://192.168.' not in schedule['bodyText'], schedule['bodyText']
print('FAB_CLIMATE_SHELLY_RECT='+json.dumps(visible(climate_shelly,'setup-add-fab')[0]['rect'],separators=(',',':')))
print('FAB_CLIMATE_SENSOR_RECT='+json.dumps(visible(climate_sensor,'setup-add-fab')[0]['rect'],separators=(',',':')))
print('FAB_TIME_SHELLY_RECT='+json.dumps(visible(time_shelly,'setup-add-fab')[0]['rect'],separators=(',',':')))
print('TIME_INPUT_1_RECT='+json.dumps(ra,separators=(',',':')))
print('TIME_INPUT_2_RECT='+json.dumps(rb,separators=(',',':')))
print('STAGE6B_DOM_AUDIT=1')
PY

# Trigger the real Android time picker via the first input's existing showPicker() click handler.
click_selector '.time-schedule-time-input' 0
sleep 1
adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/time-picker-native.png"
sips -Z 780 -s format jpeg -s formatOptions 68 "$TMP_DIR/time-picker-native.png" --out "$TMP_DIR/time-picker-native-thumb.jpg" >/dev/null
adb -s "$SERIAL" shell uiautomator dump /sdcard/lcl-stage6b-picker.xml >/dev/null 2>&1 || true
adb -s "$SERIAL" shell cat /sdcard/lcl-stage6b-picker.xml 2>/dev/null | tr -d '\r' > "$TMP_DIR/time-picker-native.xml" || true
test -s "$TMP_DIR/time-picker-native-thumb.jpg"
# Record window focus while picker is visible, then dismiss it safely.
adb -s "$SERIAL" shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | head -n 4 > "$TMP_DIR/time-picker-window.txt" || true
adb -s "$SERIAL" shell input keyevent 4
sleep 0.5

printf 'APP_PID=%s\nSOCKET=%s\nWS_URL=%s\nMODEL=%s\nPACKAGE_PATH=%s\nCANDIDATE=%s\n' "$PID" "$SOCKET" "$WS_URL" "$MODEL" "$PACKAGE_PATH" "$CANDIDATE" > "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm size >> "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm density >> "$TMP_DIR/meta.txt"

# Publish read-only audit evidence on agent-control only.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR"/*.json "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-thumb.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/time-picker-native.xml "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
cp "$TMP_DIR"/time-picker-window.txt "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/meta.txt "$CONTROL_DIR/$ARTIFACT_DIR/meta.txt"
cp "$TMP_DIR"/screens.txt "$CONTROL_DIR/$ARTIFACT_DIR/screens.txt"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  if ! git diff --cached --quiet; then
    git commit -m "Capture Stage 6B phone UI and time picker" >/dev/null
    if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
      git fetch origin agent-control >/dev/null
      git rebase origin/agent-control >/dev/null
      git push origin HEAD:agent-control >/dev/null
    fi
  fi
  echo "AUDIT_CONTROL_SHA=$(git rev-parse HEAD)"
)

sed 's/^/CAPTURED_SCREEN=/' "$TMP_DIR/screens.txt"
echo INSTALLED_CANDIDATE_SHA=$CANDIDATE
echo ANDROID_DEVICE_MODEL=$MODEL
echo STAGE6B_PHONE_UI_PICKER_AUDIT=1

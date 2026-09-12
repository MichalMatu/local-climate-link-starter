#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=4622d319ed90d1d03cb3eaa40d96fdf6cfa5160e
APP_ID=link.localclimate.app
EXPECTED_MODEL=SM-S906B
ARTIFACT_ID=20260912-stage6c-phone-time-picker-audit
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-stage6c.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-stage6c-control.XXXXXX)"
PORT=9228
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
cleanup() {
  adb forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

git fetch --prune origin "$BRANCH" agent-control >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/theme/theme.css')
s=p.read_text(encoding='utf-8')
old='minmax(min(100%, var(--lcl-size-form-column-min)), 1fr)'
new='minmax(min(100%, 8rem), 1fr)'
count=s.count(old)
assert count == 2, f'expected 2 time-grid min patterns, got {count}'
s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
PY

pnpm exec prettier --write apps/mobile/src/theme/theme.css
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile test -- --run
pnpm check

CHANGED="$(git diff --name-only)"
test "$CHANGED" = "apps/mobile/src/theme/theme.css"
git add apps/mobile/src/theme/theme.css
git commit -m "Keep time controls two-column on phones" >/dev/null
CANDIDATE="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = "$BASE"
git push origin "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$CANDIDATE"
test -z "$(git status --porcelain)"
printf 'STAGE6C_SHA=%s\n' "$CANDIDATE"
printf 'STAGE6C_PARENT=%s\n' "$BASE"
printf 'STAGE6C_CHECKS=1\n'

command -v adb >/dev/null 2>&1
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" -eq 1
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "$EXPECTED_MODEL"

SDK_ROOT=""
if [ -d "$HOME/Library/Android/sdk/platforms" ] && [ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]; then
  SDK_ROOT="$HOME/Library/Android/sdk"
else
  ADB_BIN="$(command -v adb)"
  ADB_REAL="$(python3 - "$ADB_BIN" <<'PY'
import os,sys
print(os.path.realpath(sys.argv[1]))
PY
)"
  CAND="$(cd "$(dirname "$ADB_REAL")/.." && pwd -P)"
  if [ -d "$CAND/platforms" ] && [ -d "$CAND/build-tools" ]; then SDK_ROOT="$CAND"; fi
fi
test -n "$SDK_ROOT"
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
printf 'sdk.dir=%s\n' "$SDK_ROOT" > apps/mobile/android/local.properties

pnpm --filter @lcl/mobile build
(
  cd apps/mobile
  pnpm exec cap sync android
  cd android
  ./gradlew assembleDebug
)
test -f "$APK"
adb -s "$SERIAL" install -r "$APK" >/dev/null
adb -s "$SERIAL" shell am force-stop "$APP_ID"
adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 2
PACKAGE_PATH="$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r')"
test -n "$PACKAGE_PATH"
test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"
printf 'INSTALLED_CANDIDATE_SHA=%s\n' "$CANDIDATE"
printf 'ANDROID_DEVICE_MODEL=%s\n' "$MODEL"
printf 'STAGE6C_ANDROID_INSTALL=1\n'

# Reuse the verified CDP helper from the control branch.
git show origin/agent-control:.agent/scripts/capture-stage5-major-screens-cdp-20260912.sh > "$TMP_DIR/source.sh"
python3 - "$TMP_DIR/source.sh" "$TMP_DIR/cdp.mjs" <<'PY'
import sys
source=open(sys.argv[1], encoding='utf-8').read()
marker="cat > \"$TMP_DIR/cdp.mjs\" <<'JS'\n"
body=source.split(marker,1)[1].split('\nJS\n',1)[0]
open(sys.argv[2],'w',encoding='utf-8').write(body+'\n')
PY

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
  sips -Z 320 -s format jpeg -s formatOptions 48 "$TMP_DIR/$name.png" --out "$TMP_DIR/$name-nano.jpg" >/dev/null
  test -s "$TMP_DIR/$name-thumb.jpg"
  test -s "$TMP_DIR/$name-nano.jpg"
}

wait_selector '.dashboard-shell'
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

click_selector '[data-dashboard-kind="time"]'
wait_selector '.dashboard-shell'
click_selector '.dashboard-fab'
wait_selector '.intent-shell'
click_selector '.intent-choice' 2
wait_selector '.hardware-shell'
wait_selector '.setup-add-fab'
capture time-shelly
click_selector '.setup-top-nav__item' 1
wait_selector '.time-schedule-grid'
wait_selector '.time-schedule-time-input'
capture time-schedule

python3 - "$TMP_DIR/climate-shelly.json" "$TMP_DIR/climate-sensor.json" "$TMP_DIR/time-shelly.json" "$TMP_DIR/time-schedule.json" <<'PY'
import json,sys
climate_shelly,climate_sensor,time_shelly,schedule=[json.load(open(p,encoding='utf-8')) for p in sys.argv[1:]]
def visible(d,cls):
    return [e for e in d['elements'] if e.get('visible') and cls in (e.get('className') or '').split()]
for name,d in [('climate-shelly',climate_shelly),('climate-sensor',climate_sensor),('time-shelly',time_shelly)]:
    fabs=visible(d,'setup-add-fab'); assert len(fabs)==1,(name,fabs)
    r=fabs[0]['rect']; assert 50<=r['width']<=64 and 50<=r['height']<=64,(name,r)
    assert r['x']>d['viewport']['width']/2 and r['y']>d['viewport']['height']/2,(name,r,d['viewport'])
assert 'Skanuj termometry BLE przez to gniazdko' in climate_shelly['bodyText']
assert 'Skanuj termometry BLE przez to gniazdko' not in time_shelly['bodyText']
inputs=visible(schedule,'time-schedule-time-input'); assert len(inputs)==2,inputs
inputs=sorted(inputs,key=lambda e:e['rect']['x']); a,b=inputs; ra,rb=a['rect'],b['rect']
assert ra['width']>=130 and rb['width']>=130,(ra,rb)
assert ra['height']>=52 and rb['height']>=52,(ra,rb)
assert abs(ra['y']-rb['y'])<=2,(ra,rb)
assert ra['x']+ra['width']<=rb['x'],(ra,rb)
assert abs(ra['width']-rb['width'])<=2,(ra,rb)
assert 'http://192.168.' not in schedule['bodyText'],schedule['bodyText']
print('TIME_INPUT_1_RECT='+json.dumps(ra,separators=(',',':')))
print('TIME_INPUT_2_RECT='+json.dumps(rb,separators=(',',':')))
print('STAGE6C_DOM_AUDIT=1')
PY

# Open and capture the actual Android time picker.
click_selector '.time-schedule-time-input' 0
sleep 1
adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/time-picker-native.png"
sips -Z 780 -s format jpeg -s formatOptions 68 "$TMP_DIR/time-picker-native.png" --out "$TMP_DIR/time-picker-native-thumb.jpg" >/dev/null
sips -Z 320 -s format jpeg -s formatOptions 50 "$TMP_DIR/time-picker-native.png" --out "$TMP_DIR/time-picker-native-nano.jpg" >/dev/null
adb -s "$SERIAL" shell uiautomator dump /sdcard/lcl-stage6c-picker.xml >/dev/null 2>&1 || true
adb -s "$SERIAL" shell cat /sdcard/lcl-stage6c-picker.xml 2>/dev/null | tr -d '\r' > "$TMP_DIR/time-picker-native.xml" || true
adb -s "$SERIAL" shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | head -n 4 > "$TMP_DIR/time-picker-window.txt" || true
test -s "$TMP_DIR/time-picker-native-thumb.jpg"
test -s "$TMP_DIR/time-picker-native-nano.jpg"
adb -s "$SERIAL" shell input keyevent 4
sleep 0.4

printf 'APP_PID=%s\nSOCKET=%s\nWS_URL=%s\nMODEL=%s\nPACKAGE_PATH=%s\nCANDIDATE=%s\n' "$PID" "$SOCKET" "$WS_URL" "$MODEL" "$PACKAGE_PATH" "$CANDIDATE" > "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm size >> "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm density >> "$TMP_DIR/meta.txt"

# Publish read-only evidence on agent-control only.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR"/*.json "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-thumb.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-nano.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/time-picker-native.xml "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
cp "$TMP_DIR"/time-picker-window.txt "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/meta.txt "$CONTROL_DIR/$ARTIFACT_DIR/meta.txt"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  git commit -m "Capture Stage 6C phone time picker audit" >/dev/null
  if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
    git fetch origin agent-control >/dev/null
    git rebase origin/agent-control >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  echo "AUDIT_CONTROL_SHA=$(git rev-parse HEAD)"
)

echo STAGE6C_PHONE_UI_PICKER_AUDIT=1

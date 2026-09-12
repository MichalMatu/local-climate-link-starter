#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
CANDIDATE=18dd578a7252d8b96b4c9bd8952070a63ccc1fb8
APP_ID=link.localclimate.app
EXPECTED_MODEL=SM-S906B
ARTIFACT_ID=20260912-stage6e2-wheel-picker-audit
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-stage6e2.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-stage6e2-control.XXXXXX)"
PORT=9231
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
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" -eq 1
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "$EXPECTED_MODEL"
test -n "$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r')"

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

# Reuse the known-good CDP helper used by earlier mobile audits.
git show origin/agent-control:.agent/scripts/capture-stage5-major-screens-cdp-20260912.sh > "$TMP_DIR/source.sh"
python3 - "$TMP_DIR/source.sh" "$TMP_DIR/cdp.mjs" <<'PY'
import sys
source=open(sys.argv[1], encoding='utf-8').read()
marker='cat > "$TMP_DIR/cdp.mjs" <<\'JS\'\n'
body=source.split(marker,1)[1].split('\nJS\n',1)[0]
open(sys.argv[2],'w',encoding='utf-8').write(body+'\n')
PY
cdp() { node "$TMP_DIR/cdp.mjs" "$WS_URL" "$@"; }
wait_selector() { cdp wait-selector "$1" >/dev/null; }
click_selector() { cdp click-selector "$1" "${2:-0}" >/dev/null; sleep 0.55; }
capture() {
  name="$1"
  cdp dump > "$TMP_DIR/$name.json"
  adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/$name.png"
  sips -Z 780 -s format jpeg -s formatOptions 68 "$TMP_DIR/$name.png" --out "$TMP_DIR/$name-thumb.jpg" >/dev/null
  sips -Z 320 -s format jpeg -s formatOptions 50 "$TMP_DIR/$name.png" --out "$TMP_DIR/$name-nano.jpg" >/dev/null
}

wait_selector '.dashboard-shell'
click_selector '[data-dashboard-kind="time"]'
wait_selector '.dashboard-shell'
click_selector '.dashboard-fab'
wait_selector '.intent-shell'
click_selector '.intent-choice' 2
wait_selector '.hardware-shell'
click_selector '.setup-top-nav__item' 1
wait_selector '.time-schedule-grid'
wait_selector '.time-schedule-time-input'
capture schedule-before-wheel

click_selector '.time-schedule-time-input' 0
wait_selector '[data-time-wheel-picker]'
sleep 0.5
capture wheel-open
adb -s "$SERIAL" shell uiautomator dump /sdcard/lcl-stage6e2-wheel.xml >/dev/null 2>&1 || true
adb -s "$SERIAL" shell cat /sdcard/lcl-stage6e2-wheel.xml 2>/dev/null | tr -d '\r' > "$TMP_DIR/wheel-native.xml" || true
! grep -q 'android.widget.TimePicker' "$TMP_DIR/wheel-native.xml"

click_selector '[data-wheel-hour="09"]'
click_selector '[data-wheel-minute="30"]'
sleep 0.25
capture wheel-selected
click_selector '.lcl-modal__footer .primary-action'
wait_selector '.time-schedule-grid'
sleep 0.4
capture schedule-after-wheel

python3 - "$TMP_DIR/schedule-before-wheel.json" "$TMP_DIR/wheel-open.json" "$TMP_DIR/wheel-selected.json" "$TMP_DIR/schedule-after-wheel.json" <<'PY'
import json,sys
before,wheel,selected,after=[json.load(open(p,encoding='utf-8')) for p in sys.argv[1:]]
def visible(d,cls):
    return [e for e in d['elements'] if e.get('visible') and cls in (e.get('className') or '').split()]
inputs=visible(before,'time-schedule-time-input')
assert len(inputs)==2,inputs
inputs=sorted(inputs,key=lambda e:e['rect']['x'])
a,b=inputs
assert abs(a['rect']['y']-b['rect']['y'])<=2,(a['rect'],b['rect'])
assert a['rect']['width']>=130 and b['rect']['width']>=130,(a['rect'],b['rect'])
assert 'http://192.168.' not in before['bodyText'],before['bodyText']
assert 'Wybierz' in wheel['bodyText'] and 'HH' in wheel['bodyText'] and 'MM' in wheel['bodyText'],wheel['bodyText']
selected_buttons=[e for e in selected['elements'] if e.get('visible') and 'time-wheel-option' in (e.get('className') or '').split() and e.get('ariaPressed')=='true']
selected_texts=sorted([e.get('text') for e in selected_buttons])
assert selected_texts==['09','30'],selected_texts
after_inputs=visible(after,'time-schedule-time-input')
assert len(after_inputs)==2,after_inputs
texts=[e.get('text') for e in sorted(after_inputs,key=lambda e:e['rect']['x'])]
assert texts[0]=='09:30',texts
print('STAGE6E2_DOM_AUDIT=1')
print('WHEEL_SELECTED='+json.dumps(selected_texts,separators=(',',':')))
print('TIME_BUTTONS='+json.dumps(texts,separators=(',',':')))
print('TIME_INPUT_RECTS='+json.dumps([a['rect'],b['rect']],separators=(',',':')))
PY

printf 'MODEL=%s\nCANDIDATE=%s\nAPP_PID=%s\nSOCKET=%s\nWS_URL=%s\n' "$MODEL" "$CANDIDATE" "$PID" "$SOCKET" "$WS_URL" > "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm size >> "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm density >> "$TMP_DIR/meta.txt"

# Publish only audit evidence on agent-control; application branch remains untouched.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR"/*.json "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-thumb.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-nano.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR/wheel-native.xml" "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
cp "$TMP_DIR/meta.txt" "$CONTROL_DIR/$ARTIFACT_DIR/meta.txt"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  git commit -m "Capture corrected Stage 6E wheel audit" >/dev/null
  if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
    git fetch origin agent-control >/dev/null
    git rebase origin/agent-control >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  echo AUDIT_CONTROL_SHA=$(git rev-parse HEAD)
)

test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"
echo STAGE6E2_WHEEL_PICKER_AUDIT=1

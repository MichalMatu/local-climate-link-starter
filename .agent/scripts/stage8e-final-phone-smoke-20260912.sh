#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
CANDIDATE='8173f0851adc77222fc3e98b02113ff28f7119fd'
APP_ID='link.localclimate.app'
EXPECTED_MODEL='SM-S906B'
ARTIFACT_ID='20260912-stage8e-final-phone-smoke'
ARTIFACT_DIR=".agent/artifacts/$ARTIFACT_ID"
TMP_DIR="$(mktemp -d /tmp/lcl-stage8e-phone.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-stage8e-control.XXXXXX)"
PORT=9231

cleanup() {
  adb forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

git fetch --prune origin "$BRANCH" agent-control >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$CANDIDATE"
git reset --hard >/dev/null
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"

command -v adb >/dev/null
command -v curl >/dev/null
command -v node >/dev/null
command -v sips >/dev/null
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" -eq 1
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "$EXPECTED_MODEL"

# Build, clean-install and cold-start the exact audited candidate using the repository's
# signer/device install path. This intentionally creates a deterministic empty-app smoke state.
pnpm android:phone-alpha | tee "$TMP_DIR/install.log"
test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"
PACKAGE_PATH="$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r')"
test -n "$PACKAGE_PATH"
adb -s "$SERIAL" shell dumpsys package "$APP_ID" > "$TMP_DIR/package.txt"
grep -q 'versionName=2.0.10' "$TMP_DIR/package.txt"

# Reuse the already verified CDP helper used by earlier physical UI audits.
git show origin/agent-control:.agent/scripts/capture-stage5-major-screens-cdp-20260912.sh > "$TMP_DIR/source.sh"
python3 - "$TMP_DIR/source.sh" "$TMP_DIR/cdp.mjs" <<'PY'
import sys
source=open(sys.argv[1], encoding='utf-8').read()
marker='cat > "$TMP_DIR/cdp.mjs" <<\'JS\'\n'
if marker not in source:
    raise SystemExit('verified CDP helper marker missing')
body=source.split(marker,1)[1].split('\nJS\n',1)[0]
open(sys.argv[2],'w',encoding='utf-8').write(body+'\n')
PY

adb -s "$SERIAL" shell am force-stop "$APP_ID"
adb -s "$SERIAL" logcat -c
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
click_selector() { cdp click-selector "$1" "${2:-0}" >/dev/null; sleep 0.6; }
capture() {
  name="$1"
  cdp dump > "$TMP_DIR/$name.json"
  adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/$name.png"
  sips -Z 780 -s format jpeg -s formatOptions 68 "$TMP_DIR/$name.png" --out "$TMP_DIR/$name-thumb.jpg" >/dev/null
  test -s "$TMP_DIR/$name-thumb.jpg"
  printf '%s\n' "$name" >> "$TMP_DIR/screens.txt"
}

wait_selector '.dashboard-shell'
capture dashboard-clean
click_selector '.dashboard-fab'
wait_selector '.intent-shell'
capture climate-intent
click_selector '.intent-choice' 0
wait_selector '.hardware-shell'
wait_selector '.setup-context__back'
capture climate-setup
click_selector '.setup-context__back'
wait_selector '.intent-shell'
click_selector '[data-dashboard-kind="time"]'
wait_selector '.dashboard-shell'
click_selector '.dashboard-fab'
wait_selector '.hardware-shell'
wait_selector '.setup-context__back'
capture time-setup-direct
click_selector '.setup-top-nav__item' 1
wait_selector '.time-schedule-grid'
wait_selector '.time-schedule-time-input'
capture time-schedule
click_selector '.time-schedule-time-input' 0
wait_selector '[data-time-wheel-picker]'
capture time-picker

python3 - \
  "$TMP_DIR/dashboard-clean.json" \
  "$TMP_DIR/climate-intent.json" \
  "$TMP_DIR/climate-setup.json" \
  "$TMP_DIR/time-setup-direct.json" \
  "$TMP_DIR/time-schedule.json" \
  "$TMP_DIR/time-picker.json" <<'PY'
import json,sys
names=['dashboard','climate_intent','climate_setup','time_setup','schedule','picker']
data=dict(zip(names,[json.load(open(p,encoding='utf-8')) for p in sys.argv[1:]]))

def body(name): return data[name].get('bodyText','')
def visible(d, cls):
    return [e for e in d.get('elements',[]) if e.get('visible') and cls in (e.get('className') or '').split()]

assert 'Twoje automatyki' in body('dashboard'), body('dashboard')
assert 'Klimat' in body('dashboard') and 'Czas' in body('dashboard'), body('dashboard')
assert len(visible(data['dashboard'],'dashboard-fab')) == 1

intent=body('climate_intent')
assert 'Co chcesz zrobić?' in intent, intent
assert 'Sterować temperaturą' in intent and 'Sterować wilgotnością' in intent, intent
assert 'Sterować według czasu' not in intent, intent

climate=body('climate_setup')
assert 'Zmień cel' in climate, climate
assert 'Anuluj' not in visible(data['climate_setup'],'setup-context__back')[0].get('text','')

time_setup=body('time_setup')
assert 'Anuluj' in time_setup, time_setup
assert 'Zmień cel' not in visible(data['time_setup'],'setup-context__back')[0].get('text','')
assert 'Co chcesz zrobić?' not in time_setup, time_setup
assert 'Termometry' not in [e.get('text','') for e in visible(data['time_setup'],'setup-top-nav__item')]

schedule=body('schedule')
assert 'Ustaw godziny ON i OFF' in schedule, schedule
assert 'http://192.168.' not in schedule, schedule
inputs=visible(data['schedule'],'time-schedule-time-input')
assert len(inputs)==2, inputs
assert all(e['rect']['height'] >= 48 for e in inputs), inputs

picker=body('picker')
assert visible(data['picker'],'time-wheel-picker'), picker
assert 'HH' in picker and 'MM' in picker, picker
assert 'Wybierz' in picker and 'Anuluj' in picker, picker
print('FINAL_PHONE_DOM_SMOKE=1')
PY

adb -s "$SERIAL" shell dumpsys activity activities | grep -m1 'mResumedActivity' > "$TMP_DIR/resumed.txt" || true
adb -s "$SERIAL" logcat -d --pid="$PID" -v brief '*:W' > "$TMP_DIR/app-warnings.log" || true
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime.*FATAL|chromium.*(uncaught|fatal)' "$TMP_DIR/app-warnings.log"; then
  cat "$TMP_DIR/app-warnings.log"
  exit 1
fi

printf 'CANDIDATE=%s\nMODEL=%s\nSERIAL=%s\nPACKAGE_PATH=%s\nPID=%s\n' \
  "$CANDIDATE" "$MODEL" "$SERIAL" "$PACKAGE_PATH" "$PID" > "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm size >> "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm density >> "$TMP_DIR/meta.txt"

# Publish physical audit evidence on agent-control only; never modify the app branch.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR"/*.json "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
cp "$TMP_DIR"/*-thumb.jpg "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
cp "$TMP_DIR"/meta.txt "$TMP_DIR/package.txt" "$TMP_DIR/install.log" "$TMP_DIR/resumed.txt" "$TMP_DIR/app-warnings.log" "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  if ! git diff --cached --quiet; then
    git commit -m 'Capture final Samsung phone smoke audit' >/dev/null
    if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
      git fetch origin agent-control >/dev/null
      git rebase origin/agent-control >/dev/null
      git push origin HEAD:agent-control >/dev/null
    fi
  fi
  echo "AUDIT_CONTROL_SHA=$(git rev-parse HEAD)"
)

sed 's/^/CAPTURED_SCREEN=/' "$TMP_DIR/screens.txt"
echo FINAL_PHONE_CANDIDATE="$CANDIDATE"
echo FINAL_PHONE_MODEL="$MODEL"
echo FINAL_PHONE_VERSION=2.0.10
echo FINAL_PHONE_INSTALL=1
echo FINAL_PHONE_SMOKE=1
test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"

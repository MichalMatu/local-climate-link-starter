#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=ac299278e796b4d359ffb6a0b514cc9a074590ec
APP_ID=link.localclimate.app
EXPECTED_MODEL=SM-S906B
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
ARTIFACT_ID=20260912-stage6e-wheel-centering-audit
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-stage6e.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-stage6e-control.XXXXXX)"
PORT=9230
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
p=Path('apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx')
s=p.read_text(encoding='utf-8')
old="""  wheel.scrollTo({
    top: option.offsetTop - (wheel.clientHeight - option.clientHeight) / 2,
    behavior
  });
"""
new="""  const optionRect = option.getBoundingClientRect();
  const wheelRect = wheel.getBoundingClientRect();
  wheel.scrollTo({
    top:
      wheel.scrollTop +
      optionRect.top -
      wheelRect.top -
      (wheel.clientHeight - optionRect.height) / 2,
    behavior
  });
"""
assert old in s, 'old wheel centering code missing'
s=s.replace(old,new,1)
old2="centerWheelOption(kind, value, 'smooth');"
assert old2 in s, 'smooth click centering call missing'
s=s.replace(old2,'centerWheelOption(kind, value);',1)
p.write_text(s,encoding='utf-8')
PY

pnpm exec prettier --write apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile test -- --run
pnpm check

CHANGED="$(git diff --name-only)"
test "$CHANGED" = "apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx"
grep -q 'wheel.scrollTop +' apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
! grep -q "centerWheelOption(kind, value, 'smooth')" apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx

git add apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
git commit -m "Fix wheel time selection centering" >/dev/null
CANDIDATE="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = "$BASE"
git push origin "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$CANDIDATE"
test -z "$(git status --porcelain)"
echo STAGE6E_SHA=$CANDIDATE
echo STAGE6E_PARENT=$BASE
echo STAGE6E_CHECKS=1

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
  ADB_REAL="$(python3 - "$(command -v adb)" <<'PY'
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
test -n "$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r')"
test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"
echo INSTALLED_CANDIDATE_SHA=$CANDIDATE
echo ANDROID_DEVICE_MODEL=$MODEL
echo STAGE6E_ANDROID_INSTALL=1

# Reuse the verified CDP helper.
git fetch origin agent-control >/dev/null
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
adb -s "$SERIAL" shell uiautomator dump /sdcard/lcl-stage6e-wheel.xml >/dev/null 2>&1 || true
adb -s "$SERIAL" shell cat /sdcard/lcl-stage6e-wheel.xml 2>/dev/null | tr -d '\r' > "$TMP_DIR/wheel-native.xml" || true
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
selected_buttons=[e for e in selected['elements'] if e.get('visible') and 'time-wheel-option' in (e.get('className') or '').split() and e.get('attrs',{}).get('aria-pressed')=='true']
selected_texts=sorted([e.get('text') for e in selected_buttons])
assert selected_texts==['09','30'],selected_texts
after_inputs=visible(after,'time-schedule-time-input')
assert len(after_inputs)==2,after_inputs
texts=[e.get('text') for e in sorted(after_inputs,key=lambda e:e['rect']['x'])]
assert texts[0]=='09:30',texts
print('STAGE6E_DOM_AUDIT=1')
print('WHEEL_SELECTED='+json.dumps(selected_texts,separators=(',',':')))
print('TIME_BUTTONS='+json.dumps(texts,separators=(',',':')))
PY

printf 'MODEL=%s\nCANDIDATE=%s\nAPP_PID=%s\nSOCKET=%s\nWS_URL=%s\n' "$MODEL" "$CANDIDATE" "$PID" "$SOCKET" "$WS_URL" > "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm size >> "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm density >> "$TMP_DIR/meta.txt"

# Publish visual evidence only to agent-control.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR"/*.json "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-thumb.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-nano.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/wheel-native.xml "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
cp "$TMP_DIR"/meta.txt "$CONTROL_DIR/$ARTIFACT_DIR/meta.txt"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  git commit -m "Capture Stage 6E wheel picker audit" >/dev/null
  if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
    git fetch origin agent-control >/dev/null
    git rebase origin/agent-control >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  echo AUDIT_CONTROL_SHA=$(git rev-parse HEAD)
)

echo STAGE6E_WHEEL_PICKER_AUDIT=1

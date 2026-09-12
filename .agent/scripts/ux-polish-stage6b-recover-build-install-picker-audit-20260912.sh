#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=a7b08d97f88750247823d8393ed53a26c90034d9
APP_ID=link.localclimate.app
ARTIFACT_ID=20260912-stage6b-time-picker-audit
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-stage6b-picker.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-stage6b-control.XXXXXX)"
PORT=9227
cleanup() {
  adb forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

git fetch --prune origin "$BRANCH" agent-control
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

# Reuse the exact Stage 6B implementation, changing only the grid form required by the UX gate.
git show origin/agent-control:.agent/scripts/ux-polish-stage6b-fab-time-input-20260912.sh > "$TMP_DIR/stage6b.sh"
python3 - "$TMP_DIR/stage6b.sh" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text()
old='    ".time-schedule-grid {\\n  display: grid;\\n  gap: var(--lcl-spacing-md);\\n  grid-template-columns: repeat(2, minmax(0, 1fr));\\n}\\n\\n.time-schedule-grid .field-stack {'
new='    ".time-schedule-grid {\\n  display: grid;\\n  gap: var(--lcl-spacing-md);\\n  grid-template-columns: repeat(\\n    auto-fit,\\n    minmax(min(100%, var(--lcl-size-form-column-min)), 1fr)\\n  );\\n}\\n\\n.time-schedule-grid .field-stack {'
if s.count(old) != 1:
    raise SystemExit(f'expected one Stage 6B fixed-grid replacement, got {s.count(old)}')
p.write_text(s.replace(old,new,1))
PY
sh "$TMP_DIR/stage6b.sh"

SHA="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = "$BASE"
test -z "$(git status --porcelain)"
printf 'STAGE6B_RECOVERED_SHA=%s\n' "$SHA"

# Audit the installed build and native time picker on the physical Samsung.
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
test "$MODEL" = "SM-S906B"

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

git show origin/agent-control:.agent/scripts/capture-stage5-major-screens-cdp-20260912.sh > "$TMP_DIR/source.sh"
python3 - "$TMP_DIR/source.sh" "$TMP_DIR/cdp.mjs" <<'PY'
import sys
source=open(sys.argv[1],encoding='utf-8').read()
marker='cat > "$TMP_DIR/cdp.mjs" <<\'JS\'\n'
body=source.split(marker,1)[1].split('\nJS\n',1)[0]
open(sys.argv[2],'w',encoding='utf-8').write(body+'\n')
PY
cdp() { node "$TMP_DIR/cdp.mjs" "$WS_URL" "$@"; }
cdp wait-selector '.dashboard-shell' >/dev/null
cdp click-selector '[data-dashboard-kind="time"]' 0 >/dev/null
sleep 0.5
cdp click-selector '.dashboard-fab' 0 >/dev/null
sleep 0.5
cdp wait-selector '.intent-shell' >/dev/null
cdp click-selector '.intent-choice' 2 >/dev/null
sleep 0.5
cdp wait-selector '.hardware-shell' >/dev/null
cdp click-selector '.setup-top-nav__item' 1 >/dev/null
sleep 0.7
cdp wait-selector '.time-schedule-time-input' >/dev/null
cdp dump > "$TMP_DIR/time-schedule.json"
adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/time-schedule.png"
sips -Z 900 -s format jpeg -s formatOptions 70 "$TMP_DIR/time-schedule.png" --out "$TMP_DIR/time-schedule-thumb.jpg" >/dev/null

# Open the first time field with a real touchscreen tap based on its DOM geometry.
INPUT_RECT="$(node "$TMP_DIR/cdp.mjs" "$WS_URL" dump | python3 -c 'import json,sys; d=json.load(sys.stdin); e=next(x for x in d["elements"] if "time-schedule-time-input" in x.get("className", "")); r=e["rect"]; print(f"{r[\"x\"]+r[\"width\"]//2} {r[\"y\"]+r[\"height\"]//2}")')"
X="$(printf '%s' "$INPUT_RECT" | awk '{print $1}')"
Y="$(printf '%s' "$INPUT_RECT" | awk '{print $2}')"
DPR="$(python3 - "$TMP_DIR/time-schedule.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))['viewport']['dpr'])
PY
)"
PX="$(python3 - "$X" "$DPR" <<'PY'
import sys
print(round(float(sys.argv[1])*float(sys.argv[2])))
PY
)"
PYV="$(python3 - "$Y" "$DPR" <<'PY'
import sys
print(round(float(sys.argv[1])*float(sys.argv[2])))
PY
)"
adb -s "$SERIAL" shell input tap "$PX" "$PYV"
sleep 1
adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/time-picker-open.png"
sips -Z 900 -s format jpeg -s formatOptions 72 "$TMP_DIR/time-picker-open.png" --out "$TMP_DIR/time-picker-open-thumb.jpg" >/dev/null
adb -s "$SERIAL" shell uiautomator dump /sdcard/lcl-time-picker.xml >/dev/null 2>&1 || true
adb -s "$SERIAL" shell cat /sdcard/lcl-time-picker.xml > "$TMP_DIR/time-picker-open.xml" 2>/dev/null || true

printf 'STAGE6B_SHA=%s\nANDROID_DEVICE_MODEL=%s\nINPUT_TAP_PX=%s\nINPUT_TAP_PY=%s\n' "$SHA" "$MODEL" "$PX" "$PYV" > "$TMP_DIR/meta.txt"

# Publish read-only audit artifacts to agent-control with one retry on benign branch races.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR/time-schedule.json" "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR/time-schedule-thumb.jpg" "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR/time-picker-open-thumb.jpg" "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR/time-picker-open.xml" "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
cp "$TMP_DIR/meta.txt" "$CONTROL_DIR/$ARTIFACT_DIR/"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  if ! git diff --cached --quiet; then
    git commit -m "Capture Stage 6B time picker audit" >/dev/null
    if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
      git fetch origin agent-control >/dev/null
      git rebase origin/agent-control >/dev/null
      git push origin HEAD:agent-control >/dev/null
    fi
  fi
  printf 'AUDIT_CONTROL_SHA=%s\n' "$(git rev-parse HEAD)"
)
printf 'STAGE6B_PICKER_AUDIT=1\n'

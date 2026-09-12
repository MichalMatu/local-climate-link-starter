#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=a7b08d97f88750247823d8393ed53a26c90034d9
APP_ID=link.localclimate.app
ARTIFACT_ID=20260912-stage6b-picker-audit
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-stage6b-final.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-stage6b-control.XXXXXX)"
PORT=9227
cleanup() {
  adb forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

git fetch --prune origin "$BRANCH" agent-control
git checkout "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$BASE"

# A previous failed Stage 6B attempt can leave only our six expected files dirty.
if test -n "$(git status --porcelain)"; then
  CHANGED="$(git diff --name-only | sort)"
  EXPECTED="apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx
apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx
apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
apps/mobile/src/theme/theme.css"
  test "$CHANGED" = "$EXPECTED"
  grep -q 'setup-add-fab' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
  grep -q 'time-schedule-time-input' apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
  git reset --hard HEAD
fi
test -z "$(git status --porcelain)"

# Reuse the already reviewed Stage 6B transformation, patching the two discovered guard/type issues.
git show origin/agent-control:.agent/scripts/ux-polish-stage6b-fab-time-input-20260912.sh > "$TMP_DIR/stage6b.sh"
python3 - "$TMP_DIR/stage6b.sh" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text()
old='    "            onBleScan={enableBleDiscovery ? openBleScanModal : undefined}",\n'
new='    "            {...(enableBleDiscovery ? { onBleScan: openBleScanModal } : {})}",\n'
if old not in s:
    raise SystemExit('missing onBleScan replacement target')
s=s.replace(old,new,1)
old='    ".time-schedule-grid {\\n  display: grid;\\n  gap: var(--lcl-spacing-md);\\n  grid-template-columns: repeat(2, minmax(0, 1fr));\\n}\\n\\n.time-schedule-grid .field-stack {'
new='    ".time-schedule-grid {\\n  display: grid;\\n  gap: var(--lcl-spacing-md);\\n  grid-template-columns: repeat(\\n    auto-fit,\\n    minmax(min(100%, var(--lcl-size-form-column-min)), 1fr)\\n  );\\n}\\n\\n.time-schedule-grid .field-stack {'
if old not in s:
    raise SystemExit('missing time grid replacement target')
s=s.replace(old,new,1)
p.write_text(s)
PY
sh "$TMP_DIR/stage6b.sh"

SHA="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$SHA"
test -z "$(git status --porcelain)"

# Physical Samsung audit of the installed exact SHA and native time picker.
command -v adb >/dev/null
command -v curl >/dev/null
command -v node >/dev/null
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" -eq 1
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "SM-S906B"

# Extract the known-good CDP helper from the Stage 5 audit script.
git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/capture-stage5-major-screens-cdp-20260912.sh > "$TMP_DIR/source.sh"
python3 - "$TMP_DIR/source.sh" "$TMP_DIR/cdp.mjs" <<'PY'
import sys
source=open(sys.argv[1], encoding='utf-8').read()
marker='cat > "$TMP_DIR/cdp.mjs" <<\'JS\'\n'
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
cdp wait-selector '.dashboard-shell' >/dev/null
cdp click-selector '[data-dashboard-kind="time"]' 0 >/dev/null
sleep 0.4
cdp click-selector '.dashboard-fab' 0 >/dev/null
cdp wait-selector '.intent-shell' >/dev/null
cdp click-selector '.intent-choice' 2 >/dev/null
cdp wait-selector '.hardware-shell' >/dev/null
cdp click-selector '.setup-top-nav__item' 1 >/dev/null
cdp wait-selector '.time-schedule-time-input' >/dev/null
sleep 0.5
cdp dump > "$TMP_DIR/schedule-before-picker.json"
adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/schedule-before-picker.png"
cdp click-selector '.time-schedule-time-input' 0 >/dev/null
sleep 1
adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/time-picker-open.png"
adb -s "$SERIAL" shell uiautomator dump /sdcard/lcl-picker.xml >/dev/null 2>&1 || true
adb -s "$SERIAL" pull /sdcard/lcl-picker.xml "$TMP_DIR/time-picker-open.xml" >/dev/null 2>&1 || true
adb -s "$SERIAL" shell dumpsys window | grep -m1 'mCurrentFocus' > "$TMP_DIR/focus.txt" || true
printf 'STAGE6B_SHA=%s\nANDROID_MODEL=%s\n' "$SHA" "$MODEL" > "$TMP_DIR/meta.txt"

# Publish audit-only artifacts on agent-control.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR/schedule-before-picker.json" "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR/schedule-before-picker.png" "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR/time-picker-open.png" "$CONTROL_DIR/$ARTIFACT_DIR/"
if test -s "$TMP_DIR/time-picker-open.xml"; then cp "$TMP_DIR/time-picker-open.xml" "$CONTROL_DIR/$ARTIFACT_DIR/"; fi
cp "$TMP_DIR/focus.txt" "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR/meta.txt" "$CONTROL_DIR/$ARTIFACT_DIR/"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  git commit -m "Capture Stage 6B time picker audit" >/dev/null
  if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
    git fetch origin agent-control >/dev/null
    git rebase origin/agent-control >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  printf 'AUDIT_CONTROL_SHA=%s\n' "$(git rev-parse HEAD)"
)
printf 'STAGE6B_FINAL_SHA=%s\n' "$SHA"
printf 'STAGE6B_PICKER_AUDIT=1\n'

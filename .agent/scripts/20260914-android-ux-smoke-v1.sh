#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=931d59e1a319e9e5fc111b840baf248e995e239e
PACKAGE=link.localclimate.app
SERIAL=RFCT70L7E8J
ADB=/opt/homebrew/bin/adb
ARTIFACT_REF=agent-artifacts/android-ux-20260914-931d59e1
TMP=/tmp/lcl-android-ux-931d59e1

cd "$REPO"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

[[ -x "$ADB" ]] || { echo "ADB missing: $ADB"; exit 4; }
"$ADB" devices -l
[[ "$("$ADB" -s "$SERIAL" get-state 2>/dev/null || true)" == "device" ]] || { echo "Expected Samsung device $SERIAL"; exit 5; }
MODEL="$("$ADB" -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
[[ "$MODEL" == "SM-S906B" ]] || { echo "Unexpected model: $MODEL"; exit 6; }

rm -rf "$TMP"
mkdir -p "$TMP"

bash scripts/android/phone-alpha-install.sh

capture() {
  local name="$1"
  "$ADB" -s "$SERIAL" exec-out screencap -p > "$TMP/${name}.png"
  "$ADB" -s "$SERIAL" shell uiautomator dump /sdcard/lcl-window.xml >/dev/null
  "$ADB" -s "$SERIAL" exec-out cat /sdcard/lcl-window.xml > "$TMP/${name}.xml"
  printf 'captured %s\n' "$name"
}

click_label() {
  local labels="$1"
  local xml="$TMP/current.xml"
  "$ADB" -s "$SERIAL" shell uiautomator dump /sdcard/lcl-window.xml >/dev/null
  "$ADB" -s "$SERIAL" exec-out cat /sdcard/lcl-window.xml > "$xml"
  local point
  point="$(python3 - "$xml" "$labels" <<'PY'
import re, sys, xml.etree.ElementTree as ET
path, raw = sys.argv[1], sys.argv[2]
labels = [x.strip().casefold() for x in raw.split('|') if x.strip()]
root = ET.parse(path).getroot()
for node in root.iter('node'):
    hay = ' '.join([node.attrib.get('text',''), node.attrib.get('content-desc','')]).strip().casefold()
    if hay and any(label in hay for label in labels):
        m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds',''))
        if not m:
            continue
        x1,y1,x2,y2 = map(int,m.groups())
        print(f'{(x1+x2)//2} {(y1+y2)//2}')
        raise SystemExit(0)
raise SystemExit(7)
PY
)" || { echo "Could not find UI label: $labels"; cat "$xml"; exit 7; }
  read -r x y <<<"$point"
  "$ADB" -s "$SERIAL" shell input tap "$x" "$y"
  sleep 1
}

capture dashboard-empty
click_label 'Gniazdka|Plugs'
capture plugs-empty
click_label 'Termometry|Thermometers|Sensors'
capture thermometers-empty
click_label 'Ustawienia|Settings'
capture settings
click_label 'Reguły|Rules'
click_label 'Dodaj automatykę|Add automation|Add rule'
capture intent
click_label 'Sterować temperaturą|Control temperature|Temperature'
capture climate-editor-empty
"$ADB" -s "$SERIAL" shell input keyevent 4
sleep 1
click_label 'Sterować według czasu|Control by time|Time'
capture time-editor-empty

PID="$("$ADB" -s "$SERIAL" shell pidof "$PACKAGE" | tr -d '\r')"
[[ -n "$PID" ]] || { echo 'App process missing after UX smoke'; exit 8; }
"$ADB" -s "$SERIAL" logcat -d --pid="$PID" -v brief '*:W' > "$TMP/logcat-warnings.txt" || true
"$ADB" -s "$SERIAL" shell dumpsys window displays > "$TMP/window-displays.txt"
"$ADB" -s "$SERIAL" shell wm size > "$TMP/wm-size.txt"
"$ADB" -s "$SERIAL" shell wm density > "$TMP/wm-density.txt"

# Keep product branch clean; publish evidence to a dedicated artifact ref.
ARTIFACT_WORKTREE=/tmp/lcl-android-ux-artifact-ref
rm -rf "$ARTIFACT_WORKTREE"
git worktree add --detach "$ARTIFACT_WORKTREE" "$EXPECTED"
mkdir -p "$ARTIFACT_WORKTREE/.agent/artifacts/android-ux/931d59e1"
cp "$TMP"/* "$ARTIFACT_WORKTREE/.agent/artifacts/android-ux/931d59e1/"
cd "$ARTIFACT_WORKTREE"
git add .agent/artifacts/android-ux/931d59e1
git -c user.name='Local Agent' -c user.email='local-agent@users.noreply.github.com' commit -m 'Capture Android UX smoke evidence'
git push --force origin HEAD:"$ARTIFACT_REF"
ARTIFACT_HEAD="$(git rev-parse HEAD)"
cd "$REPO"
git worktree remove "$ARTIFACT_WORKTREE" --force

[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]]
[[ -z "$(git status --porcelain)" ]]
printf 'ARTIFACT_REF=%s\n' "$ARTIFACT_REF"
printf 'ARTIFACT_HEAD=%s\n' "$ARTIFACT_HEAD"
printf 'PRODUCT_HEAD=%s\n' "$(git rev-parse HEAD)"

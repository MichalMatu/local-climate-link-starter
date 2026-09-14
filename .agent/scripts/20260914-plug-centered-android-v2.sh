#!/usr/bin/env bash
set -euo pipefail

EXPECTED=55ec920a2c627e789c40509d1f4739e91acfd265
PACKAGE=link.localclimate.app
SERIAL=RFCT70L7E8J
ADB=/opt/homebrew/bin/adb
ARTIFACT_REF=agent-artifacts/plug-centered-ux-20260914-55ec920a
TMP=/tmp/lcl-plug-centered-55ec920a-v2
ARTIFACT_WORKTREE=/tmp/lcl-plug-centered-artifact-ref-v2

[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }
[[ "$("$ADB" -s "$SERIAL" get-state 2>/dev/null || true)" == "device" ]] || exit 4
[[ "$("$ADB" -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')" == "SM-S906B" ]] || exit 5

"$ADB" -s "$SERIAL" shell am force-stop "$PACKAGE"
"$ADB" -s "$SERIAL" logcat -c
"$ADB" -s "$SERIAL" shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 4

rm -rf "$TMP"
mkdir -p "$TMP"
"$ADB" -s "$SERIAL" exec-out screencap -p > "$TMP/root-plugs.png"
"$ADB" -s "$SERIAL" shell uiautomator dump /sdcard/lcl-plug-centered-v2.xml >/dev/null
"$ADB" -s "$SERIAL" exec-out cat /sdcard/lcl-plug-centered-v2.xml > "$TMP/root-plugs.xml"
PID="$("$ADB" -s "$SERIAL" shell pidof "$PACKAGE" | tr -d '\r')"
[[ -n "$PID" ]] || exit 6
"$ADB" -s "$SERIAL" logcat -d --pid="$PID" -v brief '*:W' > "$TMP/logcat-warnings.txt" || true
"$ADB" -s "$SERIAL" shell wm size > "$TMP/wm-size.txt"
"$ADB" -s "$SERIAL" shell wm density > "$TMP/wm-density.txt"

echo '--- ROOT UI TEXT ---'
python3 - "$TMP/root-plugs.xml" <<'PY'
import sys, xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
for node in root.iter('node'):
    text = node.attrib.get('text', '').strip()
    desc = node.attrib.get('content-desc', '').strip()
    if text:
        print(text)
    if desc and desc != text:
        print(desc)
PY

echo '--- APP WARNINGS ---'
cat "$TMP/logcat-warnings.txt"

rm -rf "$ARTIFACT_WORKTREE"
git worktree add --detach "$ARTIFACT_WORKTREE" "$EXPECTED"
mkdir -p "$ARTIFACT_WORKTREE/.agent/artifacts/plug-centered-ux/55ec920a"
cp "$TMP"/* "$ARTIFACT_WORKTREE/.agent/artifacts/plug-centered-ux/55ec920a/"
cd "$ARTIFACT_WORKTREE"
git add .agent/artifacts/plug-centered-ux/55ec920a
git -c user.name='Local Agent' -c user.email='local-agent@users.noreply.github.com' commit -m 'Capture plug-centered Android UX evidence'
git push --force origin HEAD:refs/heads/"$ARTIFACT_REF"
ARTIFACT_HEAD="$(git rev-parse HEAD)"
cd - >/dev/null
git worktree remove "$ARTIFACT_WORKTREE" --force

[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]]
[[ -z "$(git status --porcelain)" ]]
printf 'PRODUCT_HEAD=%s\n' "$(git rev-parse HEAD)"
printf 'ARTIFACT_REF=%s\n' "$ARTIFACT_REF"
printf 'ARTIFACT_HEAD=%s\n' "$ARTIFACT_HEAD"

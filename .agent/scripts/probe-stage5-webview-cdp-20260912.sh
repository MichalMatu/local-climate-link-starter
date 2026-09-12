#!/usr/bin/env sh
set -eu

APP_ID=link.localclimate.app
ARTIFACT_DIR=.agent/artifacts/20260912-stage5-ui-audit-cdp
TMP_DIR="$(mktemp -d /tmp/lcl-cdp-probe.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-agent-control.XXXXXX)"
PORT=9223
cleanup() {
  adb forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

command -v adb >/dev/null 2>&1
command -v curl >/dev/null 2>&1
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
if [ "$COUNT" -ne 1 ]; then
  echo "ANDROID_DEVICE_COUNT=$COUNT"
  adb devices -l
  exit 21
fi
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "SM-S906B"
PID="$(adb -s "$SERIAL" shell pidof "$APP_ID" | tr -d '\r' | awk '{print $1}')"
test -n "$PID"

adb -s "$SERIAL" shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | grep 'webview_devtools_remote' > "$TMP_DIR/sockets.txt" || true
SOCKET="$(awk '{print $NF}' "$TMP_DIR/sockets.txt" | sed 's/^@//' | grep "webview_devtools_remote_${PID}$" | head -n 1 || true)"
if [ -z "$SOCKET" ]; then
  SOCKET="$(awk '{print $NF}' "$TMP_DIR/sockets.txt" | sed 's/^@//' | grep '^webview_devtools_remote' | head -n 1 || true)"
fi
printf 'APP_PID=%s\n' "$PID" > "$TMP_DIR/probe.txt"
printf 'SOCKET=%s\n' "$SOCKET" >> "$TMP_DIR/probe.txt"

if [ -n "$SOCKET" ]; then
  adb -s "$SERIAL" forward "tcp:$PORT" "localabstract:$SOCKET" >/dev/null
  curl --fail --silent --show-error "http://127.0.0.1:$PORT/json" > "$TMP_DIR/webview-targets.json"
  curl --fail --silent --show-error "http://127.0.0.1:$PORT/json/version" > "$TMP_DIR/webview-version.json" || true
  python3 - "$TMP_DIR/webview-targets.json" >> "$TMP_DIR/probe.txt" <<'PY'
import json, sys
p=sys.argv[1]
with open(p, encoding='utf-8') as f:
    data=json.load(f)
print(f'TARGET_COUNT={len(data)}')
for i,t in enumerate(data):
    print(f'TARGET_{i}_TYPE={t.get("type","")}')
    print(f'TARGET_{i}_TITLE={t.get("title","")}')
    print(f'TARGET_{i}_URL={t.get("url","")}')
    print(f'TARGET_{i}_HAS_WS={1 if t.get("webSocketDebuggerUrl") else 0}')
PY
else
  printf 'TARGET_COUNT=0\n' >> "$TMP_DIR/probe.txt"
  printf '[]\n' > "$TMP_DIR/webview-targets.json"
fi

# Publish probe artifacts only on agent-control.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR/probe.txt" "$CONTROL_DIR/$ARTIFACT_DIR/probe.txt"
cp "$TMP_DIR/sockets.txt" "$CONTROL_DIR/$ARTIFACT_DIR/sockets.txt"
cp "$TMP_DIR/webview-targets.json" "$CONTROL_DIR/$ARTIFACT_DIR/webview-targets.json"
if [ -f "$TMP_DIR/webview-version.json" ]; then
  cp "$TMP_DIR/webview-version.json" "$CONTROL_DIR/$ARTIFACT_DIR/webview-version.json"
fi
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  if ! git diff --cached --quiet; then
    git commit -m "Capture Stage 5 WebView CDP probe" >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  echo "AUDIT_CONTROL_SHA=$(git rev-parse HEAD)"
)

cat "$TMP_DIR/probe.txt"
echo STAGE5_WEBVIEW_CDP_PROBE=1

#!/usr/bin/env sh
set -eu

SOURCE=.agent/artifacts/20260912-stage5-ui-audit-initial/dashboard-micro.jpg
OUTPUT=.agent/artifacts/20260912-stage5-ui-audit-initial/dashboard-micro.b64.txt
TMP_DIR="$(mktemp -d /tmp/lcl-ui-micro-b64.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-agent-control.XXXXXX)"
cleanup() {
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

git fetch origin agent-control >/dev/null
git show "origin/agent-control:$SOURCE" > "$TMP_DIR/dashboard-micro.jpg"
test -s "$TMP_DIR/dashboard-micro.jpg"
base64 < "$TMP_DIR/dashboard-micro.jpg" | tr -d '\n' | fold -w 1200 > "$TMP_DIR/dashboard-micro.b64.txt"
LINES="$(wc -l < "$TMP_DIR/dashboard-micro.b64.txt" | tr -d ' ')"
echo "DASHBOARD_MICRO_B64_LINES=$LINES"

git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$(dirname "$OUTPUT")"
cp "$TMP_DIR/dashboard-micro.b64.txt" "$CONTROL_DIR/$OUTPUT"
(
  cd "$CONTROL_DIR"
  git add "$OUTPUT"
  if git diff --cached --quiet; then
    echo "DASHBOARD_MICRO_B64_UNCHANGED=1"
  else
    git commit -m "Export Stage 5 dashboard microthumb" >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  echo "AUDIT_CONTROL_SHA=$(git rev-parse HEAD)"
)

echo "DASHBOARD_MICRO_B64=$OUTPUT"
echo STAGE5_DASHBOARD_MICRO_B64_EXPORT=1

#!/usr/bin/env sh
set -eu

SOURCE_DIR=.agent/artifacts/20260912-stage5-ui-audit-initial
SOURCE=$SOURCE_DIR/dashboard.png
OUTPUT=$SOURCE_DIR/dashboard-thumb.jpg
TMP_DIR="$(mktemp -d /tmp/lcl-ui-thumb.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-agent-control.XXXXXX)"
cleanup() {
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

command -v sips >/dev/null 2>&1
git fetch origin agent-control >/dev/null
git show "origin/agent-control:$SOURCE" > "$TMP_DIR/dashboard.png"
test -s "$TMP_DIR/dashboard.png"
sips -Z 780 -s format jpeg -s formatOptions 55 "$TMP_DIR/dashboard.png" --out "$TMP_DIR/dashboard-thumb.jpg" >/dev/null
test -s "$TMP_DIR/dashboard-thumb.jpg"
SIZE="$(wc -c < "$TMP_DIR/dashboard-thumb.jpg" | tr -d ' ')"
echo "DASHBOARD_THUMB_BYTES=$SIZE"

# Publish only the derived thumbnail on the control branch; app work branch remains untouched.
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$SOURCE_DIR"
cp "$TMP_DIR/dashboard-thumb.jpg" "$CONTROL_DIR/$OUTPUT"
(
  cd "$CONTROL_DIR"
  git add "$OUTPUT"
  if git diff --cached --quiet; then
    echo "DASHBOARD_THUMB_UNCHANGED=1"
  else
    git commit -m "Add Stage 5 dashboard audit thumbnail" >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  echo "AUDIT_CONTROL_SHA=$(git rev-parse HEAD)"
)

echo "DASHBOARD_THUMB=$OUTPUT"
echo STAGE5_DASHBOARD_THUMBNAIL=1

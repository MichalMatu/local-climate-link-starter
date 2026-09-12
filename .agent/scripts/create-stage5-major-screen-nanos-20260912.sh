#!/usr/bin/env sh
set -eu

SRC_DIR=.agent/artifacts/20260912-stage5-ui-audit-major-screens
OUT_DIR=.agent/artifacts/20260912-stage5-ui-audit-major-screens-nano
CONTROL_DIR="$(mktemp -d /tmp/lcl-major-nano.XXXXXX)"
cleanup() {
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

command -v sips >/dev/null 2>&1
git fetch origin agent-control >/dev/null
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$OUT_DIR"

for name in dashboard-climate dashboard-time settings setup-intent setup-shelly setup-shelly-add-modal setup-sensor setup-sensor-add-modal setup-rule; do
  src="$CONTROL_DIR/$SRC_DIR/$name-thumb.jpg"
  dst="$CONTROL_DIR/$OUT_DIR/$name-nano.jpg"
  test -s "$src"
  sips -Z 180 -s format jpeg -s formatOptions 38 "$src" --out "$dst" >/dev/null
  test -s "$dst"
  bytes="$(wc -c < "$dst" | tr -d ' ')"
  echo "NANO=$name:$bytes"
done

(
  cd "$CONTROL_DIR"
  git add "$OUT_DIR"
  if ! git diff --cached --quiet; then
    git commit -m "Create Stage 5 UI audit nanothumbnails" >/dev/null
    if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
      git fetch origin agent-control >/dev/null
      git rebase origin/agent-control >/dev/null
      git push origin HEAD:agent-control >/dev/null
    fi
  fi
  echo "AUDIT_CONTROL_SHA=$(git rev-parse HEAD)"
)
echo STAGE5_MAJOR_SCREEN_NANOS=1

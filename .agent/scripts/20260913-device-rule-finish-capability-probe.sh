#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='71b6c8f3390644c581769dbb1a7f6c29d9699ae7'

git fetch --prune origin "$BRANCH" agent-control
test -z "$(git status --porcelain)"
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

echo "HEAD=$(git rev-parse HEAD)"
echo "NODE=$(node --version)"
echo "PNPM=$(pnpm --version)"

for tool in codex claude gemini opencode aider; do
  upper=$(printf '%s' "$tool" | tr '[:lower:]' '[:upper:]')
  if command -v "$tool" >/dev/null 2>&1; then
    echo "TOOL_${upper}=1"
    "$tool" --version 2>/dev/null | head -n 1 || true
  else
    echo "TOOL_${upper}=0"
  fi
done

if command -v codex >/dev/null 2>&1; then
  echo 'CODEX_HELP_BEGIN'
  codex --help 2>&1 | sed -n '1,120p'
  echo 'CODEX_HELP_END'
fi

if command -v adb >/dev/null 2>&1; then
  echo 'ADB=1'
  adb devices -l || true
else
  echo 'ADB=0'
fi

if [ -n "${SHELLY_URL:-}" ]; then echo 'SHELLY_URL_SET=1'; else echo 'SHELLY_URL_SET=0'; fi
if [ -n "${SHELLY_DEVICE_ID:-}" ]; then echo 'SHELLY_DEVICE_ID_SET=1'; else echo 'SHELLY_DEVICE_ID_SET=0'; fi
if [ -n "${ANDROID_HOME:-}" ]; then echo 'ANDROID_HOME_SET=1'; else echo 'ANDROID_HOME_SET=0'; fi

test -z "$(git status --porcelain)"

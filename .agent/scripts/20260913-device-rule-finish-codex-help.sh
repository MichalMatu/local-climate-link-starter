#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='71b6c8f3390644c581769dbb1a7f6c29d9699ae7'

git fetch --prune origin "$BRANCH" agent-control
test -z "$(git status --porcelain)"
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

echo 'CODEX_EXEC_HELP_BEGIN'
codex exec --help 2>&1 | sed -n '1,180p'
echo 'CODEX_EXEC_HELP_END'
test -z "$(git status --porcelain)"

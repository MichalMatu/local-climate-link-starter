#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_REMOTE='70c8fb0e989200479a05e57516ad12fbe763b8d5'
EXPECTED_LOCAL='fbbde9abb37fe9fcdbce5c7cdc8f3bdd98e3d895'

git fetch origin "$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_LOCAL"
test -z "$(git status --porcelain)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
test "$REMOTE" = "$EXPECTED_REMOTE"
git push origin "HEAD:$BRANCH"
ACTUAL="$(git ls-remote origin "refs/heads/$BRANCH" | awk '{print $1}')"
test "$ACTUAL" = "$EXPECTED_LOCAL"
printf 'PUSHED_HEAD=%s\n' "$ACTUAL"

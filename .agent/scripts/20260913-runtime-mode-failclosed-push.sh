#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_REMOTE='fbbde9abb37fe9fcdbce5c7cdc8f3bdd98e3d895'
CANDIDATE='6876bbcf659a952be90c9f3a0968d3d5ab414cf5'
git fetch origin "$BRANCH" agent-control
REMOTE_HEAD="$(git rev-parse "origin/$BRANCH")"
if [ "$REMOTE_HEAD" != "$EXPECTED_REMOTE" ]; then
  echo "Remote head changed: $REMOTE_HEAD" >&2
  exit 1
fi
git cat-file -e "$CANDIDATE^{commit}"
PARENT="$(git rev-parse "$CANDIDATE^")"
if [ "$PARENT" != "$EXPECTED_REMOTE" ]; then
  echo "Candidate parent mismatch: $PARENT" >&2
  exit 1
fi
git checkout -B "$BRANCH" "$CANDIDATE"
git status --porcelain | grep -q . && { echo 'Worktree is dirty' >&2; exit 1; } || true
git push origin "$CANDIDATE:refs/heads/$BRANCH"
echo "PUSHED_HEAD=$CANDIDATE"

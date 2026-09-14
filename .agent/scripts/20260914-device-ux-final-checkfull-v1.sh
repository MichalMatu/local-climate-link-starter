#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
BASE=0fbe83040ae0e41f932bb83a65a8b3438c26ba1b
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[ -z "$(git status --porcelain)" ] || { git status --short; exit 3; }

pnpm check:full

[ -z "$(git status --porcelain)" ] || { echo "Worktree became dirty after check:full"; git status --short; exit 4; }
git fetch origin "$BRANCH"
[ "$(git rev-parse origin/$BRANCH)" = "$BASE" ] || { echo "Remote work branch moved during gate"; exit 5; }
echo "FINAL_HEAD=$BASE"

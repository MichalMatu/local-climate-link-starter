#!/usr/bin/env sh
set -eu

BASE=4462a5246e06f7cebcb5808eace2d6278988e56e
HEAD_SHA=5a4a109f6d69bf468b6b408241e46cee1ecf75aa
BRANCH=work/remove-sensor-charts-20260911
TAG=stable-20260911-manual-runtime

git fetch --prune origin
test "$(git rev-parse origin/main)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$HEAD_SHA"
test "$(git rev-list -n 1 "$TAG")" = "$BASE"

git checkout -B main origin/main >/dev/null
test -z "$(git status --porcelain)"
git merge --ff-only "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$HEAD_SHA"

pnpm check:full
test -z "$(git status --porcelain)"

git push origin HEAD:main
git fetch origin main
test "$(git rev-parse origin/main)" = "$HEAD_SHA"
test "$(git rev-list -n 1 "$TAG")" = "$BASE"

git push origin --delete "$BRANCH"
git fetch --prune origin
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then exit 41; fi

echo FINAL_MAIN_SHA=$HEAD_SHA
echo STABLE_TAG=$TAG
echo STABLE_TAG_SHA=$BASE
echo CHART_CLEANUP_MERGE_OK=1

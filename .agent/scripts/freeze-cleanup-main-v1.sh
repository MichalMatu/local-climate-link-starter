#!/usr/bin/env sh
set -eu

MAIN_SHA=4462a5246e06f7cebcb5808eace2d6278988e56e
TAG=stable-20260911-manual-runtime
OLD_FREEZE=freeze/working-baseline-20260910
OLD_WORK=work/manual-runtime-mode-20260911

git fetch --prune origin

test "$(git rev-parse origin/main)" = "$MAIN_SHA"

git checkout -B main origin/main >/dev/null
test -z "$(git status --porcelain)"

if git show-ref --verify --quiet "refs/tags/$TAG"; then
  test "$(git rev-list -n 1 "$TAG")" = "$MAIN_SHA"
else
  git tag -a "$TAG" "$MAIN_SHA" -m "Stable manual runtime baseline after physical S22+ and Shelly validation"
  git push origin "refs/tags/$TAG"
fi

git merge-base --is-ancestor "origin/$OLD_FREEZE" origin/main
git merge-base --is-ancestor "origin/$OLD_WORK" origin/main

git push origin --delete "$OLD_FREEZE" "$OLD_WORK"

git fetch --prune origin

test "$(git rev-parse origin/main)" = "$MAIN_SHA"
test "$(git rev-list -n 1 "$TAG")" = "$MAIN_SHA"
if git show-ref --verify --quiet "refs/remotes/origin/$OLD_FREEZE"; then exit 21; fi
if git show-ref --verify --quiet "refs/remotes/origin/$OLD_WORK"; then exit 22; fi

echo FREEZE_TAG=$TAG
echo FREEZE_SHA=$MAIN_SHA
echo BRANCH_CLEANUP_OK=1

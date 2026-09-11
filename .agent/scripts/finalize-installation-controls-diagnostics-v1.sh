#!/usr/bin/env sh
set -eu

BASE=5a4a109f6d69bf468b6b408241e46cee1ecf75aa
HEAD=16d8627b9df050152a72f021e2ab3a228cffefb3
BRANCH=work/installation-controls-diagnostics-20260911
STABLE_TAG=stable-20260911-manual-runtime
STABLE_COMMIT=4462a5246e06f7cebcb5808eace2d6278988e56e

git fetch --prune --tags origin
test "$(git rev-parse origin/main)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$HEAD"
test "$(git merge-base origin/main origin/$BRANCH)" = "$BASE"
test "$(git rev-list --count origin/main..origin/$BRANCH)" = "1"
test "$(git rev-list --count origin/$BRANCH..origin/main)" = "0"
test "$(git rev-parse "$STABLE_TAG^{}")" = "$STABLE_COMMIT"

git checkout -B main origin/main >/dev/null
test -z "$(git status --porcelain)"
git merge --ff-only "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$HEAD"

echo '=== FINAL EXACT-COMMIT VALIDATION ==='
git diff --check "$BASE" "$HEAD"
pnpm check:full

test "$(git rev-parse HEAD)" = "$HEAD"
test "$(git rev-parse "$STABLE_TAG^{}")" = "$STABLE_COMMIT"
git push origin HEAD:main

git fetch --prune --tags origin
test "$(git rev-parse origin/main)" = "$HEAD"
test "$(git rev-parse "$STABLE_TAG^{}")" = "$STABLE_COMMIT"

for stale in \
  "$BRANCH" \
  audit/installation-controls-diagnostics-20260911 \
  tmp-do-not-use
do
  if git ls-remote --exit-code --heads origin "refs/heads/$stale" >/dev/null 2>&1; then
    git push origin --delete "$stale"
  fi
done

git fetch --prune origin
for stale in \
  "$BRANCH" \
  audit/installation-controls-diagnostics-20260911 \
  tmp-do-not-use
do
  if git ls-remote --exit-code --heads origin "refs/heads/$stale" >/dev/null 2>&1; then
    echo "stale remote branch remains: $stale" >&2
    exit 41
  fi
done

echo FINAL_MAIN_SHA=$(git rev-parse origin/main)
echo FINAL_STABLE_SHA=$(git rev-parse "$STABLE_TAG^{}")
echo INSTALLATION_CONTROLS_DIAGNOSTICS_MERGED=1

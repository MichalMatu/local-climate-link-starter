#!/bin/sh
set -eu

MAIN_BASE=30513150474c9b2a5c2d5d198ab90d17810e56db
FEATURE=ea9ffc2cd81f037955639cf8f750005c1831663b
FEATURE_BRANCH=work/manual-runtime-mode-20260911

git fetch --prune origin

test "$(git rev-parse origin/main)" = "$MAIN_BASE"
test "$(git rev-parse origin/$FEATURE_BRANCH)" = "$FEATURE"

git checkout -B main origin/main
test -z "$(git status --porcelain)"

git merge --no-ff "$FEATURE" -m "merge: manual runtime mode"

test "$(git rev-parse HEAD^1)" = "$MAIN_BASE"
test "$(git rev-parse HEAD^2)" = "$FEATURE"

# The handoff commit on main predates the current repository formatting gate.
# Format only that Markdown file; do not change its runtime content.
pnpm exec prettier --write docs/HANDOFF_NEXT_CHAT.md
git add docs/HANDOFF_NEXT_CHAT.md
if ! git diff --cached --quiet; then
  git commit --amend --no-edit
fi

MERGE_SHA="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^1)" = "$MAIN_BASE"
test "$(git rev-parse HEAD^2)" = "$FEATURE"

git diff --check "$MAIN_BASE"..HEAD
pnpm check:full

test -z "$(git status --porcelain)"
git push origin HEAD:main

git fetch origin main
test "$(git rev-parse origin/main)" = "$MERGE_SHA"
echo FINAL_MAIN_SHA="$MERGE_SHA"
echo FINAL_MAIN_PARENT_1="$(git rev-parse HEAD^1)"
echo FINAL_MAIN_PARENT_2="$(git rev-parse HEAD^2)"
echo FINAL_MAIN_MERGE_OK=1

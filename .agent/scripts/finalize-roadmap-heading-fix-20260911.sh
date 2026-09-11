#!/usr/bin/env sh
set -eu

BASE=c6a7128eba590f2b711d5d4fe32d74cc2aa8ac2a
HEAD=d91da6045524d9ca6657f92d5b8b040502a3f1ae
BRANCH=work/docs-roadmap-cleanup-fix-20260911
STABLE=4462a5246e06f7cebcb5808eace2d6278988e56e

git fetch --prune origin
test "$(git rev-parse origin/main)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$HEAD"
git merge-base --is-ancestor "$BASE" "$HEAD"

git checkout -B main origin/main >/dev/null
test -z "$(git status --porcelain)"
git merge --ff-only origin/$BRANCH
test "$(git rev-parse HEAD)" = "$HEAD"

pnpm format:check
pnpm quality:repo
if grep -nE 'Product direction##|complete###|implementation##|Gen3###' docs/product/next-functional-steps.md; then
  echo 'duplicate heading artifact remains' >&2
  exit 31
fi

git push origin main
git push origin --delete "$BRANCH"
git remote prune origin

for b in $(git for-each-ref refs/heads --format='%(refname:short)'); do
  case "$b" in
    main|agent-control) ;;
    *)
      if git merge-base --is-ancestor "$b" main 2>/dev/null; then
        git branch -D "$b"
      fi
      ;;
  esac
done

test "$(git rev-parse origin/main)" = "$HEAD"
test "$(git rev-list -n 1 stable-20260911-manual-runtime)" = "$STABLE"

echo '=== LOCAL BRANCHES FINAL ==='
git branch --format='%(refname:short)' | sort
echo '=== REMOTE BRANCHES FINAL ==='
git branch -r --format='%(refname:short)' | sort

echo FINAL_MAIN_SHA=$(git rev-parse HEAD)
echo FINAL_STABLE_SHA=$(git rev-list -n 1 stable-20260911-manual-runtime)
echo ROADMAP_HEADING_FIX_MERGED=1

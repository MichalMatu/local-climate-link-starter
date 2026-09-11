#!/usr/bin/env sh
set -eu

BASE=16d8627b9df050152a72f021e2ab3a228cffefb3
HEAD=c6a7128eba590f2b711d5d4fe32d74cc2aa8ac2a
BRANCH=work/docs-roadmap-cleanup-20260911
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
git diff --check "$BASE" "$HEAD"

git push origin main

git push origin --delete "$BRANCH"
git remote prune origin

# Remove only local branches that are already fully merged into main.
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

echo '=== LOCAL BRANCHES AFTER CLEANUP ==='
git branch --format='%(refname:short)' | sort
echo '=== REMOTE BRANCHES AFTER CLEANUP ==='
git branch -r --format='%(refname:short)' | sort

echo FINAL_MAIN_SHA=$(git rev-parse HEAD)
echo FINAL_STABLE_SHA=$(git rev-list -n 1 stable-20260911-manual-runtime)
echo DOCS_ROADMAP_CLEANUP_MERGED=1

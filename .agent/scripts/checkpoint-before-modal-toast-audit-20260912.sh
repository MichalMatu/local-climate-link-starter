#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=ded8d77605131b728d66b64a4aee66ce347c1eca
TAG=ux-polish-checkpoint-before-modal-toast-audit

git fetch --prune origin "$BRANCH" >/dev/null
git fetch --tags origin >/dev/null 2>&1 || true
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"
if [ "$REMOTE_SHA" != "$BASE" ]; then
  echo "CHECKPOINT_BRANCH_MOVED=$REMOTE_SHA"
  exit 31
fi

git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
if [ "$(git rev-parse HEAD)" != "$BASE" ]; then
  exit 32
fi
test -z "$(git status --porcelain)"

pnpm --filter @lcl/mobile build

if git show-ref --verify --quiet "refs/tags/$TAG"; then
  TAG_TARGET="$(git rev-parse "$TAG^{}")"
  if [ "$TAG_TARGET" != "$BASE" ]; then
    echo "CHECKPOINT_TAG_CONFLICT=$TAG_TARGET"
    exit 33
  fi
else
  git tag -a "$TAG" "$BASE" -m "Stable UX checkpoint before modal/toast consistency pass"
fi

git push origin "refs/tags/$TAG"

echo "CHECKPOINT_TAG=$TAG"
echo "CHECKPOINT_SHA=$BASE"
echo "CHECKPOINT_BUILD=1"

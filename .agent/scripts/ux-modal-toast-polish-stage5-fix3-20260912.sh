#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=ded8d77605131b728d66b64a4aee66ce347c1eca

git fetch --prune origin "$BRANCH" agent-control
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

git show origin/agent-control:.agent/scripts/ux-modal-toast-polish-stage5-20260912.sh > /tmp/ux-modal-toast-polish-stage5-20260912.sh
set +e
sh /tmp/ux-modal-toast-polish-stage5-20260912.sh
FIRST_RC=$?
set -e
# The first pass is expected to stop at the existing UX gate after creating the intended draft diff.
test "$FIRST_RC" -ne 0
test "$(git rev-parse HEAD)" = "$BASE"
test -n "$(git status --porcelain)"
grep -q 'size="workspace"' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
grep -q 'scan-loading-state' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx

git show origin/agent-control:.agent/scripts/ux-modal-toast-polish-stage5-fix1-20260912.sh > /tmp/ux-modal-toast-polish-stage5-fix1-20260912.sh
sh /tmp/ux-modal-toast-polish-stage5-fix1-20260912.sh

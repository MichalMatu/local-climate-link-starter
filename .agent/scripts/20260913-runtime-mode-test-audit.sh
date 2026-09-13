#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='83f889a424ed1128c34b8586118f0c58e6ae9d26'
git fetch --prune origin "$BRANCH" agent-control
test -z "$(git status --porcelain)"
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

printf '\n=== CONTROL MODE TEST ===\n'
grep -n -A120 -B30 "switches saved Shelly automation between MANUAL and AUTO safely" apps/mobile/src/__tests__/hardware-setup.test.tsx || true
printf '\n=== BLE MODE TESTS ===\n'
grep -n -A140 -B30 -E "BLE scanner|BLE discovery|restart automation" apps/mobile/src/__tests__/hardware-setup.test.tsx | tail -n 520 || true
printf '\n=== SCRIPT EVAL MOCKS ===\n'
grep -n -A55 -B20 -E "Script\.Eval|scriptEval|automationMode|scriptRunning|running:" apps/mobile/src/__tests__/hardware-setup.test.tsx | head -n 700 || true
printf '\n=== RUNTIME MODE TESTS ===\n'
find apps/mobile/src/flows/installations -type f -name '*test*' -maxdepth 2 -print | sort
for f in apps/mobile/src/flows/installations/*test*.ts apps/mobile/src/flows/installations/*test*.tsx; do
  [ -f "$f" ] || continue
  echo "--- $f"
  grep -n -A80 -B20 -E 'runtime mode|R\.m|Script\.Eval|MANUAL|AUTO' "$f" || true
done

test -z "$(git status --porcelain)"

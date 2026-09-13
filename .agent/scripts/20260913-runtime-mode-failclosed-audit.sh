#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='fbbde9abb37fe9fcdbce5c7cdc8f3bdd98e3d895'
git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

printf '%s\n' '=== mode fallbacks ==='
git grep -n -E "readClimateMode|mode[[:space:]]*\?\?|automationMode|runtimeModeSupported|ClimateRuntimeMode|Script\.Eval" -- apps/mobile/src scripts ':!**/*.snap' || true
printf '%s\n' '=== exact null-to-auto patterns ==='
git grep -n -E "\?\?[[:space:]]*['\"]auto['\"]|mode:[[:space:]]*mode[[:space:]]*\?\?" -- apps/mobile/src scripts || true
printf '%s\n' '=== control mode tests ==='
find apps/mobile/src -type f \( -name '*test.ts' -o -name '*test.tsx' \) -print | sort | while read -r f; do
  if grep -Eq 'automationMode|readClimateMode|runtimeMode|manual|AUTO|MANUAL' "$f"; then echo "$f"; fi
done

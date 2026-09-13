#!/usr/bin/env bash
set -euo pipefail

printf 'LOCAL_HEAD=%s\n' "$(git rev-parse HEAD)"
printf 'LOCAL_BRANCH=%s\n' "$(git branch --show-current)"
printf 'ORIGIN_HEAD=%s\n' "$(git rev-parse origin/work/device-rule-decoupling-20260913)"
printf 'STATUS_BEGIN\n'
git status --short
printf 'STATUS_END\n'
printf 'LOG_BEGIN\n'
git log -3 --oneline --decorate
printf 'LOG_END\n'
printf 'DIFF_STAT_BEGIN\n'
git diff --stat origin/work/device-rule-decoupling-20260913...HEAD
printf 'DIFF_STAT_END\n'
printf 'DETAIL_TEST_BEGIN\n'
sed -n '330,455p' apps/mobile/src/__tests__/automation-detail.test.tsx
printf 'DETAIL_TEST_END\n'
printf 'DETAIL_MOCK_REFERENCES_BEGIN\n'
grep -n -A55 -B20 -E 'Script\.Eval|Script\.Start|Script\.Stop|automationMode|running:' apps/mobile/src/__tests__/automation-detail.test.tsx | head -n 520 || true
printf 'DETAIL_MOCK_REFERENCES_END\n'
test -z "$(git status --porcelain)"

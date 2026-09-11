#!/usr/bin/env sh
set -eu

echo HEAD=$(git rev-parse HEAD)
git status --short
set +e
pnpm --filter @lcl/mobile test -- hardware-setup.test.tsx --reporter=verbose > /tmp/shelly-stage3-tests.log 2>&1
RC=$?
set -e
echo TEST_EXIT=$RC
printf '%s\n' '--- FAILURES ---'
grep -E '^( ×| FAIL | × HardwareSetupScreen|   × HardwareSetupScreen)' /tmp/shelly-stage3-tests.log || true
printf '%s\n' '--- ERROR HEADINGS ---'
grep -E '^TestingLibraryElementError:|^Error:|^AssertionError:' /tmp/shelly-stage3-tests.log || true
exit 0

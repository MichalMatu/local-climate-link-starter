#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='9e3507529a432ccf84633835a041e407652bae86'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard "origin/$BRANCH"
git clean -fd
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

printf 'HEAD='; git rev-parse HEAD
printf '\nLEGACY_NONTEST\n'
git grep -n -E 'InstalledAutomation|useInstalledAutomationStore|setupDraftStore|ShellyDraftDevice|SensorDraftDevice|installedAutomations|hardwareSetupDraft' -- 'apps/mobile/src/**/*.ts' 'apps/mobile/src/**/*.tsx' ':!apps/mobile/src/**/*.test.ts' ':!apps/mobile/src/**/*.test.tsx' ':!apps/mobile/src/**/__tests__/**' || true
printf '\nRULE_FILES\n'
find apps/mobile/src/flows/rules -maxdepth 1 -type f -print | sort
printf '\nRULE_REPOSITORY\n'
cat apps/mobile/src/flows/rules/repository.ts
printf '\nPLUG_REPOSITORY\n'
cat apps/mobile/src/flows/devices/plugs/repository.ts
printf '\nSENSOR_REPOSITORY\n'
cat apps/mobile/src/flows/devices/sensors/repository.ts
printf '\nREGISTRY_WIRING\n'
git grep -n -E 'createRuleStore|ruleRepository|useRuleStore|createPlugStore|createSensorStore' -- apps/mobile/src || true
printf '\nINSTALL_FLOW_WRITES\n'
git grep -n -E 'addInstallation|upsertInstallation|installedAutomation|installations' -- apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts apps/mobile/src/flows/time-automation apps/mobile/src/flows/hardware-setup/useTimeAutomationSetupFlow.ts 2>/dev/null || true
printf '\nADB\n'
command -v adb || true
adb devices -l 2>/dev/null || true
printf '\nTYPECHECK\n'
pnpm --filter @lcl/mobile typecheck
printf '\nFOCUSED_TESTS\n'
pnpm --filter @lcl/mobile test -- --run src/flows/hardware-setup/bleDiscoveryMode.test.ts src/flows/rules/ownership.test.ts src/flows/devices/plugs/management.test.ts src/flows/devices/plugs/runtime.test.ts src/flows/devices/sensors/useSensorManagementFlow.test.ts src/__tests__/app-routes.test.tsx

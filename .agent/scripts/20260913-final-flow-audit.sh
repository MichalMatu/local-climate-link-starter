#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='9e3507529a432ccf84633835a041e407652bae86'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard "origin/$BRANCH"
git clean -fd
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

printf '\n=== HEAD ===\n'
git log -1 --oneline
printf '\n=== LEGACY PRODUCT REFERENCES ===\n'
rg -n "InstalledAutomation|useInstalledAutomationStore|setupDraftStore|ShellyDraftDevice|SensorDraftDevice|installedAutomations|hardwareSetupDraft" apps/mobile/src --glob '!**/*.test.*' --glob '!**/__tests__/**' || true
printf '\n=== RULE FILES ===\n'
find apps/mobile/src/flows/rules -maxdepth 2 -type f -print | sort
printf '\n=== DEVICE FILES ===\n'
find apps/mobile/src/flows/devices -maxdepth 3 -type f -print | sort
printf '\n=== RULE MODEL ===\n'
sed -n '1,260p' apps/mobile/src/flows/rules/model.ts
printf '\n=== RULE STORE ===\n'
sed -n '1,340p' apps/mobile/src/flows/rules/store.ts
printf '\n=== RULE REFERENCES ===\n'
for f in apps/mobile/src/flows/rules/*.ts; do echo "--- $f"; sed -n '1,360p' "$f"; done
printf '\n=== CLIMATE INSTALL FLOW ===\n'
sed -n '1,420p' apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts
printf '\n=== TIME INSTALL FLOW ===\n'
sed -n '1,460p' apps/mobile/src/flows/hardware-setup/useTimeAutomationSetupFlow.ts
printf '\n=== INSTALLATION DETAIL IMPORTS/STORE ===\n'
sed -n '1,220p' apps/mobile/src/screens/InstallationDetailScreen.tsx
printf '\n=== TIME CARD ===\n'
sed -n '1,300p' apps/mobile/src/screens/TimeAutomationCard.tsx
printf '\n=== SETUP DRAFT MODEL/STORE HEAD ===\n'
sed -n '1,360p' apps/mobile/src/flows/hardware-setup/setupDraftStore.ts
printf '\n=== PACKAGE SCRIPTS ===\n'
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts,null,2))"
printf '\n=== BASELINE TYPECHECK ===\n'
pnpm --filter @lcl/mobile typecheck
printf '\n=== BASELINE FOCUSED TESTS ===\n'
pnpm --filter @lcl/mobile test -- --run src/flows/hardware-setup/bleDiscoveryMode.test.ts src/flows/rules src/flows/devices src/__tests__/app-routes.test.tsx

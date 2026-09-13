#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='83f889a424ed1128c34b8586118f0c58e6ae9d26'

git fetch --prune origin "$BRANCH" agent-control
test -z "$(git status --porcelain)"
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

printf '\n=== INSTALLED AUTOMATION REFERENCES ===\n'
grep -RIn --exclude-dir=node_modules -E 'useInstalledAutomationStore|InstalledAutomation|flows/installations' apps/mobile/src | head -n 320 || true
printf '\n=== DRAFT DEVICE REFERENCES ===\n'
grep -RIn --exclude-dir=node_modules -E 'useHardwareSetupDraftStore|shellyDevices|sensorDevices|selectedShellyId|selectedSensorId' apps/mobile/src | head -n 360 || true
printf '\n=== RULE MODULES ===\n'
find apps/mobile/src/flows/rules -maxdepth 1 -type f -print | sort
printf '\n=== DASHBOARD ===\n'
sed -n '1,420p' apps/mobile/src/screens/AutomationDashboardScreen.tsx
printf '\n=== CLIMATE INSTALL ===\n'
sed -n '1,360p' apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts
printf '\n=== TIME INSTALL ===\n'
sed -n '1,340p' apps/mobile/src/flows/time-automation/useTimeAutomationSetupFlow.ts
printf '\n=== BLE FLOW ===\n'
sed -n '1,300p' apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts
printf '\n=== BLE REQUEST HELPERS ===\n'
grep -n -A90 -B35 -E '^export const (prepareShellyBleDiscovery|stopShellyBleDiscovery|readShellyControlStatus)' apps/mobile/src/flows/hardware-setup/shellyRequests.ts || true
printf '\n=== RUNTIME MODE TRANSPORT ===\n'
sed -n '1,260p' apps/mobile/src/flows/installations/runtimeModeTransport.ts
printf '\n=== RELATED TESTS ===\n'
find apps/mobile/src -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) -print | sort | grep -E 'hardware-setup|automation-dashboard|time-automation|runtime|registry|ownership|app-routes' || true

test -z "$(git status --porcelain)"

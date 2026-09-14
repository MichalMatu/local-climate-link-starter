#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=1cd94a6b6defc041bd53e313624a23de2ab6d068
cd "$REPO"

git fetch origin "$BRANCH"
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }
git checkout "$BRANCH"
git reset --hard "$REMOTE"
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

echo '=== LEGACY FILES ==='
find apps/mobile/src/flows/installations -maxdepth 2 -type f -print 2>/dev/null | sort || true
find apps/mobile/src/flows/time-automation -maxdepth 2 -type f -print 2>/dev/null | sort || true
find apps/mobile/src/screens -maxdepth 1 -type f \( -name '*Installation*' -o -name 'TimeAutomationCard.tsx' -o -name 'ShellyLedSettingsCard.tsx' \) -print | sort || true
find apps/mobile/src/flows/hardware-setup -maxdepth 1 -type f -print | sort
find apps/mobile/src/screens/hardware-setup -maxdepth 2 -type f -print | sort

echo '=== PRODUCT SOURCE REFERENCES ==='
rg -n --glob '!**/__tests__/**' --glob '!**/*.test.*' --glob '!**/test/**' \
  'InstalledAutomation|installationId|flows/installations|useHardwareSetupFlow|HardwareSetupScreen|InstallationDetailScreen|InstallationRuntimeControls|TimeInstallationDetail|TimeAutomationCard|ShellyLedSettingsCard|useClimateAutomationInstallFlow|useTimeAutomationSetupFlow|flows/time-automation/runtime' \
  apps/mobile/src apps/mobile/e2e || true

echo '=== ALL REFERENCES ==='
rg -n \
  'InstalledAutomation|installationId|flows/installations|useHardwareSetupFlow|HardwareSetupScreen|InstallationDetailScreen|InstallationRuntimeControls|TimeInstallationDetail|TimeAutomationCard|ShellyLedSettingsCard|useClimateAutomationInstallFlow|useTimeAutomationSetupFlow|flows/time-automation/runtime' \
  apps/mobile/src apps/mobile/e2e || true

echo '=== IMPORTERS OF LEGACY SCREEN/HOOK FILES ==='
for token in \
  'InstallationDetailScreen' \
  'InstallationRuntimeControls' \
  'TimeInstallationDetail' \
  'TimeAutomationCard' \
  'ShellyLedSettingsCard' \
  'HardwareSetupScreen' \
  'useHardwareSetupFlow' \
  'useClimateAutomationInstallFlow' \
  'useTimeAutomationSetupFlow'; do
  echo "--- $token"
  rg -n "$token" apps/mobile/src apps/mobile/e2e || true
done

echo '=== INSTALLATIONS MODULE IMPORTERS ==='
for f in apps/mobile/src/flows/installations/*.ts; do
  [[ -f "$f" ]] || continue
  base=$(basename "$f" .ts)
  echo "--- $base"
  rg -n "installations/$base|./$base|../installations/$base" apps/mobile/src apps/mobile/e2e || true
done

echo '=== TIME AUTOMATION MODULE IMPORTERS ==='
for f in apps/mobile/src/flows/time-automation/*.ts; do
  [[ -f "$f" ]] || continue
  base=$(basename "$f" .ts)
  echo "--- $base"
  rg -n "time-automation/$base|./$base|../time-automation/$base" apps/mobile/src apps/mobile/e2e || true
done

echo '=== PACKAGE GATES / TEST NAMES ==='
find apps/mobile/src/__tests__ -maxdepth 1 -type f -print | sort | sed -n '1,240p'

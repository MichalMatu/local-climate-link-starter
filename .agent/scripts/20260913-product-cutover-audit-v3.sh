#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BRANCH='work/device-rule-decoupling-20260913'
git fetch origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
echo "HEAD=$(git rev-parse HEAD)"
echo '=== production InstalledAutomation refs ==='
git grep -n -E 'InstalledAutomation|useInstalledAutomationStore|installationId' -- 'apps/mobile/src/**/*.ts' 'apps/mobile/src/**/*.tsx' ':!apps/mobile/src/**/*.test.ts' ':!apps/mobile/src/**/*.test.tsx' || true
echo '=== production setupDraft refs ==='
git grep -n -E 'setupDraftStore|ShellyDraftDevice|SensorDraftDevice|useHardwareSetupDraftStore' -- 'apps/mobile/src/**/*.ts' 'apps/mobile/src/**/*.tsx' ':!apps/mobile/src/**/*.test.ts' ':!apps/mobile/src/**/*.test.tsx' || true
echo '=== rule registry refs ==='
git grep -n -E 'useRuleStore|usePlugStore|useSensorStore|ClimateRule|TimeRule' -- 'apps/mobile/src/**/*.ts' 'apps/mobile/src/**/*.tsx' ':!apps/mobile/src/**/*.test.ts' ':!apps/mobile/src/**/*.test.tsx' || true
echo '=== route/setup files ==='
wc -l apps/mobile/src/routes/AppRoutes.tsx apps/mobile/src/screens/AutomationDashboardScreen.tsx apps/mobile/src/screens/InstallationDetailScreen.tsx apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
git status --porcelain

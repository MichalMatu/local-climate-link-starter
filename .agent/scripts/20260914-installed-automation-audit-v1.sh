#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=2258a0607d4476659cb855dc14546b1b5d2b955f
cd "$REPO"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

echo '=== INSTALLED AUTOMATION REFERENCES ==='
git grep -nE 'InstalledAutomation|createInstalledAutomation|useInstalledAutomationStore|flows/installations|../installations|/installations/' -- apps/mobile/src scripts || true

echo '=== TIME AUTOMATION REFERENCES ==='
git grep -nE 'time-automation|TimeInstalledAutomation|scheduleJobControlsRelay|scheduleOwnership|useTimeAutomationRuntime|createTimeInstalledAutomation' -- apps/mobile/src scripts || true

echo '=== INSTALLATION HEALTH REFERENCES ==='
git grep -nE 'installationHealth|healthRecovery|runtimeDiagnostics|runtimeControl|runtimeModeTransport|runtimeStatus|runtimeUpgrade|scriptPreview|deviceLed|presentation' -- apps/mobile/src scripts || true

echo '=== INSTALLATIONS DIRECTORY ==='
find apps/mobile/src/flows/installations -maxdepth 1 -type f -print | sort || true

echo '=== TIME AUTOMATION DIRECTORY ==='
find apps/mobile/src/flows/time-automation -maxdepth 1 -type f -print | sort || true

echo '=== RULE OWNERSHIP ==='
sed -n '1,220p' apps/mobile/src/flows/rules/ownership.ts

echo '=== ROUTED PRODUCT IMPORTS ==='
sed -n '1,180p' apps/mobile/src/routes/AppRoutes.tsx | grep '^import ' || true

echo '=== LEGACY STORAGE KEYS ==='
git grep -nE 'hardwareSetupDraft|installedAutomation|automation\.install|lcl\..*automation|lcl\..*install' -- apps/mobile/src apps/mobile/e2e scripts || true

echo '=== E2E LEGACY SEEDS ==='
git grep -nE 'seedInstalledAutomation|InstalledAutomation|hardwareSetupDraft|time-automation|installations' -- apps/mobile/e2e || true

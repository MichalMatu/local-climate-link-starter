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

echo '=== CROSS-BOUNDARY INSTALLATION IMPORTS ==='
git grep -nE "from ['\"][^'\"]*installations/|from ['\"][^'\"]*installations['\"]|../installations/" -- apps/mobile/src ':!apps/mobile/src/flows/installations/**' || true

echo '=== CROSS-BOUNDARY TIME-AUTOMATION IMPORTS ==='
git grep -nE "from ['\"][^'\"]*time-automation/|../time-automation/" -- apps/mobile/src ':!apps/mobile/src/flows/time-automation/**' || true

echo '=== SETUP DRAFT IMPORTS ==='
git grep -nE "setupDraftStore|HARDWARE_SETUP_DRAFT_STORAGE_KEY|hardwareSetupDraft" -- apps/mobile/src apps/mobile/e2e || true

echo '=== INSTALLATION HEALTH IMPORTS ==='
git grep -nE "installationHealthCopy|installationHealth" -- apps/mobile/src ':!apps/mobile/src/app/locales/installationHealth.ts' || true

echo '=== RELAY SAFETY IMPORTS ==='
git grep -nE "relaySafety|forceRelayOffAndConfirm" -- apps/mobile/src || true

echo '=== INSTALLATIONS FILES ==='
find apps/mobile/src/flows/installations -maxdepth 1 -type f -print | sort || true

echo '=== TIME AUTOMATION FILES ==='
find apps/mobile/src/flows/time-automation -maxdepth 1 -type f -print | sort || true

echo '=== RESPONSIVE E2E LEGACY HELPERS ==='
git grep -nE "seedInstalledAutomation|hardwareSetupDraft|installedAutomations|led-settings" -- apps/mobile/e2e || true

echo '=== NAV/TEST LEGACY IMPORTS ==='
git grep -nE "createInstalledAutomation|useInstalledAutomationStore|loadInstalledAutomationScriptSource|createTimeInstalledAutomation|useTimeAutomationRuntime" -- apps/mobile/src/__tests__ apps/mobile/src/flows ':!apps/mobile/src/flows/installations/**' ':!apps/mobile/src/flows/time-automation/**' || true

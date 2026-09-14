#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=09f3b7e2f9e945d228146bb971f9ffd6797b532b
cd "$REPO"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

echo '=== LEGACY STORAGE REFERENCES ==='
git grep -nE 'lcl\.installedAutomations\.v1|lcl\.hardwareSetupDraft\.v8|seedInstalledAutomation|hardwareSetupDraft|InstalledAutomation|time-automation|flows/installations' -- apps/mobile/e2e apps/mobile/src scripts || true

echo '=== SETUP DRAFT IMPORTERS ==='
git grep -nE "from './setupDraftStore\.js'|from '../hardware-setup/setupDraftStore\.js'|from '../../flows/hardware-setup/setupDraftStore\.js'" -- apps/mobile/src || true

echo '=== SETUP DRAFT SYMBOL REFERENCES ==='
git grep -nE 'HardwareSetupDraft|ShellyDraftDevice|SensorDraftDevice|HARDWARE_SETUP_DRAFT_STORAGE_KEY|useHardwareSetupDraftStore|resetHardwareSetupDraftStore' -- apps/mobile/src apps/mobile/e2e || true

echo '=== E2E FILES WITH LEGACY KEYS ==='
for file in apps/mobile/e2e/*.spec.ts; do
  if grep -qE 'lcl\.installedAutomations\.v1|lcl\.hardwareSetupDraft\.v8|seedInstalledAutomation' "$file"; then
    echo "--- $file"
    grep -nE 'lcl\.installedAutomations\.v1|lcl\.hardwareSetupDraft\.v8|seedInstalledAutomation' "$file" || true
  fi
done

echo '=== RESPONSIVE LEGACY CONTEXT ==='
sed -n '1,120p' apps/mobile/e2e/responsive.spec.ts
sed -n '500,700p' apps/mobile/e2e/responsive.spec.ts

echo '=== LED SETTINGS LEGACY CONTEXT ==='
sed -n '1,180p' apps/mobile/e2e/led-settings.spec.ts || true

echo '=== REGISTRY LEGACY KEY TEST CONTEXT ==='
sed -n '270,340p' apps/mobile/src/flows/registry/devicesAndRules.test.ts

echo '=== SETUP DRAFT STORE ==='
sed -n '1,380p' apps/mobile/src/flows/hardware-setup/setupDraftStore.ts

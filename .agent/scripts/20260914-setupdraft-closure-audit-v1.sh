#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=54b212b9d1384ab56db3fddcb5af0e092ff46f36
cd "$REPO"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

echo '=== SETUP DRAFT MODULE IMPORTERS ==='
git grep -nE "setupDraftStore|useHardwareSetupDraftStore|resetHardwareSetupDraftStore|DEFAULT_HARDWARE_SETUP_DRAFT|HARDWARE_SETUP_DRAFT_STORAGE_KEY|HardwareSetupDraft|ShellyDraftDevice|SensorDraftDevice" -- apps/mobile/src apps/mobile/e2e scripts || true

echo '=== DIRECT STORE SYMBOLS ==='
git grep -nE "useHardwareSetupDraftStore|resetHardwareSetupDraftStore|setShellyNameInput|upsertShellyDevice|selectShellyDevice|setShellyDeviceName|setShellyScriptId|removeShellyDevice|setDiagnosticShellyId|setSensorProfileInput|setSensorMacInput|setSensorNameInput|upsertSensorDevice|selectSensorDevice|setSensorDeviceName|removeSensorDevice|setRulePreset|setOnThresholdInput|setOffThresholdInput|setVpdAssistEnabled|setVpdTargetInput|setRssiMinInput|setStaleTimeoutMinInput|setMinChangeMinInput|setMaxOnHoursInput" -- apps/mobile/src apps/mobile/e2e scripts || true

echo '=== LEGACY DRAFT STORAGE KEY ==='
git grep -n "lcl.hardwareSetupDraft.v8" -- apps/mobile/src apps/mobile/e2e scripts || true

echo '=== TYPE IMPORTERS ==='
git grep -nE "import type \{ (ShellyDraftDevice|SensorDraftDevice)|ShellyDraftDevice|SensorDraftDevice" -- apps/mobile/src/flows apps/mobile/src/screens || true

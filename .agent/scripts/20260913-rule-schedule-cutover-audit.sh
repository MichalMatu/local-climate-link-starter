#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='70c8fb0e989200479a05e57516ad12fbe763b8d5'

git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

printf '%s\n' '=== HEAD ==='
git rev-parse HEAD

printf '%s\n' '=== rule/time model references ==='
git grep -n -E 'dailyTimeSettingsSchema|DailyTimeAutomationConfig|onTime|offTime|ClimateRule|TimeRule|resolveClimateGeneratorConfig|climateRuleSchema|timeRuleSchema' -- apps/mobile packages/script-generator ':!**/*.snap' || true

printf '%s\n' '=== rule constructors / writes ==='
git grep -n -E "kind:[[:space:]]*['\"](climate|time)['\"]|addRule\(|updateRule\(|createRule|deployment:" -- apps/mobile/src ':!**/*.snap' || true

printf '%s\n' '=== generator config references ==='
git grep -n -E 'ShellyThermostatConfig|shellyThermostatConfigSchema|generateShellyThermostatScript|climateSettingsSchema' -- packages/script-generator apps/mobile/src ':!**/*.snap' || true

printf '%s\n' '=== tests around rules/time/generator ==='
find apps/mobile/src packages/script-generator/src -type f \( -name '*test.ts' -o -name '*test.tsx' \) | sort | grep -E 'rules|time|generator|runtime|selector|store|repository|climate' || true

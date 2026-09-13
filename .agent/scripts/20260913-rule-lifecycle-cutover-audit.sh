#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BRANCH='work/device-rule-decoupling-20260913'
git fetch origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
echo "HEAD=$(git rev-parse HEAD)"
echo '=== rules files ==='
find apps/mobile/src/flows/rules -maxdepth 1 -type f -print | sort
echo '=== registry/store APIs ==='
sed -n '1,260p' apps/mobile/src/flows/registry/devicesAndRules.ts
sed -n '1,260p' apps/mobile/src/flows/rules/store.ts || true
echo '=== rule model ==='
sed -n '1,320p' apps/mobile/src/flows/rules/model.ts
echo '=== rule selectors ==='
sed -n '1,260p' apps/mobile/src/flows/rules/selectors.ts
echo '=== app routes / dashboard / detail production imports ==='
grep -RInE "InstalledAutomation|InstallationDetail|useInstalledAutomation|HardwareSetupScreen|RuleSetupPage|setup-intent|type: 'installation'|type: \"installation\"" apps/mobile/src/app apps/mobile/src/routes apps/mobile/src/screens apps/mobile/src/flows --exclude='*.test.*' | head -n 400 || true
echo '=== existing setup and rule entry points ==='
find apps/mobile/src -maxdepth 4 -type f \( -name '*Rule*' -o -name '*Automation*' -o -name '*Setup*' \) -print | sort | head -n 250

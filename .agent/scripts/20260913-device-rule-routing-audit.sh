#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='71b6c8f3390644c581769dbb1a7f6c29d9699ae7'

git fetch --prune origin "$BRANCH" agent-control
test -z "$(git status --porcelain)"
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

printf '\n=== APP ROUTES ===\n'
sed -n '1,280p' apps/mobile/src/routes/AppRoutes.tsx
printf '\n=== ROUTE TEST FILES ===\n'
find apps/mobile/src -maxdepth 3 -type f \( -name '*route*.test.tsx' -o -name '*navigation*.test.tsx' -o -name 'app.test.tsx' \) -print | sort
printf '\n=== ROUTE TEST CONTENT ===\n'
for f in $(find apps/mobile/src -maxdepth 3 -type f \( -name '*route*.test.tsx' -o -name '*navigation*.test.tsx' \) | sort); do
  echo "--- $f"
  sed -n '1,360p' "$f"
done
printf '\n=== DEVICE SCREEN TEST REFERENCES ===\n'
grep -RIn --exclude-dir=node_modules -E 'PlugManagementScreen|SensorManagementScreen|navigation\.plugs|navigation\.sensors|AppBottomNavigation' apps/mobile/src | head -n 240 || true
printf '\n=== DEVICE SCREENS ===\n'
sed -n '1,320p' apps/mobile/src/screens/devices/PlugManagementScreen.tsx
sed -n '1,240p' apps/mobile/src/screens/devices/SensorManagementScreen.tsx
printf '\n=== STATUS ===\n'
git status --short
test -z "$(git status --porcelain)"

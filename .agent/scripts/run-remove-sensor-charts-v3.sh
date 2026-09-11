#!/usr/bin/env sh
set -eu

BASE=4462a5246e06f7cebcb5808eace2d6278988e56e
BRANCH=work/remove-sensor-charts-20260911

git fetch --prune origin
test "$(git rev-parse origin/main)" = "$BASE"
git checkout -B "$BRANCH" "$BASE" >/dev/null
test -z "$(git status --porcelain)"

git show origin/agent-control:.agent/scripts/remove-sensor-charts-v1.py > /tmp/remove-sensor-charts-v1.py
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/remove-sensor-charts-v1.py')
s = p.read_text()
old = "for forbidden in ('historyCalls', 'stopCountAtHistoryStart', 'Pobierz historię', 'Wykres temperatury', 'lcl-sparkline'):"
new = "for forbidden in ('historyCalls', 'stopCountAtHistoryStart', 'Wykres temperatury', 'lcl-sparkline'):"
if s.count(old) != 1:
    raise SystemExit('could not adjust chart patch test guard')
p.write_text(s.replace(old, new, 1))
PY
python3 /tmp/remove-sensor-charts-v1.py

git show origin/agent-control:.agent/scripts/remove-sensor-charts-v2-fix.py > /tmp/remove-sensor-charts-v2-fix.py
python3 /tmp/remove-sensor-charts-v2-fix.py

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/sensorReadingsStore.ts \
  apps/mobile/src/flows/hardware-setup/sensorReadingsStore.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/hardware-setup.test.tsx \
  apps/mobile/src/app/locales/*.ts \
  packages/ui/src/index.ts \
  packages/ui/src/styles.css \
  docs/plan.md \
  docs/compatibility/sensors.md \
  docs/parser-sources.md \
  docs/HANDOFF_NEXT_CHAT.md

echo '=== POST-REMOVAL AUDIT ==='
if git grep -n -E 'Sparkline|lcl-sparkline|sensor-data-chart|sensor-chart-stack|temperatureChartLabel|humidityChartLabel|fetchPvvxHistoryMutation|pvvxHistory' -- apps/mobile/src packages/ui/src; then
  echo 'chart/history UI references remain' >&2
  exit 31
fi
if git ls-files | grep -Ei 'sparkline'; then
  echo 'sparkline files remain' >&2
  exit 32
fi
if git grep -n 'HARDWARE_SETUP_READINGS_STORAGE_KEY' -- apps/mobile/src; then
  echo 'chart sample persistence key remains' >&2
  exit 33
fi
if git grep -n 'appendSensorReadings' -- apps/mobile/src; then
  echo 'multi-sample chart append path remains' >&2
  exit 34
fi
if git grep -n 'Pobierz historię' -- apps/mobile/src; then
  echo 'history UI label remains' >&2
  exit 35
fi

git diff --check
pnpm --filter @lcl/ui test
pnpm --filter @lcl/mobile test
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile lint
pnpm quality:repo
pnpm quality:ux
pnpm check:full

test -n "$(git status --porcelain)"
git add apps/mobile/src packages/ui/src docs
git commit -m 'refactor(mobile): remove sensor charts and history UI'
git push -u origin "$BRANCH"

echo CHART_REMOVAL_SHA=$(git rev-parse HEAD)
echo CHART_REMOVAL_BRANCH=$BRANCH
echo CHART_REMOVAL_OK=1

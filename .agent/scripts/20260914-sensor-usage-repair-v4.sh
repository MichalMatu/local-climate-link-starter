#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=2edb38a0af814af09ebf001ddf57cac7d0622f25
cd "$REPO"

git fetch origin "$BRANCH" agent-control
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }

git show origin/agent-control:.agent/scripts/20260914-sensor-usage-repair-v3.sh > /tmp/lcl-sensor-usage-v3.sh
(bash /tmp/lcl-sensor-usage-v3.sh || true)

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s = p.read_text()
old = '''              <SensorRuleUsageList\n                label={t('hardware.sensor.usedBy')}\n                usages={usages}\n                onOpenRule={onOpenRule}\n              />'''
new = '''              <SensorRuleUsageList\n                label={t('hardware.sensor.usedBy')}\n                usages={usages}\n                {...(onOpenRule ? { onOpenRule } : {})}\n              />'''
if old not in s:
    raise SystemExit('SensorRuleUsageList call anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx

LINES=$(wc -l < apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx | tr -d ' ')
echo "SensorSetupPage lines=$LINES"
[[ "$LINES" -le 650 ]] || { echo 'SensorSetupPage exceeds responsibility limit'; exit 3; }

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/devices/sensors/usage.test.ts \
  src/flows/devices/sensors/useSensorManagementFlow.test.ts \
  src/__tests__/app-routes.test.tsx \
  src/__tests__/i18n.test.ts
pnpm lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add \
  apps/mobile/src/screens/hardware-setup/pageContracts.ts \
  apps/mobile/src/flows/devices/sensors/usage.ts \
  apps/mobile/src/flows/devices/sensors/usage.test.ts \
  apps/mobile/src/screens/devices/SensorManagementScreen.tsx \
  apps/mobile/src/screens/devices/SensorRuleUsageList.tsx \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/app/locales/{de,en,es,fr,it,pl,ptBr}.ts

git commit -m "Show rule usage for thermometers"

git fetch origin "$BRANCH"
REMOTE_AFTER=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE_AFTER" == "$EXPECTED" ]] || { echo "Remote head changed before push: $REMOTE_AFTER"; exit 4; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse "origin/$BRANCH")
echo "FINAL_HEAD=$FINAL_HEAD"

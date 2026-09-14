#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
BASE=51ea2c6652922415e1d49d9d054c6644d8af8413
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s=p.read_text()
s=s.replace("                      '— °C'\n", "                      t('common.missingData')\n")
s=s.replace("                    {formatNullableMetric(humiditySample?.humidityPct, '%', 1, '— %')}\n", "                    {formatNullableMetric(\n                      humiditySample?.humidityPct,\n                      '%',\n                      1,\n                      t('common.missingData')\n                    )}\n")
p.write_text(s)

p=Path('apps/mobile/src/theme/theme.css')
s=p.read_text()
needle=".sensor-data-metric-card--empty .sensor-data-metric-card__value,\n.sensor-data-metric-card__value--empty {\n  color: var(--lcl-color-text-muted);\n  opacity: var(--lcl-opacity-muted);\n}"
replacement=".sensor-data-metric-card--empty .sensor-data-metric-card__value,\n.sensor-data-metric-card__value--empty {\n  color: var(--lcl-color-text-muted);\n  font-size: var(--lcl-font-size-lg);\n  opacity: var(--lcl-opacity-muted);\n}"
if needle not in s:
    raise SystemExit('sensor empty-state CSS marker missing')
p.write_text(s.replace(needle,replacement))
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/theme/theme.css
pnpm exec eslint apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck

git add apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx apps/mobile/src/theme/theme.css
git commit --no-verify -m "Restore thermometer empty-state styling"
HUSKY=0 git push origin HEAD:"$BRANCH"
echo "FINAL_HEAD=$(git rev-parse HEAD)"

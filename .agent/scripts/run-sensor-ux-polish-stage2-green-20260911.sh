#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=d8d7e08643923537386b9a1386debec8b0202a8e

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-sensor-ux-polish-stage2-final-20260911.sh > /tmp/sensor-stage2-green-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/sensor-stage2-green-inner.sh')
s = p.read_text()
old = "name: 'Usuń termometr'"
new = "name: 'Usuń termometr tylko z aplikacji'"
count = s.count(old)
if count != 3:
    raise SystemExit(f'delete-label marker mismatch: {count}')
p.write_text(s.replace(old, new))
PY
sh /tmp/sensor-stage2-green-inner.sh

pnpm --filter @lcl/mobile build
git diff --check
git add \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/hardware-setup.test.tsx
git diff --cached --check
git commit -m "Polish saved thermometer cards"
git push --force-with-lease origin "$BRANCH"

echo SENSOR_STAGE2_BRANCH=$BRANCH
echo SENSOR_STAGE2_BASE=$BASE
echo SENSOR_STAGE2_SHA=$(git rev-parse HEAD)

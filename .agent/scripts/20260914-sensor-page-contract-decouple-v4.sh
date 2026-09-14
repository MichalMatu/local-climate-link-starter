#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=16a3371339f7150fc368c48053b978737b7cda54
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

python3 - <<'PY'
from pathlib import Path

contracts = Path('apps/mobile/src/screens/hardware-setup/pageContracts.ts')
text = contracts.read_text()
old_import = "import type { HardwareSetupFlow } from '../../flows/hardware-setup/useHardwareSetupFlow.js';\n"
sensor_import = "import type { SensorManagementFlow } from '../../flows/devices/sensors/useSensorManagementFlow.js';\n"
registry_import = "import type { RegistryResult } from '../../flows/registry/result.js';\n"
if sensor_import not in text:
    if old_import not in text:
        raise SystemExit('Expected HardwareSetupFlow import not found')
    text = text.replace(old_import, old_import + sensor_import, 1)

start = text.index('export type SensorSetupFlow = Pick<')
end_marker = "\n\nexport type RuleSetupFlow = Pick<"
end = text.index(end_marker, start)
text = text[:start] + 'export type SensorSetupFlow = SensorManagementFlow;' + text[end:]
text = text.replace(registry_import, '')
contracts.write_text(text)
PY

rm apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx
rm apps/mobile/src/__tests__/hardware-setup.test.tsx

pnpm exec prettier --write apps/mobile/src/screens/hardware-setup/pageContracts.ts

grep -q "SensorSetupFlow" apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
grep -q "export type SensorSetupFlow = SensorManagementFlow;" apps/mobile/src/screens/hardware-setup/pageContracts.ts
! grep -q "RegistryResult" apps/mobile/src/screens/hardware-setup/pageContracts.ts
! grep -q "HardwareSetupScreen" apps/mobile/src/routes/AppRoutes.tsx

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/devices/sensors/useSensorManagementFlow.test.ts \
  src/flows/devices/sensors/usage.test.ts \
  src/__tests__/app-routes.test.tsx \
  src/__tests__/i18n.test.ts
pnpm lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add \
  apps/mobile/src/screens/hardware-setup/pageContracts.ts \
  apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx \
  apps/mobile/src/__tests__/hardware-setup.test.tsx
pnpm precommit

git commit -m "Decouple thermometer page from legacy setup flow"

git fetch origin "$BRANCH"
[[ "$(git rev-parse origin/$BRANCH)" == "$EXPECTED" ]] || { echo "Remote branch moved before push"; exit 4; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse HEAD)
[[ "$FINAL_HEAD" == "$(git rev-parse origin/$BRANCH)" ]] || { echo 'Push verification failed'; exit 5; }
echo "FINAL_HEAD=$FINAL_HEAD"

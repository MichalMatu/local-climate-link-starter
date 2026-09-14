#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=2edb38a0af814af09ebf001ddf57cac7d0622f25
cd "$REPO"

git fetch origin "$BRANCH"
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }

python3 - <<'PY'
from pathlib import Path

# The shared legacy SensorSetupFlow still supports the old setup screen where removal
# returns void. Product sensor management returns RegistryResult so the UI can surface
# blocked removals. Express both until the legacy setup path is deleted.
p = Path('apps/mobile/src/screens/hardware-setup/pageContracts.ts')
s = p.read_text()
if "import type { RegistryResult } from '../../flows/registry/result.js';" not in s:
    s = s.replace(
        "import type { HardwareSetupFlow } from '../../flows/hardware-setup/useHardwareSetupFlow.js';",
        "import type { HardwareSetupFlow } from '../../flows/hardware-setup/useHardwareSetupFlow.js';\nimport type { RegistryResult } from '../../flows/registry/result.js';"
    )
s = s.replace(
    "export type SensorSetupFlow = Pick<\n  HardwareSetupFlow,\n",
    "export type SensorSetupFlow = Pick<\n  HardwareSetupFlow,\n"
)
s = s.replace("  | 'removeSensorDevice'\n", "")
anchor = ">;\n\nexport type RuleSetupFlow"
replacement = "> & {\n  removeSensorDevice(id: string): RegistryResult<null> | void;\n};\n\nexport type RuleSetupFlow"
if anchor not in s:
    raise SystemExit('SensorSetupFlow end anchor missing')
s = s.replace(anchor, replacement, 1)
p.write_text(s)

p = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s = p.read_text()
old = """    const removed = flow.removeSensorDevice(sensorPendingRemoval.id);\n    if (!removed.ok) {\n      const detail =\n        removed.error.kind === 'device-referenced'\n          ? t('hardware.sensor.deleteBlockedByRule')\n          : t('common.operationFailed');\n      pushToast('warning', t('hardware.sensor.deleteFailedTitle'), detail);\n      return;\n    }\n    setDialog({ kind: 'none' });\n    pushToast('ok', t('hardware.sensor.removed'));"""
new = """    const removed = flow.removeSensorDevice(sensorPendingRemoval.id);\n    if (removed && !removed.ok) {\n      const detail =\n        removed.error.kind === 'device-referenced'\n          ? t('hardware.sensor.deleteBlockedByRule')\n          : t('common.operationFailed');\n      pushToast('warning', t('hardware.sensor.deleteFailedTitle'), detail);\n      return;\n    }\n    setDialog({ kind: 'none' });\n    pushToast('ok', t('hardware.sensor.removed'));"""
if old not in s:
    raise SystemExit('Sensor removal result block missing')
s = s.replace(old, new, 1)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pageContracts.ts \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/flows/devices/sensors/usage.ts \
  apps/mobile/src/flows/devices/sensors/usage.test.ts \
  apps/mobile/src/screens/devices/SensorManagementScreen.tsx \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/app/locales/{de,en,es,fr,it,pl,ptBr}.ts

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

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

sensor = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
text = sensor.read_text()
text = text.replace("import type { SensorSetupFlow } from '../pageContracts.js';\n", "import type { SensorManagementFlow } from '../../../flows/devices/sensors/useSensorManagementFlow.js';\n")
text = text.replace("import type { HardwarePageProps } from '../helpers.js';\n", "")
text = text.replace("type SensorDraftDevice = SensorSetupFlow['sensorDevices'][number];", "type SensorDraftDevice = SensorManagementFlow['sensorDevices'][number];")
text = text.replace("  flow: SensorSetupFlow;\n  showValidationErrors: boolean;", "  flow: SensorManagementFlow;\n  showValidationErrors: boolean;")
text = text.replace("type SensorSetupPageProps = HardwarePageProps<SensorSetupFlow> & {\n", "type SensorSetupPageProps = {\n  flow: SensorManagementFlow;\n")
sensor.write_text(text)

feedback = Path('apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts')
text = feedback.read_text()
text = text.replace("import { mutationError } from '../helpers.js';\n", "")
text = text.replace("import type { SensorSetupFlow } from '../pageContracts.js';\n", "import type { SensorManagementFlow } from '../../../flows/devices/sensors/useSensorManagementFlow.js';\n")
text = text.replace("type PushToast = (tone: ToastTone, title: string, detail?: string) => void;\n\n", "type PushToast = (tone: ToastTone, title: string, detail?: string) => void;\n\nconst mutationError = (error: unknown, fallback: string): string =>\n  error instanceof Error\n    ? error.message\n    : typeof error === 'object' &&\n        error !== null &&\n        'message' in error &&\n        typeof error.message === 'string'\n      ? error.message\n      : fallback;\n\n")
text = text.replace("  flow: SensorSetupFlow;", "  flow: SensorManagementFlow;")
text = text.replace("const message = mutationError(flow.phoneBleScanMutation.error);", "const message = mutationError(flow.phoneBleScanMutation.error, t('common.operationFailed'));")
text = text.replace("mutationError(flow.setPvvxTimeMutation.error)", "mutationError(flow.setPvvxTimeMutation.error, t('common.operationFailed'))")
feedback.write_text(text)
PY

# The old HardwareSetupScreen is no longer routed by AppRoutes. It is the only caller
# incompatible with the modern sensor-management contract, so remove that closed UI/test pair.
python3 - <<'PY'
from pathlib import Path
roots = [Path('apps/mobile/src'), Path('apps/mobile/e2e')]
needle = 'HardwareSetupScreen'
allowed = {
    Path('apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx'),
    Path('apps/mobile/src/__tests__/hardware-setup.test.tsx'),
}
violations=[]
for root in roots:
    if not root.exists(): continue
    for p in root.rglob('*'):
        if not p.is_file() or p.suffix not in {'.ts','.tsx','.js','.mjs'}: continue
        if p in allowed: continue
        text=p.read_text(errors='ignore')
        if needle in text:
            violations.append(str(p))
if violations:
    print('Unexpected HardwareSetupScreen references:')
    print('\n'.join(violations))
    raise SystemExit(4)
PY

rm apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx
rm apps/mobile/src/__tests__/hardware-setup.test.tsx

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts

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
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts \
  apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx \
  apps/mobile/src/__tests__/hardware-setup.test.tsx
pnpm precommit

git commit -m "Decouple thermometer UI from legacy setup flow"

git fetch origin "$BRANCH"
[[ "$(git rev-parse origin/$BRANCH)" == "$EXPECTED" ]] || { echo "Remote branch moved before push"; exit 5; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
echo "FINAL_HEAD=$(git rev-parse origin/$BRANCH)"

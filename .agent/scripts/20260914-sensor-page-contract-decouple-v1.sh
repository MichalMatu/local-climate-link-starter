#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=16a3371339f7150fc368c48053b978737b7cda54
cd "$REPO"

git fetch origin "$BRANCH" agent-control
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }
git checkout "$BRANCH"
git reset --hard "$REMOTE"
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

python3 - <<'PY'
from pathlib import Path

page = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s = page.read_text()
s = s.replace(
    "import type { SensorSetupFlow } from '../pageContracts.js';\n",
    "import type { SensorManagementFlow } from '../../../flows/devices/sensors/useSensorManagementFlow.js';\n"
)
s = s.replace("import type { HardwarePageProps } from '../helpers.js';\n", "")
s = s.replace('SensorSetupFlow', 'SensorManagementFlow')
s = s.replace(
    "type SensorSetupPageProps = HardwarePageProps<SensorManagementFlow> & {\n",
    "type SensorSetupPageProps = {\n  flow: SensorManagementFlow;\n"
)
page.write_text(s)

feedback = Path('apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts')
s = feedback.read_text()
s = s.replace("import { mutationError } from '../helpers.js';\n", "")
s = s.replace(
    "import type { SensorSetupFlow } from '../pageContracts.js';\n",
    "import type { SensorManagementFlow } from '../../../flows/devices/sensors/useSensorManagementFlow.js';\n"
)
s = s.replace('flow: SensorSetupFlow;', 'flow: SensorManagementFlow;')
anchor = "type PushToast = (tone: ToastTone, title: string, detail?: string) => void;\n"
helper = """type PushToast = (tone: ToastTone, title: string, detail?: string) => void;\n\nconst mutationError = (error: unknown): string =>\n  error instanceof Error\n    ? error.message\n    : typeof error === 'object' &&\n        error !== null &&\n        'message' in error &&\n        typeof error.message === 'string'\n      ? error.message\n      : 'Operation failed';\n"""
if anchor not in s:
    raise SystemExit('feedback anchor missing')
s = s.replace(anchor, helper, 1)
feedback.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts

python3 - <<'PY'
from pathlib import Path
for raw in [
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts',
]:
    text = Path(raw).read_text()
    forbidden = ['SensorSetupFlow', 'HardwareSetupFlow', "../pageContracts.js", "../helpers.js"]
    found = [needle for needle in forbidden if needle in text]
    if found:
        raise SystemExit(f'{raw} still depends on legacy contract: {found}')
PY

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/devices/sensors/useSensorManagementFlow.test.ts \
  src/flows/devices/sensors/usage.test.ts \
  src/__tests__/app-routes.test.tsx
pnpm lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts

git commit -m "Decouple thermometer UI from legacy setup flow"

git fetch origin "$BRANCH"
REMOTE_AFTER=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE_AFTER" == "$EXPECTED" ]] || { echo "Remote head changed before push: $REMOTE_AFTER"; exit 6; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse "origin/$BRANCH")
echo "FINAL_HEAD=$FINAL_HEAD"

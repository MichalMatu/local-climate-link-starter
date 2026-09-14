#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=54b212b9d1384ab56db3fddcb5af0e092ff46f36
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

cat > apps/mobile/src/flows/hardware-setup/draftDevices.ts <<'EOF'
import type { SensorProfileId } from '@lcl/device-profiles';

export type ShellyDraftDevice = {
  id: string;
  name: string;
  baseUrl: string;
  scriptIdInput: string;
};

export type SensorDraftDevice = {
  id: string;
  name: string;
  runtimeAddress: string;
  profileId: SensorProfileId;
};
EOF

for path in \
  apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts; do
  perl -0pi -e "s#'\./setupDraftStore\.js'#'./draftDevices.js'#g" "$path"
done

rm apps/mobile/src/flows/hardware-setup/setupDraftStore.ts

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/draftDevices.ts \
  apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts

! git grep -nE 'setupDraftStore|useHardwareSetupDraftStore|resetHardwareSetupDraftStore|DEFAULT_HARDWARE_SETUP_DRAFT|HARDWARE_SETUP_DRAFT_STORAGE_KEY' -- apps/mobile/src
! git grep -nE 'from .*/installations|from .*/time-automation' -- apps/mobile/src

git add \
  apps/mobile/src/flows/hardware-setup/draftDevices.ts \
  apps/mobile/src/flows/hardware-setup/ruleConfigDerivation.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts \
  apps/mobile/src/flows/hardware-setup/setupDraftStore.ts

pnpm precommit
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile test
pnpm lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git commit -m "Remove legacy setup draft store"

git fetch origin "$BRANCH"
[[ "$(git rev-parse origin/$BRANCH)" == "$EXPECTED" ]] || { echo "Remote branch moved before push"; exit 5; }
pnpm prepush
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse HEAD)
[[ "$FINAL_HEAD" == "$(git rev-parse origin/$BRANCH)" ]] || { echo 'Push verification failed'; exit 6; }
echo "FINAL_HEAD=$FINAL_HEAD"

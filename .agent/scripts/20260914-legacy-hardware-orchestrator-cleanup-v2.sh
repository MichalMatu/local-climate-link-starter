#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=ad67e2f115ecd6f48200bfef83d27f8402d41de9
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

DELETE=(
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
  apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts
  apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.test.ts
  apps/mobile/src/flows/time-automation/useTimeAutomationSetupFlow.ts
  apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx
  apps/mobile/src/screens/hardware-setup/pages/RuleAdvancedSettingsModal.tsx
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx
  apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
  apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts
  apps/mobile/src/screens/hardware-setup/pages/useShellySetupFeedback.ts
)
for path in "${DELETE[@]}"; do
  [[ -f "$path" ]] || { echo "Missing deletion target: $path"; exit 4; }
done

python3 - <<'PY'
from pathlib import Path

contracts = Path('apps/mobile/src/screens/hardware-setup/pageContracts.ts')
contracts.write_text("""import type { SensorManagementFlow } from '../../flows/devices/sensors/useSensorManagementFlow.js';

export type SensorSetupFlow = SensorManagementFlow;
""")

helpers = Path('apps/mobile/src/screens/hardware-setup/helpers.ts')
helpers.write_text("""import { t } from '../../app/i18n.js';

export const mutationError = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ? error.message
      : t('common.operationFailed');

export interface HardwarePageProps<TFlow> {
  flow: TFlow;
}
""")

quality = Path('scripts/quality/repository-gate.mjs')
text = quality.read_text()
start = text.index('const checkHardwareSetupArchitecture = async () => {')
end = text.index('\n\nawait checkReleaseVersionConsistency();', start)
replacement = r'''const checkHardwareSetupArchitecture = async () => {
  const subsystemBudgets = {
    'apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts': 350
  };
  for (const [path, maxLines] of Object.entries(subsystemBudgets)) {
    const source = await readRepoFile(path);
    const lines = source.split('\n').length;
    if (lines > maxLines) {
      addFailure(
        path,
        `extracted hardware subsystem exceeds ${maxLines} lines (${lines})`
      );
    }
  }

  const compositionBudgets = {
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx': 650,
    'apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts': 200
  };
  for (const [path, maxLines] of Object.entries(compositionBudgets)) {
    const source = await readRepoFile(path);
    const lines = source.split('\n').length;
    if (lines > maxLines) {
      addFailure(
        path,
        `hardware setup responsibility boundary exceeds ${maxLines} lines (${lines}); keep the extracted responsibility cohesive instead of regrowing a god object`
      );
    }
  }

  const pageContracts = {
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx': 'SensorSetupFlow'
  };
  for (const [path, contract] of Object.entries(pageContracts)) {
    const source = await readRepoFile(path);
    if (!source.includes(contract)) {
      addFailure(path, `hardware setup page must use the narrow ${contract} contract`);
    }
    if (source.includes('HardwareSetupFlow')) {
      addFailure(path, 'hardware setup page must not depend on the legacy HardwareSetupFlow');
    }
  }
};'''
quality.write_text(text[:start] + replacement + text[end:])

ux = Path('scripts/quality/ux-gate.mjs')
text = ux.read_text()
old_paths = """const hardwareSetupPagePaths = [
  'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx',
  'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx',
  'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx',
  'apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx',
  'apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx'
];"""
new_paths = """const hardwareSetupPagePaths = [
  'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
];"""
if old_paths not in text:
    raise SystemExit('Expected UX hardwareSetupPagePaths block not found')
text = text.replace(old_paths, new_paths, 1)

start = text.index('const checkFeedbackContractPatterns = async () => {')
end = text.index('\n\nconst checkUiPackageFeedbackPatterns = async () => {', start)
replacement = r'''const checkFeedbackContractPatterns = async () => {
  for (const path of feedbackContractPagePaths) {
    const source = await readRepoFile(path);
    const blockedClass = source.match(/\b(?:warning-box|notice-box)\b/);
    const inlineLiveRegion = source.match(/role=\{?["'](?:alert|status)["']/);

    if (blockedClass) {
      addFailure(
        path,
        `legacy inline ${blockedClass[0]} found; use field__error, ToastViewport, Modal, or compact diagnostics according to the feedback contract`
      );
    }

    if (inlineLiveRegion) {
      addFailure(
        path,
        'setup flow pages must not render inline role="alert"/role="status"; transient feedback belongs in ToastViewport'
      );
    }

    if (source.includes('pushToast(') && !source.includes('<ToastViewport')) {
      addFailure(path, 'pushToast usage must render the shared ToastViewport');
    }

    if (
      /const \[is[A-Z][A-Za-z0-9]*ModalOpen,\s*setIs[A-Z][A-Za-z0-9]*ModalOpen\]\s*=\s*useState/.test(
        source
      )
    ) {
      addFailure(
        path,
        'setup pages with multiple dialogs must use one cohesive dialog state instead of independent modal booleans'
      );
    }
  }
};'''
text = text[:start] + replacement + text[end:]
text = text.replace('await checkSavedShellyCardFeedback();\n', '', 1)
ux.write_text(text)
PY

rm "${DELETE[@]}"

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pageContracts.ts \
  apps/mobile/src/screens/hardware-setup/helpers.ts \
  scripts/quality/repository-gate.mjs \
  scripts/quality/ux-gate.mjs

! grep -R "useHardwareSetupFlow\|useClimateAutomationInstallFlow\|useTimeAutomationSetupFlow\|HardwareSetupFlow" \
  apps/mobile/src/routes apps/mobile/src/screens/devices apps/mobile/src/screens/rules \
  --include='*.ts' --include='*.tsx'
grep -q "export type SensorSetupFlow = SensorManagementFlow;" apps/mobile/src/screens/hardware-setup/pageContracts.ts
grep -q "SensorSetupFlow" apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
! grep -q "ShellySetupPresentation.tsx" scripts/quality/ux-gate.mjs
! grep -q "RuleSetupPage.tsx" scripts/quality/ux-gate.mjs

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/devices/sensors/useSensorManagementFlow.test.ts \
  src/flows/devices/sensors/usage.test.ts \
  src/__tests__/app-routes.test.tsx \
  src/__tests__/rule-detail.test.tsx \
  src/__tests__/automation-dashboard.test.tsx
pnpm lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts \
  apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts \
  apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.test.ts \
  apps/mobile/src/flows/time-automation/useTimeAutomationSetupFlow.ts \
  apps/mobile/src/screens/hardware-setup/pageContracts.ts \
  apps/mobile/src/screens/hardware-setup/helpers.ts \
  apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/RuleAdvancedSettingsModal.tsx \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts \
  apps/mobile/src/screens/hardware-setup/pages/useShellySetupFeedback.ts \
  scripts/quality/repository-gate.mjs \
  scripts/quality/ux-gate.mjs
pnpm precommit

git commit -m "Remove legacy hardware setup orchestrator"

git fetch origin "$BRANCH"
[[ "$(git rev-parse origin/$BRANCH)" == "$EXPECTED" ]] || { echo "Remote branch moved before push"; exit 5; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse HEAD)
[[ "$FINAL_HEAD" == "$(git rev-parse origin/$BRANCH)" ]] || { echo 'Push verification failed'; exit 6; }
echo "FINAL_HEAD=$FINAL_HEAD"

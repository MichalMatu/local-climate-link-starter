#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='f39121476685416fc93662891e62dc4d53342c10'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

cat > apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts <<'EOF'
import type { ToastTone } from '@lcl/ui';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Translate } from '../../../app/i18n.js';
import { mutationError } from '../helpers.js';
import type { RuleSetupFlow } from '../pageContracts.js';

export type RuleDialogState =
  | 'none'
  | 'summary'
  | 'vpd-info'
  | 'script'
  | 'advanced'
  | 'delete'
  | 'install-block'
  | 'relay-test';

type PushToast = (tone: ToastTone, title: string, detail?: string) => void;

type RuleSetupFeedbackOptions = {
  flow: RuleSetupFlow;
  pushToast: PushToast;
  setDialog: Dispatch<SetStateAction<RuleDialogState>>;
  t: Translate;
};

export const useRuleSetupFeedback = ({
  flow,
  pushToast,
  setDialog,
  t
}: RuleSetupFeedbackOptions): void => {
  useEffect(() => {
    setDialog((current) => (current === 'delete' ? 'none' : current));
  }, [flow.selectedShellyId, setDialog]);

  useEffect(() => {
    if (!flow.loadAutomationScriptMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.rule.readScriptFailedTitle'),
      mutationError(flow.loadAutomationScriptMutation.error)
    );
    flow.loadAutomationScriptMutation.reset();
  }, [flow.loadAutomationScriptMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.loadAutomationScriptMutation.isSuccess) {
      return;
    }
    pushToast('ok', t('hardware.rule.loadScriptDone'));
    flow.loadAutomationScriptMutation.reset();
  }, [flow.loadAutomationScriptMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.deleteAutomationScriptMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.rule.deleteScriptFailedTitle'),
      mutationError(flow.deleteAutomationScriptMutation.error)
    );
    flow.deleteAutomationScriptMutation.reset();
  }, [flow.deleteAutomationScriptMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.deleteAutomationScriptMutation.isSuccess) {
      return;
    }
    setDialog('none');
    pushToast('ok', t('hardware.rule.deleteScriptDone'));
    flow.deleteAutomationScriptMutation.reset();
  }, [flow.deleteAutomationScriptMutation, pushToast, setDialog, t]);

  useEffect(() => {
    if (!flow.installMutation.isError) {
      return;
    }
    setDialog('install-block');
  }, [flow.installMutation.error, flow.installMutation.isError, setDialog]);

  useEffect(() => {
    if (!flow.installMutation.isSuccess || !flow.canRunSafeRelayTest) {
      return;
    }
    setDialog('relay-test');
    flow.installMutation.reset();
  }, [flow.canRunSafeRelayTest, flow.installMutation, setDialog]);

  useEffect(() => {
    if (!flow.safeRelayTestMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.rule.relayTestFailedTitle'),
      mutationError(flow.safeRelayTestMutation.error)
    );
    flow.safeRelayTestMutation.reset();
  }, [flow.safeRelayTestMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.safeRelayTestMutation.isSuccess) {
      return;
    }
    setDialog('none');
    pushToast('ok', t('hardware.ready'), t('hardware.rule.relayTestDone'));
    flow.safeRelayTestMutation.reset();
  }, [flow.safeRelayTestMutation, pushToast, setDialog, t]);
};
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
s = p.read_text()
s = s.replace(
    "import { useCallback, useEffect, useId, useState } from 'react';",
    "import { useCallback, useId, useState } from 'react';"
)
s = s.replace(
    "import { useToastQueue } from '../useToastQueue.js';\n",
    "import { useToastQueue } from '../useToastQueue.js';\nimport {\n  useRuleSetupFeedback,\n  type RuleDialogState\n} from './useRuleSetupFeedback.js';\n"
)
old_type = """type RuleDialogState =
  | 'none'
  | 'summary'
  | 'vpd-info'
  | 'script'
  | 'advanced'
  | 'delete'
  | 'install-block'
  | 'relay-test';

"""
assert old_type in s
s = s.replace(old_type, '', 1)
start_marker = """  useEffect(() => {
    setDialog((current) => (current === 'delete' ? 'none' : current));
  }, [flow.selectedShellyId]);

"""
end_marker = """  const loadScriptFromShelly = () => {
"""
start = s.index(start_marker)
end = s.index(end_marker, start)
replacement = """  useRuleSetupFeedback({ flow, pushToast, setDialog, t });

"""
s = s[:start] + replacement + s[end:]
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx

pnpm --dir apps/mobile exec vitest run \
  src/__tests__/hardware-setup.test.tsx \
  src/__tests__/modal.test.tsx
pnpm check
LCL_E2E_PORT=5191 pnpm e2e:responsive

git diff --check
LINES=$(wc -l < apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx | tr -d ' ')
echo RULE_SETUP_PAGE_LINES="$LINES"
test "$LINES" -lt 800

git add \
  apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx
git commit -m 'Extract rule setup feedback orchestration'
git push origin HEAD:"$BRANCH"

echo STAGE8C1_SHA=$(git rev-parse HEAD)
echo STAGE8C1_PARENT=$(git rev-parse HEAD^)
echo STAGE8C1_CHECK=1
echo STAGE8C1_E2E=1
echo STAGE8C1_RULE_LINES="$LINES"
test -z "$(git status --porcelain)"

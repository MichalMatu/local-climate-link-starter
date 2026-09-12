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
s = s[:start] + "  useRuleSetupFeedback({ flow, pushToast, setDialog, t });\n\n" + s[end:]
p.write_text(s)

q = Path('scripts/quality/ux-gate.mjs')
s = q.read_text()
old = """  const rulePath = 'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx';
  const ruleSource = await readRepoFile(rulePath);

  if (
    !ruleSource.includes(
      \"open={dialog === 'install-block' && flow.installMutation.isError}\"
    ) ||
    !ruleSource.includes(\"setDialog('install-block');\") ||
    !ruleSource.includes(
      '<FeedbackPanel tone=\"danger\" title={mutationError(flow.installMutation.error)}>'
    )
  ) {
    addFailure(
      rulePath,
      'installMutation.isError is a blocking install failure and must open a modal with FeedbackPanel, not inline content'
    );
  }

  const installErrorEffectEndMarker =
    '}, [flow.installMutation.error, flow.installMutation.isError]);';
  const installErrorEffectEndIndex = ruleSource.indexOf(installErrorEffectEndMarker);
  const installErrorEffectStartIndex =
    installErrorEffectEndIndex === -1
      ? -1
      : ruleSource.lastIndexOf('useEffect(() => {', installErrorEffectEndIndex);

  if (installErrorEffectStartIndex === -1 || installErrorEffectEndIndex === -1) {
    addFailure(
      rulePath,
      'cannot find installMutation.isError effect for feedback-contract verification'
    );
  } else {
    const installErrorEffectSource = ruleSource.slice(
      installErrorEffectStartIndex,
      installErrorEffectEndIndex + installErrorEffectEndMarker.length
    );
    if (installErrorEffectSource.includes('pushToast(')) {
      addFailure(
        rulePath,
        'blocking install failures must not be duplicated as toast feedback'
      );
    }
  }
"""
new = """  const rulePath = 'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx';
  const ruleFeedbackPath =
    'apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts';
  const ruleSource = await readRepoFile(rulePath);
  const ruleFeedbackSource = await readRepoFile(ruleFeedbackPath);

  if (
    !ruleSource.includes(
      \"open={dialog === 'install-block' && flow.installMutation.isError}\"
    ) ||
    !ruleSource.includes(
      '<FeedbackPanel tone=\"danger\" title={mutationError(flow.installMutation.error)}>'
    ) ||
    !ruleSource.includes('useRuleSetupFeedback({ flow, pushToast, setDialog, t });') ||
    !ruleFeedbackSource.includes(\"setDialog('install-block');\")
  ) {
    addFailure(
      rulePath,
      'installMutation.isError is a blocking install failure and must open a modal with FeedbackPanel, not inline content'
    );
  }

  const installErrorEffectEndMarker =
    '}, [flow.installMutation.error, flow.installMutation.isError, setDialog]);';
  const installErrorEffectEndIndex = ruleFeedbackSource.indexOf(installErrorEffectEndMarker);
  const installErrorEffectStartIndex =
    installErrorEffectEndIndex === -1
      ? -1
      : ruleFeedbackSource.lastIndexOf('useEffect(() => {', installErrorEffectEndIndex);

  if (installErrorEffectStartIndex === -1 || installErrorEffectEndIndex === -1) {
    addFailure(
      ruleFeedbackPath,
      'cannot find installMutation.isError effect for feedback-contract verification'
    );
  } else {
    const installErrorEffectSource = ruleFeedbackSource.slice(
      installErrorEffectStartIndex,
      installErrorEffectEndIndex + installErrorEffectEndMarker.length
    );
    if (installErrorEffectSource.includes('pushToast(')) {
      addFailure(
        ruleFeedbackPath,
        'blocking install failures must not be duplicated as toast feedback'
      );
    }
  }
"""
assert old in s
q.write_text(s.replace(old, new, 1))
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx \
  scripts/quality/ux-gate.mjs

pnpm --dir apps/mobile exec vitest run \
  src/__tests__/hardware-setup.test.tsx \
  src/__tests__/modal.test.tsx
pnpm quality:ux
pnpm check
LCL_E2E_PORT=5192 pnpm e2e:responsive

git diff --check
LINES=$(wc -l < apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx | tr -d ' ')
HOOK_LINES=$(wc -l < apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts | tr -d ' ')
echo RULE_SETUP_PAGE_LINES="$LINES"
echo RULE_SETUP_FEEDBACK_LINES="$HOOK_LINES"
test "$LINES" -lt 800
test "$HOOK_LINES" -lt 180

git add \
  apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx \
  scripts/quality/ux-gate.mjs
git commit -m 'Extract rule setup feedback orchestration'
git push origin HEAD:"$BRANCH"

echo STAGE8C1R_SHA=$(git rev-parse HEAD)
echo STAGE8C1R_PARENT=$(git rev-parse HEAD^)
echo STAGE8C1R_CHECK=1
echo STAGE8C1R_E2E=1
echo STAGE8C1R_RULE_LINES="$LINES"
echo STAGE8C1R_HOOK_LINES="$HOOK_LINES"
test -z "$(git status --porcelain)"

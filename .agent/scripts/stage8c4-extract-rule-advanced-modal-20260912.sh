#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='b96902278f2757d96e39163e525f957fb497142d'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

cat > apps/mobile/src/screens/hardware-setup/pages/RuleAdvancedSettingsModal.tsx <<'EOF'
import { Modal } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';
import {
  RULE_ADVANCED_LIMITS,
  type RuleAdvancedSettingsInput,
  validateRuleAdvancedSettings
} from '../../../flows/hardware-setup/ruleAdvancedSettings.js';

type RuleAdvancedSettingsModalProps = {
  draft: RuleAdvancedSettingsInput;
  open: boolean;
  onApply: () => void;
  onChange: (patch: Partial<RuleAdvancedSettingsInput>) => void;
  onClose: () => void;
  onReset: () => void;
};

export const RuleAdvancedSettingsModal = ({
  draft,
  open,
  onApply,
  onChange,
  onClose,
  onReset
}: RuleAdvancedSettingsModalProps) => {
  const { t } = useTranslation();
  const validation = validateRuleAdvancedSettings(draft);

  return (
    <Modal
      actions={
        <>
          <button
            className="secondary-action"
            type="button"
            title={t('hardware.rule.advancedDefaultsTitle')}
            onClick={onReset}
          >
            {t('common.default')}
          </button>
          <button
            className="primary-action"
            type="button"
            disabled={!validation.isValid}
            title={t('hardware.rule.advancedApplyTitle')}
            onClick={onApply}
          >
            {t('common.apply')}
          </button>
        </>
      }
      closeLabel={t('common.close')}
      open={open}
      title={t('hardware.rule.advancedTitle')}
      onClose={onClose}
    >
      <div className="advanced-settings">
        <section className="advanced-settings__section">
          <div className="field-row">
            <label className={`field ${validation.isMinChangeMinValid ? '' : 'field--invalid'}`}>
              {t('hardware.rule.minChangeLabel')}
              <input
                aria-describedby={validation.isMinChangeMinValid ? undefined : 'advanced-min-change-error'}
                aria-invalid={!validation.isMinChangeMinValid}
                max={RULE_ADVANCED_LIMITS.minChangeMinMax}
                min={RULE_ADVANCED_LIMITS.minChangeMinMin}
                step="0.25"
                type="number"
                value={draft.minChangeMinInput}
                onChange={(event) => onChange({ minChangeMinInput: event.currentTarget.value })}
              />
              {!validation.isMinChangeMinValid && (
                <span className="field__error" id="advanced-min-change-error">
                  {t('hardware.rule.range.minChange')}
                </span>
              )}
            </label>
            <label className={`field ${validation.isMaxOnHoursValid ? '' : 'field--invalid'}`}>
              {t('hardware.rule.maxOnHoursLabel')}
              <input
                aria-describedby={validation.isMaxOnHoursValid ? undefined : 'advanced-max-on-error'}
                aria-invalid={!validation.isMaxOnHoursValid}
                max={RULE_ADVANCED_LIMITS.maxOnHoursMax}
                min={RULE_ADVANCED_LIMITS.maxOnHoursMin}
                step="0.25"
                type="number"
                value={draft.maxOnHoursInput}
                onChange={(event) => onChange({ maxOnHoursInput: event.currentTarget.value })}
              />
              {!validation.isMaxOnHoursValid && (
                <span className="field__error" id="advanced-max-on-error">
                  {t('hardware.rule.range.maxOn')}
                </span>
              )}
            </label>
          </div>
          <div className="advanced-settings__readonly">
            <span>{t('hardware.rule.bootBehavior')}</span>
            <strong>{t('hardware.rule.bootBehaviorValue')}</strong>
          </div>
        </section>

        <section className="advanced-settings__section">
          <div className="field-row">
            <label className={`field ${validation.isStaleTimeoutValid ? '' : 'field--invalid'}`}>
              {t('hardware.rule.staleTimeoutLabel')}
              <input
                aria-describedby={validation.isStaleTimeoutValid ? undefined : 'advanced-stale-error'}
                aria-invalid={!validation.isStaleTimeoutValid}
                max={RULE_ADVANCED_LIMITS.staleTimeoutMinMax}
                min={RULE_ADVANCED_LIMITS.staleTimeoutMinMin}
                step="1"
                type="number"
                value={draft.staleTimeoutMinInput}
                onChange={(event) => onChange({ staleTimeoutMinInput: event.currentTarget.value })}
              />
              {!validation.isStaleTimeoutValid && (
                <span className="field__error" id="advanced-stale-error">
                  {t('hardware.rule.range.stale')}
                </span>
              )}
            </label>
            <label className={`field ${validation.isRssiMinValid ? '' : 'field--invalid'}`}>
              {t('hardware.rule.rssiMinLabel')}
              <input
                aria-describedby={validation.isRssiMinValid ? undefined : 'advanced-rssi-error'}
                aria-invalid={!validation.isRssiMinValid}
                max={RULE_ADVANCED_LIMITS.rssiMinMax}
                min={RULE_ADVANCED_LIMITS.rssiMinMin}
                step="1"
                type="number"
                value={draft.rssiMinInput}
                onChange={(event) => onChange({ rssiMinInput: event.currentTarget.value })}
              />
              {!validation.isRssiMinValid && (
                <span className="field__error" id="advanced-rssi-error">
                  {t('hardware.rule.range.rssi')}
                </span>
              )}
            </label>
          </div>
        </section>
      </div>
    </Modal>
  );
};
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
s = p.read_text()
s = s.replace(
    "import { useRuleSetupFeedback, type RuleDialogState } from './useRuleSetupFeedback.js';\n",
    "import { RuleAdvancedSettingsModal } from './RuleAdvancedSettingsModal.js';\nimport { useRuleSetupFeedback, type RuleDialogState } from './useRuleSetupFeedback.js';\n"
)
start_marker = '''      <Modal\n        actions={\n          <>\n            <button\n              className="secondary-action"\n              type="button"\n              title={t('hardware.rule.advancedDefaultsTitle')}'''
start = s.index(start_marker)
end = s.index('      <ToastViewport', start)
replacement = '''      <RuleAdvancedSettingsModal\n        draft={advancedDraft}\n        open={dialog === 'advanced'}\n        onApply={applyAdvancedDraft}\n        onChange={updateAdvancedDraft}\n        onClose={() => setDialog('none')}\n        onReset={resetAdvancedDraft}\n      />\n'''
s = s[:start] + replacement + s[end:]
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/RuleAdvancedSettingsModal.tsx \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx

pnpm --dir apps/mobile exec vitest run \
  src/__tests__/hardware-setup.test.tsx \
  src/__tests__/modal.test.tsx
pnpm check
LCL_E2E_PORT=5197 pnpm e2e:responsive

git diff --check
PAGE_LINES=$(wc -l < apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx | tr -d ' ')
MODAL_LINES=$(wc -l < apps/mobile/src/screens/hardware-setup/pages/RuleAdvancedSettingsModal.tsx | tr -d ' ')
echo STAGE8C4_RULE_LINES="$PAGE_LINES"
echo STAGE8C4_MODAL_LINES="$MODAL_LINES"
test "$PAGE_LINES" -lt 650

git add \
  apps/mobile/src/screens/hardware-setup/pages/RuleAdvancedSettingsModal.tsx \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx
git commit -m 'Extract advanced rule settings modal'
git push origin HEAD:"$BRANCH"

echo STAGE8C4_SHA=$(git rev-parse HEAD)
echo STAGE8C4_PARENT=$(git rev-parse HEAD^)
echo STAGE8C4_CHECK=1
echo STAGE8C4_E2E=1
echo STAGE8C4_RULE_LINES="$PAGE_LINES"
echo STAGE8C4_MODAL_LINES="$MODAL_LINES"
test -z "$(git status --porcelain)"

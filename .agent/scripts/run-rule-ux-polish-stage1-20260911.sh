#!/usr/bin/env sh
set -eu

BASE=885f2ed99bf818da0b38785e9d794dd5e4df8994
BRANCH=work/rule-ux-polish-stage1-20260911

git fetch --prune origin main >/dev/null
test "$(git rev-parse origin/main)" = "$BASE"
git checkout -B "$BRANCH" "$BASE" >/dev/null
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)

page_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
page = page_path.read_text()

page = replace_once(
    page,
    """import {\n  FeedbackPanel,\n  Modal,\n  RuleSummaryCard,\n  ScriptPreview,\n  ToastViewport\n} from '@lcl/ui';""",
    """import { FeedbackPanel, Modal, ScriptPreview, ToastViewport } from '@lcl/ui';""",
    'ui import'
)
page = replace_once(
    page,
    "import { IconTrash } from '@tabler/icons-react';",
    "import { IconInfoCircle, IconTrash } from '@tabler/icons-react';",
    'tabler import'
)
page = replace_once(
    page,
    """import {\n  canInstallScript,\n  mutationError,\n  runtimeAddressLabel,\n  shellyAddressLabel,\n  type HardwarePageProps\n} from '../helpers.js';""",
    """import { canInstallScript, mutationError, type HardwarePageProps } from '../helpers.js';""",
    'helper import'
)
page = replace_once(
    page,
    """type RuleDialogState =\n  'none' | 'script' | 'advanced' | 'delete' | 'install-block' | 'relay-test';""",
    """type RuleDialogState =\n  | 'none'\n  | 'summary'\n  | 'vpd-info'\n  | 'script'\n  | 'advanced'\n  | 'delete'\n  | 'install-block'\n  | 'relay-test';""",
    'dialog state'
)
page = replace_once(
    page,
    """  shellyAddress,\n  sensorRuntimeAddress,""",
    """  shellyName,\n  sensorName,""",
    'summary args destructuring'
)
page = replace_once(
    page,
    """  shellyAddress?: string | undefined;\n  sensorRuntimeAddress?: string | undefined;""",
    """  shellyName?: string | undefined;\n  sensorName?: string | undefined;""",
    'summary arg types'
)
page = replace_once(
    page,
    """  const sensorLabel = sensorRuntimeAddress\n    ? t('hardware.rule.summarySensorNamed', { address: sensorRuntimeAddress })\n    : t('hardware.rule.summarySensorDefault');\n  const shellyLabel = shellyAddress\n    ? t('hardware.rule.summaryShellyNamed', { address: shellyAddress })\n    : t('hardware.rule.summaryShellyDefault');""",
    """  const sensorLabel = sensorName\n    ? t('hardware.rule.summarySensorNamed', { address: sensorName })\n    : t('hardware.rule.summarySensorDefault');\n  const shellyLabel = shellyName\n    ? t('hardware.rule.summaryShellyNamed', { address: shellyName })\n    : t('hardware.rule.summaryShellyDefault');""",
    'summary labels'
)
page = replace_once(
    page,
    """  const vpdHintId = useId();\n  const vpdErrorId = useId();""",
    """  const vpdErrorId = useId();""",
    'vpd hint id'
)
page = replace_once(
    page,
    """    shellyAddress: flow.selectedShelly ? shellyAddressLabel(flow) : undefined,\n    sensorRuntimeAddress: flow.selectedSensor ? runtimeAddressLabel(flow) : undefined,""",
    """    shellyName: flow.selectedShelly?.name,\n    sensorName: flow.selectedSensor?.name,""",
    'summary device labels'
)

old_vpd = """      <section className=\"rule-vpd-assist\">\n        <div className=\"rule-vpd-assist__header\">\n          <div>\n            <strong>{t('hardware.rule.vpdAssistTitle')}</strong>\n            <p>{t('hardware.rule.vpdAssistHint')}</p>\n          </div>\n          <label className=\"toggle-row rule-vpd-assist__toggle\">\n            <input\n              aria-label={t('hardware.rule.vpdAssistTitle')}\n              type=\"checkbox\"\n              checked={flow.vpdAssistEnabled}\n              onChange={(event) => flow.setVpdAssistEnabled(event.currentTarget.checked)}\n            />\n            <span>\n              {flow.vpdAssistEnabled ? t('common.enabled') : t('common.disabled')}\n            </span>\n          </label>\n        </div>\n        {flow.vpdAssistEnabled && (\n          <label className={`field ${flow.isVpdAssistValid ? '' : 'field--invalid'}`}>\n            {t('hardware.rule.vpdTarget')}\n            <input\n              aria-describedby={\n                flow.isVpdAssistValid ? vpdHintId : `${vpdHintId} ${vpdErrorId}`\n              }\n              aria-invalid={!flow.isVpdAssistValid}\n              max={RULE_ADVANCED_LIMITS.vpdTargetMax}\n              min={RULE_ADVANCED_LIMITS.vpdTargetMin}\n              step=\"0.05\"\n              type=\"number\"\n              value={flow.vpdTargetInput}\n              onChange={(event) => flow.setVpdTargetInput(event.currentTarget.value)}\n            />\n            <span className=\"field__hint\" id={vpdHintId}>\n              {t('hardware.rule.vpdRangeHint')}\n            </span>\n            {!flow.isVpdAssistValid && (\n              <span className=\"field__error\" id={vpdErrorId}>\n                {t('hardware.rule.range.kpa')}\n              </span>\n            )}\n          </label>\n        )}\n      </section>\n\n      <RuleSummaryCard title={t('hardware.rule.summaryTitle')} summary={ruleSummary} />\n\n      <div className=\"action-row rule-action-row\">"""
new_vpd = """      <section className=\"rule-vpd-assist\">\n        <div className=\"rule-vpd-assist__header\">\n          <div className=\"icon-action-row\">\n            <strong>{t('hardware.rule.vpdAssistTitle')}</strong>\n            <button\n              aria-label={t('hardware.rule.vpdAssistHint')}\n              className=\"icon-action rule-summary-icon-action\"\n              type=\"button\"\n              title={t('hardware.rule.vpdAssistHint')}\n              onClick={() => setDialog('vpd-info')}\n            >\n              <IconInfoCircle className=\"icon-action__svg\" aria-hidden=\"true\" />\n            </button>\n          </div>\n          <label className=\"toggle-row rule-vpd-assist__toggle\">\n            <input\n              aria-label={t('hardware.rule.vpdAssistTitle')}\n              type=\"checkbox\"\n              checked={flow.vpdAssistEnabled}\n              onChange={(event) => flow.setVpdAssistEnabled(event.currentTarget.checked)}\n            />\n            <span>\n              {flow.vpdAssistEnabled ? t('common.enabled') : t('common.disabled')}\n            </span>\n          </label>\n        </div>\n        {flow.vpdAssistEnabled && (\n          <label className={`field ${flow.isVpdAssistValid ? '' : 'field--invalid'}`}>\n            {t('hardware.rule.vpdTarget')}\n            <input\n              aria-describedby={flow.isVpdAssistValid ? undefined : vpdErrorId}\n              aria-invalid={!flow.isVpdAssistValid}\n              max={RULE_ADVANCED_LIMITS.vpdTargetMax}\n              min={RULE_ADVANCED_LIMITS.vpdTargetMin}\n              step=\"0.05\"\n              type=\"number\"\n              value={flow.vpdTargetInput}\n              onChange={(event) => flow.setVpdTargetInput(event.currentTarget.value)}\n            />\n            {!flow.isVpdAssistValid && (\n              <span className=\"field__error\" id={vpdErrorId}>\n                {t('hardware.rule.range.kpa')}\n              </span>\n            )}\n          </label>\n        )}\n      </section>\n\n      <div className=\"action-row rule-action-row\">\n        <button\n          aria-label={t('hardware.rule.summaryTitle')}\n          className=\"icon-action rule-summary-icon-action\"\n          type=\"button\"\n          title={t('hardware.rule.summaryTitle')}\n          onClick={() => setDialog('summary')}\n        >\n          <IconInfoCircle className=\"icon-action__svg\" aria-hidden=\"true\" />\n        </button>"""
page = replace_once(page, old_vpd, new_vpd, 'vpd and summary card')

modal_marker = """      <Modal\n        closeLabel={t('common.close')}\n        open={dialog === 'install-block' && flow.installMutation.isError}"""
modal_insert = """      <Modal\n        closeLabel={t('common.close')}\n        open={dialog === 'summary'}\n        title={t('hardware.rule.summaryTitle')}\n        onClose={() => setDialog('none')}\n      >\n        <p>{ruleSummary}</p>\n      </Modal>\n      <Modal\n        closeLabel={t('common.close')}\n        open={dialog === 'vpd-info'}\n        title={t('hardware.rule.vpdAssistTitle')}\n        onClose={() => setDialog('none')}\n      >\n        <>\n          <p>{t('hardware.rule.vpdAssistHint')}</p>\n          <p>{t('hardware.rule.vpdRangeHint')}</p>\n        </>\n      </Modal>\n      <Modal\n        closeLabel={t('common.close')}\n        open={dialog === 'install-block' && flow.installMutation.isError}"""
page = replace_once(page, modal_marker, modal_insert, 'info modals')
page_path.write_text(page)

css_path = Path('apps/mobile/src/theme/theme.css')
css = css_path.read_text()
css = replace_once(
    css,
    """.rule-vpd-assist {\n  background: var(--lcl-color-surface-muted);\n  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  border-radius: var(--lcl-radius-md);\n  display: grid;\n  gap: var(--lcl-spacing-md);\n  padding: var(--lcl-spacing-md);\n}""",
    """.rule-vpd-assist {\n  background: var(--lcl-color-surface-muted);\n  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  border-radius: var(--lcl-radius-md);\n  display: grid;\n  gap: var(--lcl-spacing-sm);\n  padding: var(--lcl-spacing-sm) var(--lcl-spacing-md);\n}""",
    'vpd compact shell css'
)
css = replace_once(
    css,
    """.rule-vpd-assist__header {\n  align-items: flex-start;\n  display: flex;\n  gap: var(--lcl-spacing-md);\n  justify-content: space-between;\n}""",
    """.rule-vpd-assist__header {\n  align-items: center;\n  display: flex;\n  gap: var(--lcl-spacing-md);\n  justify-content: space-between;\n}""",
    'vpd header css'
)
css = replace_once(
    css,
    """.rule-vpd-assist__header > div {\n  display: grid;\n  gap: var(--lcl-spacing-xs);\n  min-width: 0;\n}""",
    """.rule-vpd-assist__header > div {\n  min-width: 0;\n}""",
    'vpd header copy css'
)
css_path.write_text(css)

test_path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
test = test_path.read_text()
test = replace_once(
    test,
    """const getRuleSummary = () => {\n  const summary = screen.getByText('Podsumowanie reguły').closest('article');\n  expect(summary).not.toBeNull();\n  return summary!;\n};""",
    """const getRuleSummary = () => {\n  fireEvent.click(screen.getByRole('button', { name: 'Podsumowanie reguły' }));\n  const dialog = screen.getByRole('dialog', { name: 'Podsumowanie reguły' });\n  const snapshot = document.createElement('article');\n  snapshot.textContent = dialog.textContent;\n  fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));\n  return snapshot;\n};""",
    'rule summary test helper'
)
test = replace_once(
    test,
    "Gdy termometr A4:C1:38:4F:24:CD zniknie na 2 min albo Shelly http://192.168.0.20/ uruchomi się ponownie",
    "Gdy termometr Xiaomi salon zniknie na 2 min albo Shelly Przedpokój uruchomi się ponownie",
    'friendly summary names default'
)
test = replace_once(
    test,
    "Gdy termometr C2:C0:00:30:64:01 zniknie na 2 min",
    "Gdy termometr TP357 salon zniknie na 2 min",
    'friendly summary TP357 name'
)
test = replace_once(
    test,
    "Gdy termometr A4:C1:38:4F:24:CD zniknie na 10 min albo Shelly http://192.168.0.20/ uruchomi się ponownie",
    "Gdy termometr Xiaomi salon zniknie na 10 min albo Shelly Przedpokój uruchomi się ponownie",
    'friendly summary names advanced'
)
test_path.write_text(test)

notes_path = Path('docs/ux-polish-backlog.md')
notes_path.write_text("""# UX polish backlog\n\nThis note keeps the current UI review decisions small and explicit so later passes do not accidentally mix behavior changes with visual cleanup.\n\n## Current staged pass\n\n1. Rule setup: replace the permanent rule-summary card with compact info access, use friendly device names in the human summary, and compact VPD assist without changing automation behavior.\n2. Sensor list: tighten card spacing, keep the useful readings/settings visible, add a small rename pencil near the device name, use a trash icon for delete, and avoid an accordion for the normal saved-item view.\n3. Shelly list: remove redundant refresh/check presentation, surface useful data directly, replace wordy actions with compact icons where clear, consolidate technical explanation into one info modal, and remove only genuine duplicate data.\n\n## Explicitly deferred\n\n- VPD algorithm redesign. The runtime currently uses fixed assist margins of 0.25 C for temperature and 2 percentage points for humidity. Audit whether these should derive from the rule hysteresis or become advanced configuration; do not change them during the UI polish pass.\n- VPD domain defaults/range beyond basic input validation. Keep the current target behavior until the algorithm audit.\n- Deeper Shelly settings restructuring. First make the saved-device surface compact and readable; revisit the full settings information architecture in a later iteration.\n- Technical identifiers such as IP/MAC remain available in technical/device detail views, but user-facing summaries should prefer saved device names.\n\n## Guardrails\n\n- Preserve data unless it is genuinely duplicated.\n- Prefer small isolated changes with focused checks after every stage.\n- Keep domain/automation behavior unchanged unless a later task explicitly targets it.\n""")
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/hardware-setup.test.tsx \
  docs/ux-polish-backlog.md
pnpm exec eslint \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx \
  apps/mobile/src/__tests__/hardware-setup.test.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile test -- hardware-setup.test.tsx
pnpm --filter @lcl/mobile build
git diff --check

git add \
  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/hardware-setup.test.tsx \
  docs/ux-polish-backlog.md
git diff --cached --check
git commit -m "Polish rule setup information density"
git push --force-with-lease origin "$BRANCH"

echo RULE_UX_STAGE1_BRANCH=$BRANCH
echo RULE_UX_STAGE1_SHA=$(git rev-parse HEAD)
echo RULE_UX_STAGE1_BASE=$BASE

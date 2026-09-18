from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing block: {label}")
    if text.count(old) != 1:
        raise SystemExit(f"non-unique block: {label} ({text.count(old)})")
    return text.replace(old, new, 1)

rule_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
text = rule_path.read_text()
text = replace_once(
    text,
    """import {
  DEFAULT_RULE_ADVANCED_SETTINGS,
  RULE_ADVANCED_LIMITS,
  type RuleAdvancedSettingsInput,
  validateRuleAdvancedSettings
} from '../../../flows/hardware-setup/ruleAdvancedSettings.js';
""",
    "import { RULE_ADVANCED_LIMITS } from '../../../flows/hardware-setup/ruleAdvancedSettings.js';\n",
    'advanced imports',
)
text = replace_once(
    text,
    "import { useToastQueue } from '../useToastQueue.js';\n",
    "import { useToastQueue } from '../useToastQueue.js';\nimport { RuleAdvancedSettingsInline } from './RuleAdvancedSettingsInline.js';\n",
    'inline component import anchor',
)
start = text.index("const createAdvancedDraft = (flow: RuleSetupFlow): RuleAdvancedSettingsInput => ({")
end = text.index("\n\nconst formatRuleSummary", start)
text = text[:start] + text[end + 2:]
text = replace_once(
    text,
    "  const advancedSettings = createAdvancedDraft(flow);\n  const advancedSettingsValidation = validateRuleAdvancedSettings(advancedSettings);\n",
    '',
    'advanced settings validation in page',
)
start = text.index("  const resetAdvancedSettings = () => {")
end = text.index("\n\n  const runSafeRelayTest", start)
text = text[:start] + text[end + 2:]
start = text.index("        <details className=\"rule-progressive-disclosure\">\n")
end = text.index("        </details>\n", start) + len("        </details>\n")
replacement = """        <details className=\"rule-progressive-disclosure\">
          <summary>{t('hardware.rule.advanced')}</summary>
          <RuleAdvancedSettingsInline flow={flow} />
        </details>
"""
text = text[:start] + replacement + text[end:]
rule_path.write_text(text)

component_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleAdvancedSettingsInline.tsx')
component_path.write_text("""import type { RuleSetupFlow } from '../pageContracts.js';
import { useTranslation } from '../../../app/i18n.js';
import {
  DEFAULT_RULE_ADVANCED_SETTINGS,
  RULE_ADVANCED_LIMITS,
  validateRuleAdvancedSettings
} from '../../../flows/hardware-setup/ruleAdvancedSettings.js';

export const RuleAdvancedSettingsInline = ({ flow }: { flow: RuleSetupFlow }) => {
  const { t } = useTranslation();
  const validation = validateRuleAdvancedSettings({
    vpdAssistEnabled: flow.vpdAssistEnabled,
    vpdTargetInput: flow.vpdTargetInput,
    rssiMinInput: flow.rssiMinInput,
    staleTimeoutMinInput: flow.staleTimeoutMinInput,
    minChangeMinInput: flow.minChangeMinInput,
    maxOnHoursInput: flow.maxOnHoursInput
  });

  const resetDefaults = () => {
    flow.setRssiMinInput(DEFAULT_RULE_ADVANCED_SETTINGS.rssiMinInput);
    flow.setStaleTimeoutMinInput(DEFAULT_RULE_ADVANCED_SETTINGS.staleTimeoutMinInput);
    flow.setMinChangeMinInput(DEFAULT_RULE_ADVANCED_SETTINGS.minChangeMinInput);
    flow.setMaxOnHoursInput(DEFAULT_RULE_ADVANCED_SETTINGS.maxOnHoursInput);
  };

  return (
    <div className=\"rule-progressive-disclosure__body rule-advanced-inline\">
      <p>{t('hardware.rule.advancedDisclosureHint')}</p>
      <div className=\"rule-advanced-inline__grid\">
        <label
          className={`rule-advanced-inline__field ${
            validation.isMinChangeMinValid ? '' : 'field--invalid'
          }`}
        >
          <span>{t('hardware.rule.minChangeLabel')}</span>
          <input
            aria-describedby={
              validation.isMinChangeMinValid ? undefined : 'advanced-min-change-error'
            }
            aria-invalid={!validation.isMinChangeMinValid}
            max={RULE_ADVANCED_LIMITS.minChangeMinMax}
            min={RULE_ADVANCED_LIMITS.minChangeMinMin}
            step=\"0.25\"
            type=\"number\"
            value={flow.minChangeMinInput}
            onChange={(event) => flow.setMinChangeMinInput(event.currentTarget.value)}
          />
          {!validation.isMinChangeMinValid && (
            <span className=\"field__error rule-advanced-inline__error\" id=\"advanced-min-change-error\">
              {t('hardware.rule.range.minChange')}
            </span>
          )}
        </label>
        <label
          className={`rule-advanced-inline__field ${
            validation.isMaxOnHoursValid ? '' : 'field--invalid'
          }`}
        >
          <span>{t('hardware.rule.maxOnHoursLabel')}</span>
          <input
            aria-describedby={
              validation.isMaxOnHoursValid ? undefined : 'advanced-max-on-error'
            }
            aria-invalid={!validation.isMaxOnHoursValid}
            max={RULE_ADVANCED_LIMITS.maxOnHoursMax}
            min={RULE_ADVANCED_LIMITS.maxOnHoursMin}
            step=\"0.25\"
            type=\"number\"
            value={flow.maxOnHoursInput}
            onChange={(event) => flow.setMaxOnHoursInput(event.currentTarget.value)}
          />
          {!validation.isMaxOnHoursValid && (
            <span className=\"field__error rule-advanced-inline__error\" id=\"advanced-max-on-error\">
              {t('hardware.rule.range.maxOn')}
            </span>
          )}
        </label>
      </div>
      <div className=\"advanced-settings__readonly rule-advanced-inline__readonly\">
        <span>{t('hardware.rule.bootBehavior')}</span>
        <strong>{t('hardware.rule.bootBehaviorValue')}</strong>
      </div>
      <div className=\"rule-advanced-inline__grid rule-advanced-inline__grid--resilience\">
        <label
          className={`rule-advanced-inline__field ${
            validation.isStaleTimeoutValid ? '' : 'field--invalid'
          }`}
        >
          <span>{t('hardware.rule.staleTimeoutLabel')}</span>
          <input
            aria-describedby={
              validation.isStaleTimeoutValid ? undefined : 'advanced-stale-error'
            }
            aria-invalid={!validation.isStaleTimeoutValid}
            max={RULE_ADVANCED_LIMITS.staleTimeoutMinMax}
            min={RULE_ADVANCED_LIMITS.staleTimeoutMinMin}
            step=\"1\"
            type=\"number\"
            value={flow.staleTimeoutMinInput}
            onChange={(event) => flow.setStaleTimeoutMinInput(event.currentTarget.value)}
          />
          {!validation.isStaleTimeoutValid && (
            <span className=\"field__error rule-advanced-inline__error\" id=\"advanced-stale-error\">
              {t('hardware.rule.range.stale')}
            </span>
          )}
        </label>
        <label
          className={`rule-advanced-inline__field ${
            validation.isRssiMinValid ? '' : 'field--invalid'
          }`}
        >
          <span>{t('hardware.rule.rssiMinLabel')}</span>
          <input
            aria-describedby={validation.isRssiMinValid ? undefined : 'advanced-rssi-error'}
            aria-invalid={!validation.isRssiMinValid}
            max={RULE_ADVANCED_LIMITS.rssiMinMax}
            min={RULE_ADVANCED_LIMITS.rssiMinMin}
            step=\"1\"
            type=\"number\"
            value={flow.rssiMinInput}
            onChange={(event) => flow.setRssiMinInput(event.currentTarget.value)}
          />
          {!validation.isRssiMinValid && (
            <span className=\"field__error rule-advanced-inline__error\" id=\"advanced-rssi-error\">
              {t('hardware.rule.range.rssi')}
            </span>
          )}
        </label>
      </div>
      <button
        className=\"rule-advanced-defaults-link\"
        type=\"button\"
        title={t('hardware.rule.advancedDefaultsTitle')}
        onClick={resetDefaults}
      >
        {t('common.default')}
      </button>
    </div>
  );
};
""")

# Keep architecture documentation aligned with the now-inline advanced presentation boundary.
doc_path = Path('docs/architecture/refactor-boundaries.md')
doc = doc_path.read_text()
anchor = "## Store boundaries\n"
addition = """## Rule setup presentation

`RuleSetupPage.tsx` keeps page-level rule composition and dialog intent. Advanced safety/resilience fields render inline through `RuleAdvancedSettingsInline.tsx`; they are draft inputs for the same final rule `Send` action, not a nested modal or separate save flow. VPD remains part of the same rule draft, with its help affordance local to the VPD row and the overall rule-summary help anchored to the Rule mode row.

"""
if '## Rule setup presentation' not in doc:
    if anchor not in doc:
        raise SystemExit('missing refactor-boundaries store anchor')
    doc = doc.replace(anchor, addition + anchor, 1)
    doc_path.write_text(doc)

print('Extracted inline advanced settings into focused presentation component')

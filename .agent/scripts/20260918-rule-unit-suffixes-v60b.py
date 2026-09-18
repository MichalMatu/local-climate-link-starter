from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label}, found {count}")
    return text.replace(old, new, 1)


helper_path = Path('apps/mobile/src/screens/hardware-setup/pages/formUnits.ts')
if helper_path.exists():
    raise SystemExit('formUnits.ts already exists')
helper_path.write_text(
    "export const stripTrailingUnit = (label: string, unit: string): string => {\n"
    "  const suffix = ` ${unit}`;\n"
    "  return label.endsWith(suffix) ? label.slice(0, -suffix.length) : label;\n"
    "};\n"
)

rule_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
text = rule_path.read_text()
text = replace_once(
    text,
    "import { RuleAdvancedSettingsInline } from './RuleAdvancedSettingsInline.js';\n",
    "import { RuleAdvancedSettingsInline } from './RuleAdvancedSettingsInline.js';\nimport { stripTrailingUnit } from './formUnits.js';\n",
    'formUnits import',
)
old_thresholds = """      <div className=\"field-row\">\n        <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>\n          {t(copy.onLabelKey)}\n          <input\n            aria-describedby={flow.isThresholdValid ? undefined : thresholdErrorId}\n            aria-invalid={!flow.isThresholdValid}\n            type=\"number\"\n            step=\"0.1\"\n            value={flow.onThresholdInput}\n            onChange={(event) => flow.setOnThresholdInput(event.currentTarget.value)}\n          />\n        </label>\n        <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>\n          {t(copy.offLabelKey)}\n          <input\n            aria-describedby={flow.isThresholdValid ? undefined : thresholdErrorId}\n            aria-invalid={!flow.isThresholdValid}\n            type=\"number\"\n            step=\"0.1\"\n            value={flow.offThresholdInput}\n            onChange={(event) => flow.setOffThresholdInput(event.currentTarget.value)}\n          />\n          {!flow.isThresholdValid && (\n            <span className=\"field__error\" id={thresholdErrorId}>\n              {t('hardware.rule.thresholdInvalid')}\n            </span>\n          )}\n        </label>\n      </div>\n"""
new_thresholds = """      <div className=\"field-row\">\n        <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>\n          <span>{stripTrailingUnit(t(copy.onLabelKey), copy.unit)}</span>\n          <span className=\"field-unit-control\">\n            <input\n              aria-label={t(copy.onLabelKey)}\n              aria-describedby={flow.isThresholdValid ? undefined : thresholdErrorId}\n              aria-invalid={!flow.isThresholdValid}\n              type=\"number\"\n              step=\"0.1\"\n              value={flow.onThresholdInput}\n              onChange={(event) => flow.setOnThresholdInput(event.currentTarget.value)}\n            />\n            <span className=\"field-unit-control__unit\" aria-hidden=\"true\">\n              {copy.unit}\n            </span>\n          </span>\n        </label>\n        <label className={flow.isThresholdValid ? 'field' : 'field field--invalid'}>\n          <span>{stripTrailingUnit(t(copy.offLabelKey), copy.unit)}</span>\n          <span className=\"field-unit-control\">\n            <input\n              aria-label={t(copy.offLabelKey)}\n              aria-describedby={flow.isThresholdValid ? undefined : thresholdErrorId}\n              aria-invalid={!flow.isThresholdValid}\n              type=\"number\"\n              step=\"0.1\"\n              value={flow.offThresholdInput}\n              onChange={(event) => flow.setOffThresholdInput(event.currentTarget.value)}\n            />\n            <span className=\"field-unit-control__unit\" aria-hidden=\"true\">\n              {copy.unit}\n            </span>\n          </span>\n          {!flow.isThresholdValid && (\n            <span className=\"field__error\" id={thresholdErrorId}>\n              {t('hardware.rule.thresholdInvalid')}\n            </span>\n          )}\n        </label>\n      </div>\n"""
text = replace_once(text, old_thresholds, new_thresholds, 'threshold fields')
text = text.replace('className="rule-vpd-target-control"', 'className="field-unit-control"')
text = text.replace('className="rule-vpd-target-control__unit"', 'className="field-unit-control__unit"')
if 'rule-vpd-target-control' in text:
    raise SystemExit('legacy VPD-specific unit-control class remains')
rule_path.write_text(text)

advanced_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleAdvancedSettingsInline.tsx')
text = advanced_path.read_text()
text = replace_once(
    text,
    "import { useTranslation } from '../../../app/i18n.js';\n",
    "import { useTranslation } from '../../../app/i18n.js';\nimport { stripTrailingUnit } from './formUnits.js';\n",
    'advanced formUnits import',
)
fields = [
    ('hardware.rule.minChangeLabel', 'min', 'advanced-min-change-error', 'validation.isMinChangeMinValid', 'RULE_ADVANCED_LIMITS.minChangeMinMax', 'RULE_ADVANCED_LIMITS.minChangeMinMin', '0.25', 'flow.minChangeMinInput', 'flow.setMinChangeMinInput'),
    ('hardware.rule.maxOnHoursLabel', 'h', 'advanced-max-on-error', 'validation.isMaxOnHoursValid', 'RULE_ADVANCED_LIMITS.maxOnHoursMax', 'RULE_ADVANCED_LIMITS.maxOnHoursMin', '0.25', 'flow.maxOnHoursInput', 'flow.setMaxOnHoursInput'),
    ('hardware.rule.staleTimeoutLabel', 'min', 'advanced-stale-error', 'validation.isStaleTimeoutValid', 'RULE_ADVANCED_LIMITS.staleTimeoutMinMax', 'RULE_ADVANCED_LIMITS.staleTimeoutMinMin', '1', 'flow.staleTimeoutMinInput', 'flow.setStaleTimeoutMinInput'),
    ('hardware.rule.rssiMinLabel', 'dBm', 'advanced-rssi-error', 'validation.isRssiMinValid', 'RULE_ADVANCED_LIMITS.rssiMinMax', 'RULE_ADVANCED_LIMITS.rssiMinMin', '1', 'flow.rssiMinInput', 'flow.setRssiMinInput'),
]
for key, unit, error_id, valid, maxv, minv, step, value, setter in fields:
    old = f"""          <span>{{t('{key}')}}</span>\n          <input\n            aria-describedby={{\n              {valid} ? undefined : '{error_id}'\n            }}\n            aria-invalid={{!{valid}}}\n            max={{{maxv}}}\n            min={{{minv}}}\n            step=\"{step}\"\n            type=\"number\"\n            value={{{value}}}\n            onChange={{(event) => {setter}(event.currentTarget.value)}}\n          />\n"""
    new = f"""          <span>{{stripTrailingUnit(t('{key}'), '{unit}')}}</span>\n          <span className=\"field-unit-control\">\n            <input\n              aria-label={{t('{key}')}}\n              aria-describedby={{\n                {valid} ? undefined : '{error_id}'\n              }}\n              aria-invalid={{!{valid}}}\n              max={{{maxv}}}\n              min={{{minv}}}\n              step=\"{step}\"\n              type=\"number\"\n              value={{{value}}}\n              onChange={{(event) => {setter}(event.currentTarget.value)}}\n            />\n            <span className=\"field-unit-control__unit\" aria-hidden=\"true\">\n              {unit}\n            </span>\n          </span>\n"""
    text = replace_once(text, old, new, f'advanced field {key}')
old_boot = """      <div className=\"advanced-settings__readonly rule-advanced-inline__readonly\">\n        <span>{t('hardware.rule.bootBehavior')}</span>\n        <strong>{t('hardware.rule.bootBehaviorValue')}</strong>\n      </div>\n"""
new_boot = """      <div className=\"advanced-settings__readonly rule-advanced-inline__readonly\">\n        <span>{t('hardware.rule.bootBehavior')}</span>\n        <div className=\"rule-advanced-inline__boot\">\n          <div className=\"rule-advanced-inline__boot-flow\">\n            <strong>OFF</strong>\n            <span className=\"rule-advanced-inline__boot-arrow\" aria-hidden=\"true\">\n              →\n            </span>\n            <strong>AUTO</strong>\n          </div>\n          <span className=\"rule-advanced-inline__boot-note\">\n            {t('hardware.rule.bootBehaviorAfterReading')}\n          </span>\n        </div>\n      </div>\n"""
text = replace_once(text, old_boot, new_boot, 'boot flow card')
advanced_path.write_text(text)

css_path = Path('apps/mobile/src/theme/theme.css')
css = css_path.read_text()
css = css.replace('.rule-vpd-target-control {', '.field-unit-control {')
css = css.replace('.rule-vpd-target-control input {', '.field-unit-control input {')
css = css.replace('.rule-vpd-target-control__unit {', '.field-unit-control__unit {')
if 'rule-vpd-target-control' in css:
    raise SystemExit('legacy VPD unit CSS remains')
boot_anchor = """.rule-advanced-inline__readonly {\n  margin: 0;\n}\n"""
boot_css = """.rule-advanced-inline__readonly {\n  margin: 0;\n}\n\n.rule-advanced-inline__boot {\n  display: grid;\n  gap: var(--lcl-spacing-xs);\n  justify-items: start;\n}\n\n.rule-advanced-inline__boot-flow {\n  align-items: center;\n  display: inline-flex;\n  gap: var(--lcl-spacing-sm);\n}\n\n.rule-advanced-inline__boot-arrow,\n.rule-advanced-inline__boot-note {\n  color: var(--lcl-color-text-muted);\n}\n\n.rule-advanced-inline__boot-note {\n  font-size: var(--lcl-font-size-sm);\n  font-weight: var(--lcl-font-weight-regular);\n}\n"""
css = replace_once(css, boot_anchor, boot_css, 'boot flow CSS')
css_path.write_text(css)

locale_notes = {
    'en.ts': 'after first reading',
    'pl.ts': 'po pierwszym odczycie',
    'de.ts': 'nach dem ersten Messwert',
    'es.ts': 'tras la primera lectura',
    'fr.ts': 'après la première mesure',
    'it.ts': 'dopo la prima lettura',
    'ptBr.ts': 'após a primeira leitura',
}
for filename, note in locale_notes.items():
    path = Path('apps/mobile/src/app/locales') / filename
    locale = path.read_text()
    if 'bootBehaviorAfterReading:' in locale:
        raise SystemExit(f'bootBehaviorAfterReading already exists in {filename}')
    lines = locale.splitlines(keepends=True)
    matches = [i for i, line in enumerate(lines) if 'bootBehaviorValue:' in line]
    if len(matches) != 1:
        raise SystemExit(f'expected one bootBehaviorValue in {filename}, found {len(matches)}')
    lines.insert(matches[0] + 1, f"      bootBehaviorAfterReading: '{note}',\n")
    path.write_text(''.join(lines))

test_path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
test = test_path.read_text()
old_assert = """      expect(\n        within(advancedSection).getByText('OFF, potem AUTO po pierwszym odczycie')\n      ).toBeInTheDocument();\n"""
new_assert = """      expect(within(advancedSection).getByText('OFF')).toBeInTheDocument();\n      expect(within(advancedSection).getByText('→')).toBeInTheDocument();\n      expect(within(advancedSection).getByText('AUTO')).toBeInTheDocument();\n      expect(within(advancedSection).getByText('po pierwszym odczycie')).toBeInTheDocument();\n      expect(\n        within(advancedSection).getAllByText('min', { selector: '.field-unit-control__unit' })\n      ).toHaveLength(2);\n      expect(\n        within(advancedSection).getByText('h', { selector: '.field-unit-control__unit' })\n      ).toBeInTheDocument();\n      expect(\n        within(advancedSection).getByText('dBm', { selector: '.field-unit-control__unit' })\n      ).toBeInTheDocument();\n      expect(\n        within(vpdSection as HTMLElement).getByText('kPa', {\n          selector: '.field-unit-control__unit'\n        })\n      ).toBeInTheDocument();\n      expect(screen.getAllByText('%', { selector: '.field-unit-control__unit' })).toHaveLength(2);\n"""
test = replace_once(test, old_assert, new_assert, 'unit/boot UI assertions')
test_path.write_text(test)

print('Applied shared unit suffix controls and OFF -> AUTO restart flow')

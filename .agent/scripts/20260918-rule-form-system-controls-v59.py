from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label}, found {count}")
    return text.replace(old, new, 1)


rule_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
text = rule_path.read_text()
text = replace_once(
    text,
    "className={`rule-vpd-target-row ${flow.isVpdAssistValid ? '' : 'field--invalid'}`}",
    "className={`field rule-vpd-target-row ${flow.isVpdAssistValid ? '' : 'field--invalid'}`}",
    'VPD target field system class',
)
rule_path.write_text(text)

advanced_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleAdvancedSettingsInline.tsx')
text = advanced_path.read_text()
old = "className={`rule-advanced-inline__field ${"
count = text.count(old)
if count != 4:
    raise SystemExit(f'expected four advanced field classes, found {count}')
text = text.replace(old, "className={`field rule-advanced-inline__field ${")
advanced_path.write_text(text)

css_path = Path('apps/mobile/src/theme/theme.css')
text = css_path.read_text()
text = replace_once(
    text,
    """@media (max-width: 30rem) {
  .developer-context,
  .rule-vpd-assist__header {
    align-items: stretch;
    display: grid;
  }
""",
    """@media (max-width: 30rem) {
  .developer-context {
    align-items: stretch;
    display: grid;
  }
""",
    'mobile VPD header stacking rule',
)
css_path.write_text(text)

print('Aligned VPD and Advanced controls with shared field styling')

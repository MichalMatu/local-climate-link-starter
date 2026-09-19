from pathlib import Path

path = Path('docs/implementation/device-rule-decoupling-plan.md')
text = path.read_text(encoding='utf-8')
text = text.replace(
    'Original audited baseline: `47116b57faba21e03276ba7185ea04c4ec50da4b` (`main`, v2.0.10 integration baseline)  \nOriginal implementation branch: `work/device-rule-decoupling-20260913`\n',
    'Original audited baseline: `47116b57faba21e03276ba7185ea04c4ec50da4b` (`main`, v2.0.10 integration baseline)\n\nOriginal implementation branch: `work/device-rule-decoupling-20260913`\n',
    1,
)
path.write_text(text, encoding='utf-8')
print('Removed hard-break trailing whitespace from historical plan header')

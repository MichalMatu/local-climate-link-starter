from pathlib import Path

path = Path('apps/mobile/src/theme/theme.css')
text = path.read_text(encoding='utf-8')
old = '@media (max-width: 24rem) {'
new = '@media (max-width: 30rem) {'
if old not in text:
    raise SystemExit('expected 24rem device-add breakpoint not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Aligned device-add responsive breakpoint with design tokens')

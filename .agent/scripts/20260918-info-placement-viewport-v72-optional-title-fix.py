from pathlib import Path

path = Path('packages/ui/src/feedback/InfoPopover.tsx')
text = path.read_text()
old = "  title?: string;"
new = "  title?: string | undefined;"
if text.count(old) != 1:
    raise SystemExit(f'expected one InfoPopover optional title declaration, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('Allowed explicitly undefined optional InfoPopover titles under exactOptionalPropertyTypes')

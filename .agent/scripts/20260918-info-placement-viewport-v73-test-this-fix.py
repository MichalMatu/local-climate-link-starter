from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()
old = ".mockImplementation(function () {\n        if (this.classList.contains('lcl-info-popover__trigger')) {"
new = ".mockImplementation(function (this: HTMLElement) {\n        if (this.classList.contains('lcl-info-popover__trigger')) {"
if text.count(old) != 1:
    raise SystemExit(f'expected one viewport rect mock function, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('Typed viewport rect mock this context as HTMLElement')

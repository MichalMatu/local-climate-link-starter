from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()
old = """    expect(screen.getByRole('combobox', { name: 'Termometr' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tryb reguły' })).toBeInTheDocument();
"""
new = """    expect(screen.getByRole('button', { name: 'Termometr' })).toHaveAttribute(
      'aria-haspopup',
      'listbox'
    );
    expect(screen.getByRole('button', { name: 'Tryb reguły' })).toHaveAttribute(
      'aria-haspopup',
      'listbox'
    );
"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected fixed-climate combobox assertion block once, found {count}')
text = text.replace(old, new, 1)
if "getByRole('combobox'" in text or 'getByRole("combobox"' in text:
    raise SystemExit('stale combobox assertion remains')
path.write_text(text)
print('Fixed final native-select role assumptions')

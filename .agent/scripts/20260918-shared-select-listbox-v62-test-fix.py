from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label}, found {count}")
    return text.replace(old, new, 1)


path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()

old = """    expect(screen.getByRole('option', { name: 'Grzanie' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Chłodzenie' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Nawilżanie' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Osuszanie' })).toBeInTheDocument();
"""
new = """    fireEvent.click(screen.getByRole('button', { name: 'Tryb reguły' }));
    const ruleModeListbox = screen.getByRole('listbox', { name: 'Tryb reguły' });
    expect(within(ruleModeListbox).getByRole('option', { name: 'Grzanie' })).toBeInTheDocument();
    expect(within(ruleModeListbox).getByRole('option', { name: 'Chłodzenie' })).toBeInTheDocument();
    expect(within(ruleModeListbox).getByRole('option', { name: 'Nawilżanie' })).toBeInTheDocument();
    expect(within(ruleModeListbox).getByRole('option', { name: 'Osuszanie' })).toBeInTheDocument();
    fireEvent.click(within(ruleModeListbox).getByRole('option', { name: 'Grzanie' }));
"""
text = replace_once(text, old, new, 'rule mode option assertions')

old = """    expect(screen.getByRole('option', { name: 'Xiaomi salon' })).toBeInTheDocument();
"""
new = """    expect(screen.getByRole('button', { name: 'Termometr' })).toHaveTextContent(
      'Xiaomi salon'
    );
"""
text = replace_once(text, old, new, 'loaded sensor option assertion')

old = """    expect(
      within(sensorAddDialog).getByRole('option', {
        name: 'Xiaomi/PVVX BTHome v2'
      })
    ).toBeInTheDocument();
    expect(within(sensorAddDialog).getByRole('option', { name: 'TP357' })).toBeEnabled();
    chooseSelectField('Typ termometru', 'TP357', sensorAddDialog);
"""
new = """    fireEvent.click(within(sensorAddDialog).getByRole('button', { name: 'Typ termometru' }));
    const profileListbox = within(sensorAddDialog).getByRole('listbox', {
      name: 'Typ termometru'
    });
    expect(
      within(profileListbox).getByRole('option', {
        name: 'Xiaomi/PVVX BTHome v2'
      })
    ).toBeInTheDocument();
    expect(within(profileListbox).getByRole('option', { name: 'TP357' })).toBeEnabled();
    fireEvent.click(within(profileListbox).getByRole('option', { name: 'TP357' }));
"""
text = replace_once(text, old, new, 'sensor profile option assertions')

# The only direct option lookups left must be scoped to an explicitly opened listbox.
if "screen.getByRole('option'" in text:
    raise SystemExit('unscoped screen option lookup remains')
if "within(sensorAddDialog).getByRole('option'" in text:
    raise SystemExit('unscoped sensorAddDialog option lookup remains')

path.write_text(text)
print('Fixed listbox option assertions for shared SelectField tests')

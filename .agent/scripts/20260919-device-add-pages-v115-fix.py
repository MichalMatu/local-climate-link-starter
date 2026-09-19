from pathlib import Path
import re

ROOT = Path('.')

def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, count), encoding='utf-8')


def regex_replace(path: str, pattern: str, repl: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    text2, n = re.subn(pattern, repl, text, count=count, flags=re.S)
    if n != count:
        raise SystemExit(f'regex expected {count} matches, got {n} in {path}: {pattern[:160]!r}')
    p.write_text(text2, encoding='utf-8')

# Finish dashboard test edits after v114's intentional stop point.
dash_test = 'apps/mobile/src/__tests__/automation-dashboard.test.tsx'
replace(
    dash_test,
    "          onAddPlug={onAddPlug}\n          onAddAutomation={onAddAutomation}",
    "          onAddPlug={onAddPlug}\n          onAddThermometer={onAddThermometer}\n          onAddAutomation={onAddAutomation}",
)
replace(
    dash_test,
    "    onOpenSettings,\n    onAddPlug,\n    queryClient,",
    "    onOpenSettings,\n    onAddPlug,\n    onAddThermometer,\n    queryClient,",
)
text = (ROOT / dash_test).read_text(encoding='utf-8')
text = text.replace(
    "renderDashboard(vi.fn(), vi.fn(), vi.fn(), vi.fn(), 'time')",
    "renderDashboard(vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), 'time')",
)
(ROOT / dash_test).write_text(text, encoding='utf-8')

# Hardware tests now scope forms to child pages instead of dialogs.
hw_test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
regex_replace(
    hw_test,
    r"const openShellyAddDialog = async \(section: 'manual' \| 'scan' = 'manual'\) => \{.*?\n\};",
    """const openShellyAddDialog = async (section: 'manual' | 'scan' = 'manual') => {
  fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));
  const heading = await screen.findByRole('heading', { name: 'Dodaj gniazdko' });
  const page = heading.closest('.device-add-page') as HTMLElement;
  expect(page).not.toBeNull();
  expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();
  if (section === 'manual') {
    fireEvent.click(within(page).getByRole('tab', { name: 'Dodaj ręcznie' }));
  }
  return page;
};""",
)
regex_replace(
    hw_test,
    r"const openSensorAddDialog = async \(\) => \{.*?\n\};",
    """const openSensorAddDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Dodaj termometr' }));
  const heading = await screen.findByRole('heading', { name: 'Dodaj termometr' });
  const page = heading.closest('.device-add-page') as HTMLElement;
  expect(page).not.toBeNull();
  expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();
  fireEvent.click(within(page).getByRole('tab', { name: 'Dodaj ręcznie' }));
  return page;
};""",
)
regex_replace(
    hw_test,
    r"  it\('keeps keyboard focus inside setup modals and restores it on close', async \(\) => \{.*?\n  \}\);\n",
    """  it('opens device add flows as full child pages instead of modals', async () => {
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));
    const plugPage = await openShellyAddDialog('scan');
    expect(within(plugPage).getByRole('tab', { name: 'Skanuj sieć' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const sensorPage = await openSensorAddDialog();
    expect(within(sensorPage).getByLabelText('MAC termometru')).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();
  });
""",
)

print('Device add migration test patch finished')

#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-sensor-ux-polish-stage2-draft-20260911.sh > /tmp/sensor-stage2-final-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/sensor-stage2-final-inner.sh')
s = p.read_text()
old_grid = "  grid-template-columns: repeat(2, minmax(0, 1fr));\\n"
new_grid = "  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));\\n"
if s.count(old_grid) != 1:
    raise SystemExit(f'grid marker mismatch: {s.count(old_grid)}')
s = s.replace(old_grid, new_grid, 1)
marker = "pnpm exec prettier --write \\\n  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \\\n  apps/mobile/src/theme/theme.css\n"
if s.count(marker) != 1:
    raise SystemExit(f'format marker mismatch: {s.count(marker)}')
patch_tests = r'''python3 - <<'PYTEST'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = p.read_text()

def once(old: str, new: str, label: str):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    s = s.replace(old, new, 1)

once(
"""const openSensorSettingsDialog = async (name = 'Xiaomi salon') => {
  fireEvent.click(screen.getByRole('button', { name: `Ustawienia termometru ${name}` }));
  return screen.findByRole('dialog', { name: 'Ustawienia termometru' });
};""",
"""const getSavedSensorCard = (name: string) => {
  const card = screen.getByText(name).closest('article');
  expect(card).not.toBeNull();
  return card!;
};""",
'helper'
)

old = """    expect(screen.getByText('Xiaomi salon')).toBeInTheDocument();
    expect(screen.queryByText('Nazwa termometru')).not.toBeInTheDocument();
    expect(screen.queryByText('MAC')).not.toBeInTheDocument();
    expect(screen.queryByText('Bateria')).not.toBeInTheDocument();
    expect(screen.queryByText('RSSI')).not.toBeInTheDocument();
    expect(screen.queryByText('Xiaomi/PVVX BTHome v2')).not.toBeInTheDocument();
    const sensorSettingsDialog = await openSensorSettingsDialog('Xiaomi salon');
    expect(within(sensorSettingsDialog).getByLabelText('Nazwa termometru')).toHaveValue(
      'Xiaomi salon'
    );
    expect(within(sensorSettingsDialog).getByText('MAC')).toBeInTheDocument();
    expect(
      within(sensorSettingsDialog).getByText('A4:C1:38:4F:24:CD')
    ).toBeInTheDocument();
    expect(within(sensorSettingsDialog).getByText('BTHome v2')).toBeInTheDocument();
    expect(within(sensorSettingsDialog).getByText('Bateria')).toBeInTheDocument();
    expect(within(sensorSettingsDialog).getByText('RSSI')).toBeInTheDocument();
    expect(
      within(sensorSettingsDialog).getByRole('button', { name: 'Ustaw czas' })
    ).toHaveAttribute('title', 'Ustaw czas Xiaomi/PVVX zgodnie z telefonem');
    expect(
      within(sensorSettingsDialog).getByRole('button', { name: 'Usuń' })
    ).toHaveClass('secondary-action--danger');
    fireEvent.click(
      within(sensorSettingsDialog).getByRole('button', { name: 'Zamknij' })
    );"""
new = """    expect(screen.getByText('Xiaomi salon')).toBeInTheDocument();
    const sensorCard = getSavedSensorCard('Xiaomi salon');
    expect(within(sensorCard).getByText('MAC')).toBeInTheDocument();
    expect(within(sensorCard).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
    expect(within(sensorCard).getByText('BTHome v2')).toBeInTheDocument();
    expect(within(sensorCard).getByText('Bateria')).toBeInTheDocument();
    expect(within(sensorCard).getByText('RSSI')).toBeInTheDocument();
    expect(
      within(sensorCard).getByRole('button', {
        name: 'Ustaw czas Xiaomi/PVVX zgodnie z telefonem'
      })
    ).toBeInTheDocument();
    expect(
      within(sensorCard).getByRole('button', { name: 'Usuń termometr' })
    ).toHaveClass('icon-action--danger');
    fireEvent.click(within(sensorCard).getByRole('button', { name: 'Nazwa termometru' }));
    expect(within(sensorCard).getByLabelText('Nazwa termometru')).toHaveValue('Xiaomi salon');
    fireEvent.blur(within(sensorCard).getByLabelText('Nazwa termometru'));"""
once(old, new, 'main sensor card assertions')

old = """    const savedSensorList = screen.getByLabelText('Dodane termometry');
    expect(within(savedSensorList).queryByText('BTHome v2')).not.toBeInTheDocument();

    const settingsDialog = await openSensorSettingsDialog('Xiaomi salon');
    expect(within(settingsDialog).getByText('BTHome v2')).toBeInTheDocument();
    fireEvent.click(
      within(settingsDialog).getByRole('button', {
        name: 'Usuń'
      })
    );"""
new = """    const savedSensorList = screen.getByLabelText('Dodane termometry');
    expect(within(savedSensorList).getByText('BTHome v2')).toBeInTheDocument();

    let sensorCard = getSavedSensorCard('Xiaomi salon');
    fireEvent.click(
      within(sensorCard).getByRole('button', {
        name: 'Usuń termometr'
      })
    );"""
once(old, new, 'remove sensor first action')

old = """    const nextSettingsDialog = await openSensorSettingsDialog('Xiaomi salon');
    fireEvent.click(
      within(nextSettingsDialog).getByRole('button', {
        name: 'Usuń'
      })
    );"""
new = """    sensorCard = getSavedSensorCard('Xiaomi salon');
    fireEvent.click(
      within(sensorCard).getByRole('button', {
        name: 'Usuń termometr'
      })
    );"""
once(old, new, 'remove sensor second action')

old = """    expect(screen.getByText('TP357 salon')).toBeInTheDocument();
    const tp357SettingsDialog = await openSensorSettingsDialog('TP357 salon');
    expect(within(tp357SettingsDialog).getByText('TP357')).toBeInTheDocument();
    fireEvent.click(within(tp357SettingsDialog).getByRole('button', { name: 'Zamknij' }));"""
new = """    expect(screen.getByText('TP357 salon')).toBeInTheDocument();
    expect(within(getSavedSensorCard('TP357 salon')).getByText('TP357')).toBeInTheDocument();"""
once(old, new, 'tp357 card')

old = """    expect(screen.getByText('Termometr 24:CD')).toBeInTheDocument();
    expect(screen.getByText('21.3°C')).toBeInTheDocument();
    expect(screen.getByText('45.7%')).toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    const sensorSettingsDialog = await openSensorSettingsDialog('Termometr 24:CD');
    expect(
      within(sensorSettingsDialog).getByText('A4:C1:38:4F:24:CD')
    ).toBeInTheDocument();
    expect(within(sensorSettingsDialog).getByText('100%')).toBeInTheDocument();"""
new = """    expect(screen.getByText('Termometr 24:CD')).toBeInTheDocument();
    expect(screen.getByText('21.3°C')).toBeInTheDocument();
    expect(screen.getByText('45.7%')).toBeInTheDocument();
    const sensorCard = getSavedSensorCard('Termometr 24:CD');
    expect(within(sensorCard).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
    expect(within(sensorCard).getByText('100%')).toBeInTheDocument();"""
once(old, new, 'phone ble saved card')

old = """    expect(await screen.findByText('21.3°C')).toBeInTheDocument();
    expect(screen.getByText('45.7%')).toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    expect(screen.queryByText('-72 dBm')).not.toBeInTheDocument();
    const sensorSettingsDialog = await openSensorSettingsDialog('Xiaomi salon');
    expect(within(sensorSettingsDialog).getByText('100%')).toBeInTheDocument();
    expect(within(sensorSettingsDialog).getByText('-72 dBm')).toBeInTheDocument();"""
new = """    expect(await screen.findByText('21.3°C')).toBeInTheDocument();
    expect(screen.getByText('45.7%')).toBeInTheDocument();
    const sensorCard = getSavedSensorCard('Xiaomi salon');
    expect(within(sensorCard).getByText('100%')).toBeInTheDocument();
    expect(within(sensorCard).getByText('-72 dBm')).toBeInTheDocument();"""
once(old, new, 'foreground scan card')

old = """    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    expect(screen.getByText('31.2°C')).toBeInTheDocument();
    const sensorSettingsDialog = await openSensorSettingsDialog('Termometr 24:CD');
    expect(
      within(sensorSettingsDialog).getByText('A4:C1:38:4F:24:CD')
    ).toBeInTheDocument();
    fireEvent.click(
      within(sensorSettingsDialog).getByRole('button', { name: 'Zamknij' })
    );"""
new = """    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    expect(screen.getByText('31.2°C')).toBeInTheDocument();
    expect(
      within(getSavedSensorCard('Termometr 24:CD')).getByText('A4:C1:38:4F:24:CD')
    ).toBeInTheDocument();"""
once(old, new, 'shelly ble saved card')

old = """    expect(screen.getByText('Xiaomi salon')).toBeInTheDocument();
    const sensorSettingsDialog = await openSensorSettingsDialog('Xiaomi salon');
    expect(
      within(sensorSettingsDialog).getByText('A4:C1:38:4F:24:CD')
    ).toBeInTheDocument();"""
new = """    expect(screen.getByText('Xiaomi salon')).toBeInTheDocument();
    expect(
      within(getSavedSensorCard('Xiaomi salon')).getByText('A4:C1:38:4F:24:CD')
    ).toBeInTheDocument();"""
once(old, new, 'remount card')

p.write_text(s)
PYTEST

'''
s = s.replace(marker, patch_tests + marker, 1)
# Include the updated test file in formatting and lint.
s = s.replace(
"  apps/mobile/src/theme/theme.css\n",
"  apps/mobile/src/theme/theme.css \\\n  apps/mobile/src/__tests__/hardware-setup.test.tsx\n",
1
)
s = s.replace(
"pnpm exec eslint apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx\n",
"pnpm exec eslint apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx apps/mobile/src/__tests__/hardware-setup.test.tsx\n",
1
)
p.write_text(s)
PY
sh /tmp/sensor-stage2-final-inner.sh

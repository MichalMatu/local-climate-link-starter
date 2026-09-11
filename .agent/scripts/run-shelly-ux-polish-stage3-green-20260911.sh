#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-shelly-ux-polish-stage3-draft-20260911.sh > /tmp/shelly-stage3-green-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/shelly-stage3-green-inner.sh')
s = p.read_text()

# Apply the source cleanups from the validated v4 draft before its checks run.
needle = "s = replace_once(s, old_map, new_map, 'saved card props')\np.write_text(s)\n"
injection = """s = replace_once(s, old_map, new_map, 'saved card props')
for old_line in [
    \"  formatAutomationMode,\\n\",
    \"  formatPlugEnergy,\\n\",
    \"  formatPlugPower,\\n\",
    \"  formatPlugVoltage,\\n\",
    \"  formatShellyClock,\\n\",
]:
    if old_line not in s:
        raise SystemExit(f'missing unused import {old_line!r}')
    s = s.replace(old_line, '', 1)
s = replace_once(
    s,
    \"import { mutationError, shellyAddressLabel, type HardwarePageProps } from '../helpers.js';\",
    \"import { mutationError, type HardwarePageProps } from '../helpers.js';\",
    'helper import cleanup'
)
s = replace_once(
    s,
    \"  const shellyAddress = shellyAddressLabel(flow);\\n\",
    '',
    'unused shelly address'
)
p.write_text(s)
"""
if s.count(needle) != 1:
    raise SystemExit(f'page write marker mismatch: {s.count(needle)}')
s = s.replace(needle, injection, 1)
fixed = "  grid-template-columns: repeat(2, minmax(0, 1fr));"
responsive = "  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));"
if s.count(fixed) != 1:
    raise SystemExit(f'fixed toolbar marker mismatch: {s.count(fixed)}')
s = s.replace(fixed, responsive, 1)

# Insert the updated test expectations before formatting/checks.
marker = "pnpm exec prettier --write \\\n  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \\\n  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \\\n  apps/mobile/src/theme/theme.css\n"
if s.count(marker) != 1:
    raise SystemExit(f'format marker mismatch: {s.count(marker)}')
patch_tests = r'''python3 - <<'PYTEST'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = p.read_text()

def once(old: str, new: str, label: str):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    s = s.replace(old, new, 1)

# BLE scan is now a direct icon action on the saved Shelly card.
once(
"""const openShellyBleScanFromSettings = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Ustawienia gniazdka' }));
  const settingsDialog = await screen.findByRole('dialog', {
    name: 'Ustawienia gniazdka'
  });
  fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Skanuj BLE' }));
};""",
"""const openShellyBleScanFromSettings = async () => {
  fireEvent.click(
    screen.getByRole('button', { name: 'Skanuj termometry BLE przez to gniazdko' })
  );
};""",
'BLE helper'
)

# Compatibility, inline rename, and the single technical-info modal.
old = """    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia gniazdka' }));
    const settingsDialog = await screen.findByRole('dialog', {
      name: 'Ustawienia gniazdka'
    });
    fireEvent.change(within(settingsDialog).getByLabelText('Nazwa gniazdka'), {
      target: { value: 'Salon testowy' }
    });
    expect(within(settingsDialog).getByLabelText('Nazwa gniazdka')).toHaveValue(
      'Salon testowy'
    );
    expect(
      within(screen.getByLabelText('Dodane gniazdka')).getByText('Salon testowy')
    ).toBeInTheDocument();
    expect(within(settingsDialog).getByText('Adres IP')).toBeInTheDocument();
    const settingsShellyPanelLink = within(settingsDialog).getByRole('link', {
      name: 'Otwórz panel Shelly: http://192.168.0.20/'
    });
    expect(settingsShellyPanelLink).toHaveAttribute('href', 'http://192.168.0.20/');
    fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Sprawdź' }));
    const recheckDialog = await screen.findByRole('dialog', {
      name: 'Shelly sprawdzone'
    });
    const shellyPanelLink = within(recheckDialog).getByRole('link', {
      name: 'Otwórz panel Shelly: http://192.168.0.20/'
    });
    expect(shellyPanelLink).toHaveAttribute('href', 'http://192.168.0.20/');
    expect(shellyPanelLink).toHaveAttribute('target', '_blank');
    expect(shellyPanelLink).toHaveAttribute('rel', 'noreferrer noopener');
    expect(within(recheckDialog).getByText('S3PL-00112EU, gen 3')).toBeInTheDocument();
    expect(within(recheckDialog).getByText('Scripts')).toBeInTheDocument();
    expect(within(recheckDialog).getByText('Bluetooth')).toBeInTheDocument();
    expect(within(recheckDialog).getByText('Przekaźnik')).toBeInTheDocument();

    const statusBackdrop = document.querySelector('.lcl-modal-backdrop');
    expect(statusBackdrop).not.toBeNull();
    fireEvent.click(statusBackdrop!);
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Shelly sprawdzone' })
      ).not.toBeInTheDocument()
    );
    expect(
      await screen.findByRole('dialog', { name: 'Ustawienia gniazdka' })
    ).toBeInTheDocument();"""
new = """    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    fireEvent.click(within(savedPlugList).getByRole('button', { name: 'Nazwa gniazdka' }));
    const nameInput = within(savedPlugList).getByLabelText('Nazwa gniazdka');
    fireEvent.change(nameInput, { target: { value: 'Salon testowy' } });
    expect(nameInput).toHaveValue('Salon testowy');
    fireEvent.blur(nameInput);
    expect(within(savedPlugList).getByText('Salon testowy')).toBeInTheDocument();

    fireEvent.click(within(savedPlugList).getByRole('button', { name: 'Ustawienia gniazdka' }));
    const infoDialog = await screen.findByRole('dialog', { name: 'Salon testowy' });
    expect(within(infoDialog).getByText('Adres IP')).toBeInTheDocument();
    const shellyPanelLink = within(infoDialog).getByRole('link', {
      name: 'Otwórz panel Shelly: http://192.168.0.20/'
    });
    expect(shellyPanelLink).toHaveAttribute('href', 'http://192.168.0.20/');
    expect(shellyPanelLink).toHaveAttribute('target', '_blank');
    expect(shellyPanelLink).toHaveAttribute('rel', 'noreferrer noopener');
    expect(await within(infoDialog).findByText('S3PL-00112EU, gen 3')).toBeInTheDocument();
    expect(within(infoDialog).getByText('Scripts')).toBeInTheDocument();
    expect(within(infoDialog).getByText('Bluetooth')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('Przekaźnik')).toBeInTheDocument();
    fireEvent.click(within(infoDialog).getByRole('button', { name: 'Zamknij' }));
    expect(screen.queryByRole('dialog', { name: 'Salon testowy' })).not.toBeInTheDocument();"""
once(old, new, 'compatibility/settings flow')

# Saved card itself now exposes daily status and compact actions.
old = """    expect(within(savedPlugList).queryByText('Przekaźnik')).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Automatyzacja')).not.toBeInTheDocument();
    const settingsToggle = within(savedPlugList).getByRole('button', {
      name: 'Ustawienia gniazdka'
    });
    expect(settingsToggle).toHaveAttribute('title', 'Ustawienia gniazdka');
    fireEvent.click(settingsToggle);
    const settingsDialog = await screen.findByRole('dialog', {
      name: 'Ustawienia gniazdka'
    });
    expect(within(settingsDialog).getByText('Adres IP')).toBeInTheDocument();
    expect(within(settingsDialog).getByText('http://192.168.0.20/')).toBeInTheDocument();
    expect(within(settingsDialog).getByText('Firmware')).toBeInTheDocument();
    expect(
      within(settingsDialog).getByText('20260311-095902/1.7.5-g9979d16')
    ).toBeInTheDocument();
    expect(
      within(settingsDialog).getByRole('button', { name: 'Skanuj BLE' })
    ).toHaveAttribute('title', 'Skanuj termometry BLE przez to gniazdko');
    expect(within(settingsDialog).getByRole('button', { name: 'Usuń' })).toHaveClass(
      'secondary-action--danger'
    );
    expect(within(settingsDialog).getByRole('button', { name: 'Usuń' })).toHaveAttribute(
      'title',
      'Usuń gniazdko tylko z aplikacji'
    );
    fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Zamknij' }));"""
new = """    expect(within(savedPlugList).getByText('Przekaźnik')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('Tryb')).toBeInTheDocument();
    const infoToggle = within(savedPlugList).getByRole('button', {
      name: 'Ustawienia gniazdka'
    });
    expect(infoToggle).toHaveAttribute('title', 'Ustawienia gniazdka');
    expect(
      within(savedPlugList).getByRole('button', {
        name: 'Skanuj termometry BLE przez to gniazdko'
      })
    ).toBeInTheDocument();
    expect(
      within(savedPlugList).getByRole('button', {
        name: 'Usuń gniazdko tylko z aplikacji'
      })
    ).toHaveClass('icon-action--danger');
    fireEvent.click(infoToggle);
    const infoDialog = await screen.findByRole('dialog', { name: 'Przedpokój' });
    expect(within(infoDialog).getByText('Adres IP')).toBeInTheDocument();
    expect(within(infoDialog).getByText('http://192.168.0.20/')).toBeInTheDocument();
    expect(within(infoDialog).getByText('Firmware')).toBeInTheDocument();
    expect(
      within(infoDialog).getByText('20260311-095902/1.7.5-g9979d16')
    ).toBeInTheDocument();
    fireEvent.click(within(infoDialog).getByRole('button', { name: 'Zamknij' }));"""
once(old, new, 'saved card info/actions')

old = """    expect(within(actionRow).getByRole('button', { name: 'Odśwież' })).toHaveClass(
      'icon-action'
    );
    expect(within(actionRow).getByRole('button', { name: 'Odśwież' })).toHaveAttribute(
      'title',
      'Odśwież stan gniazdka'
    );
"""
once(old, "    expect(within(actionRow).queryByRole('button', { name: 'Odśwież' })).not.toBeInTheDocument();\n", 'removed refresh assertions')

# Delete is a direct card icon; no settings modal hop.
old = """    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia gniazdka' }));
    const settingsDialog = await screen.findByRole('dialog', {
      name: 'Ustawienia gniazdka'
    });
    fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Usuń' }));"""
new = """    fireEvent.click(
      screen.getByRole('button', { name: 'Usuń gniazdko tylko z aplikacji' })
    );"""
count = s.count(old)
if count != 3:
    raise SystemExit(f'delete settings-hop: expected 3 matches, got {count}')
s = s.replace(old, new, 3)

# Clock is visible on the card; details live in the same technical info modal.
old = """    const clockButton = screen.getByRole('button', { name: '09:31' });
    expect(clockButton).toHaveAttribute('title', 'Pokaż status czasu Shelly');

    fireEvent.click(clockButton);

    const clockDialog = await screen.findByRole('dialog', { name: 'Czas Shelly' });
    expect(within(clockDialog).getByText('Salon')).toBeInTheDocument();
    expect(within(clockDialog).getByText('09:31')).toBeInTheDocument();
    expect(within(clockDialog).getByText('zsynchronizowany')).toBeInTheDocument();
    expect(within(clockDialog).getByText('3 h 25 min')).toBeInTheDocument();
    expect(within(clockDialog).getByRole('button', { name: 'Odśwież' })).toHaveAttribute(
      'title',
      'Odśwież czas i status gniazdka'
    );
    expect(
      within(clockDialog).queryByRole('button', { name: 'Ustaw z telefonu' })
    ).not.toBeInTheDocument();"""
new = """    expect(screen.getByText('09:31')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia gniazdka' }));
    const infoDialog = await screen.findByRole('dialog', { name: 'Salon' });
    expect(await within(infoDialog).findByText('zsynchronizowany')).toBeInTheDocument();
    expect(within(infoDialog).getByText('3 h 25 min')).toBeInTheDocument();
    expect(within(infoDialog).getByText('NTP')).toBeInTheDocument();
    expect(
      within(infoDialog).queryByRole('button', { name: 'Odśwież' })
    ).not.toBeInTheDocument();"""
once(old, new, 'clock/info modal')

p.write_text(s)
PYTEST

'''
s = s.replace(marker, patch_tests + marker.replace('apps/mobile/src/theme/theme.css', 'apps/mobile/src/theme/theme.css \\\n  apps/mobile/src/__tests__/hardware-setup.test.tsx'), 1)
s = s.replace(
    "  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx\n",
    "  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \\\n  apps/mobile/src/__tests__/hardware-setup.test.tsx\n",
    1
)
p.write_text(s)
PY
sh /tmp/shelly-stage3-green-inner.sh

pnpm --filter @lcl/mobile build
git diff --check
git add \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/hardware-setup.test.tsx
git diff --cached --check
git commit -m "Polish saved Shelly cards"
git push --force-with-lease origin work/ux-polish-20260911

echo SHELLY_STAGE3_SHA=$(git rev-parse HEAD)

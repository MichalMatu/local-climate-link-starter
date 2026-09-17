from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "apps/mobile/src/screens/AutomationDashboardScreen.tsx",
    "            <strong>{t('dashboard.emptyCategory')}</strong>",
    "            <strong>{t('hardware.shelly.empty')}</strong>",
)

replace_once(
    "apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx",
    "import { IconPlus } from '@tabler/icons-react';",
    "import { IconPlus, IconTemperature } from '@tabler/icons-react';",
)

replace_once(
    "apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx",
    "        {flow.sensorDevices.length === 0 && <p>{t('hardware.sensor.empty')}</p>}",
    """        {flow.sensorDevices.length === 0 &&
          (embedded ? (
            <div className=\"dashboard-kind-empty\">
              <IconTemperature
                className=\"dashboard-kind-empty__icon\"
                aria-hidden=\"true\"
              />
              <strong>{t('hardware.sensor.empty')}</strong>
            </div>
          ) : (
            <p>{t('hardware.sensor.empty')}</p>
          ))}""",
)

replace_once(
    "apps/mobile/src/__tests__/automation-dashboard.test.tsx",
    """    expect(screen.queryByRole('heading', { name: 'Gniazdka' })).toBeNull();
    expect(screen.queryByText('Nie masz jeszcze zapisanej automatyki')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));""",
    """    expect(screen.queryByRole('heading', { name: 'Gniazdka' })).toBeNull();
    expect(screen.queryByText('Nie masz jeszcze zapisanej automatyki')).toBeNull();
    const plugEmptyState = screen.getByRole('status');
    expect(within(plugEmptyState).getByText('Brak dodanych gniazdek.')).toBeVisible();
    expect(screen.queryByText('Brak automatyzacji')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));""",
)

replace_once(
    "apps/mobile/src/__tests__/automation-dashboard.test.tsx",
    """  it('keeps a saved plug fully controllable after automation is removed', async () => {""",
    """  it('uses the same centered empty-state treatment for Thermometers', () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));

    const thermometerEmptyState = screen
      .getByText('Brak dodanych termometrów.')
      .closest('.dashboard-kind-empty');
    expect(thermometerEmptyState).not.toBeNull();
    expect(thermometerEmptyState).toHaveClass('dashboard-kind-empty');
    expect(
      thermometerEmptyState?.querySelector('.dashboard-kind-empty__icon')
    ).not.toBeNull();
  });

  it('keeps a saved plug fully controllable after automation is removed', async () => {""",
)

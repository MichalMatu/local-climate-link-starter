from pathlib import Path

# Update direct settings behavior test for page semantics.
p = Path('apps/mobile/src/__tests__/appSettings.test.tsx')
s = p.read_text()
s = s.replace("import { AppSettingsModal } from '../app/AppSettingsModal.js';", "import { AppSettingsScreen } from '../app/AppSettingsScreen.js';", 1)
s = s.replace("describe('app settings modal'", "describe('app settings screen'", 1)
old = """        <AppSettingsModal
          open
          supportReportInput={{
            platform: 'android',
            shellyDevices: [
              { name: 'Shelly Plug S Gen3', detail: 'http://192.168.0.20/' }
            ],
            sensorDevices: [{ name: 'Thermometer 24:CD', detail: 'BTHome v2 A4:C1' }],
            selectedShelly: 'Shelly Plug S Gen3',
            selectedSensor: 'Thermometer 24:CD',
            lastDiagnostics: [{ name: 'Relay', detail: 'OFF' }]
          }}
          supportRows={[
            { label: 'App version', value: '2.0.8' },
            { label: 'Platform', value: 'android' }
          ]}
          onClose={vi.fn()}
        />"""
new = """        <AppSettingsScreen onOpenClimate={vi.fn()} onOpenTime={vi.fn()} />"""
if s.count(old) != 1:
    raise SystemExit('settings render anchor missing')
s = s.replace(old, new, 1)
old = """    const dialog = screen.getByRole('dialog', { name: 'App settings' });
    expect(within(dialog).getByText(/client saw a blank screen/)).toBeInTheDocument();

    act(() => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Deutsch' }));
    });"""
new = """    const settings = screen.getByRole('main');
    expect(screen.queryByRole('dialog')).toBeNull();
    const diagnostics = settings.querySelector('details');
    if (!diagnostics) throw new Error('settings diagnostics missing');
    fireEvent.click(diagnostics.querySelector('summary')!);
    expect(within(settings).getByText(/client saw a blank screen/)).toBeInTheDocument();

    act(() => {
      fireEvent.click(within(settings).getByRole('button', { name: 'Deutsch' }));
    });"""
if s.count(old) != 1:
    raise SystemExit('settings dialog assertion anchor missing')
s = s.replace(old, new, 1)
s = s.replace("within(dialog).getByRole('button', { name: 'Dunkel' })", "within(settings).getByRole('button', { name: 'Dunkel' })", 1)
s = s.replace("within(dialog).getByRole('button', { name: 'Support-Bericht kopieren' })", "within(settings).getByRole('button', { name: 'Support-Bericht kopieren' })", 1)
p.write_text(s)

# Normal shell regression: no dialog, no Close/reset, Settings is current.
p = Path('apps/mobile/src/__tests__/navigation-settings-regression.test.tsx')
s = p.read_text()
old = """    expect(screen.getByRole('dialog', { name: 'Ustawienia aplikacji' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Język' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Wygląd' })).toBeVisible();"""
new = """    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Ustawienia' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Język' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Wygląd' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.queryByRole('button', { name: 'Przywróć system' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zamknij' })).toBeNull();
    expect(document.querySelector('.app-settings__hint')).toBeNull();"""
if s.count(old) != 1:
    raise SystemExit('settings regression anchor missing')
p.write_text(s.replace(old, new, 1))

# Route coverage: Settings is a page and bottom navigation can open Time.
p = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
s = p.read_text()
anchor = "  it('starts from the user goal instead of technical setup tabs', () => {"
insert = """  it('opens Settings as a full page and returns through bottom navigation', () => {
    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    useInstalledAutomationStore.getState().upsertInstallation(
      createInstalledAutomation({
        shelly: { id: 'shellyplugsg3-settings-route', model: 'S3PL-00112EU', gen: 3 },
        shellyName: 'Salon',
        baseUrl: 'http://192.168.0.20/',
        scriptId: 1,
        scriptHash: 'lcl-settings-route',
        config,
        nowMs: 1000
      })
    );

    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Ustawienia' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

"""
if s.count(anchor) != 1:
    raise SystemExit('app-routes insertion anchor missing')
p.write_text(s.replace(anchor, insert + anchor, 1))

print('settings tests updated')

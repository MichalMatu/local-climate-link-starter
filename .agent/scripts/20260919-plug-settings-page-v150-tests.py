from pathlib import Path

# Dashboard: settings menu should delegate navigation instead of mounting an overlay/modal.
path = Path('apps/mobile/src/__tests__/automation-dashboard.test.tsx')
text = path.read_text()
text = text.replace(
"""  onOpenSettings = vi.fn(),
  onAddPlug = vi.fn(),
""",
"""  onOpenPlugSettings = vi.fn(),
  onAddPlug = vi.fn(),
""",
1,
)
text = text.replace(
"""          onOpenInstallation={onOpenInstallation}
          onOpenSettings={onOpenSettings}
""",
"""          onOpenInstallation={onOpenInstallation}
          onOpenPlugSettings={onOpenPlugSettings}
""",
1,
)
text = text.replace(
"""    onOpenInstallation,
    onOpenSettings,
    onAddPlug,
""",
"""    onOpenInstallation,
    onOpenPlugSettings,
    onAddPlug,
""",
1,
)
text = text.replace(
"""    renderDashboard(onAddAutomation);
""",
"""    const { onOpenPlugSettings } = renderDashboard(onAddAutomation);
""",
1,
)
old = """    fireEvent.click(
      within(plugCard).getByRole('button', {
        name: 'Ustawienia gniazdka: Nawilżacz salon'
      })
    );
    const settingsDialog = screen.getByRole('dialog', { name: 'Nawilżacz salon' });
    expect(settingsDialog.querySelector('.status-stack')).not.toBeNull();
    expect(await within(settingsDialog).findByText('S3PL-00112EU, gen 3')).toBeVisible();
    expect(within(settingsDialog).getByText('zgodne')).toBeVisible();
    await waitFor(() =>
      expect(useHardwareSetupDraftStore.getState().shellyDevices[0]).toMatchObject({
        model: 'S3PL-00112EU',
        gen: 3
      })
    );
    expect(
      within(settingsDialog).getByRole('button', {
        name: 'Skanuj termometry BLE przez to gniazdko'
      })
    ).toBeVisible();
    expect(
      within(settingsDialog).getByRole('button', {
        name: 'Usuń gniazdko tylko z aplikacji'
      })
    ).toBeVisible();
    fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Zamknij' }));
"""
new = """    fireEvent.click(
      within(plugCard).getByRole('button', {
        name: 'Ustawienia gniazdka: Nawilżacz salon'
      })
    );
    expect(onOpenPlugSettings).toHaveBeenCalledWith('http://192.168.0.30/');
    expect(screen.queryByRole('dialog')).toBeNull();
"""
if old not in text:
    raise SystemExit('dashboard settings-dialog assertion block not found')
text = text.replace(old, new, 1)
path.write_text(text)

# Route regression: saved Plug settings must be a child page in the persistent shell.
path = Path('apps/mobile/src/__tests__/navigation-settings-regression.test.tsx')
text = path.read_text()
text = text.replace(
"""import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';
""",
"""import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';
import {
  resetHardwareSetupDraftStore,
  useHardwareSetupDraftStore
} from '../flows/hardware-setup/setupDraftStore.js';
""",
1,
)
text = text.replace(
"""  AutomationDashboardScreen: ({
    onAddAutomation
  }: {
    onAddAutomation(kind: 'climate' | 'time'): void;
  }) => (
""",
"""  AutomationDashboardScreen: ({
    onAddAutomation,
    onOpenPlugSettings
  }: {
    onAddAutomation(kind: 'climate' | 'time'): void;
    onOpenPlugSettings(deviceId: string): void;
  }) => (
""",
1,
)
text = text.replace(
"""      <button type="button" onClick={() => onAddAutomation('climate')}>
        add-automation-test
      </button>
""",
"""      <button type="button" onClick={() => onAddAutomation('climate')}>
        add-automation-test
      </button>
      <button type="button" onClick={() => onOpenPlugSettings('plug-settings-test')}>
        open-plug-settings-test
      </button>
""",
1,
)
text = text.replace(
"""    resetInstalledAutomationStore();
    setLocalePreference('pl');
""",
"""    resetInstalledAutomationStore();
    resetHardwareSetupDraftStore();
    setLocalePreference('pl');
""",
1,
)
text = text.replace(
"""    resetInstalledAutomationStore();
    setLocalePreference('system');
""",
"""    resetInstalledAutomationStore();
    resetHardwareSetupDraftStore();
    vi.unstubAllGlobals();
    setLocalePreference('system');
""",
1,
)
insert = """
  it('opens saved Plug settings as a child page instead of a modal', async () => {
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'plug-settings-test',
      name: 'Nawilżacz',
      baseUrl: 'http://192.168.0.30/',
      scriptIdInput: '1'
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number | string;
          method?: string;
        };
        let result: unknown = {};
        if (body.method === 'Shelly.GetDeviceInfo') {
          result = { id: 'shellyplugsg3-settings', model: 'S3PL-00112EU', gen: 3 };
        } else if (body.method === 'Shelly.GetStatus') {
          result = {
            matter: { enabled: false },
            script: { enable: true },
            ble: { enable: true },
            'switch:0': { id: 0, output: false },
            wifi: { rssi: -55 },
            sys: { time: '12:00', unixtime: 1_800_000_000, uptime: 3600 }
          };
        } else if (body.method === 'Script.List') {
          result = { scripts: [] };
        }
        return new Response(JSON.stringify({ id: body.id ?? 1, result }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'open-plug-settings-test' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Nawilżacz' })).toBeVisible();
    expect(screen.getByRole('button', { name: '‹ Gniazdka' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Skanuj termometry BLE przez to gniazdko' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Usuń gniazdko tylko z aplikacji' })
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: '‹ Gniazdka' }));
    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();
  });
"""
marker = "\n});\n"
pos = text.rfind(marker)
if pos < 0:
    raise SystemExit('navigation test describe terminator not found')
text = text[:pos] + insert + text[pos:]
path.write_text(text)
print('Plug settings child-page tests patched')

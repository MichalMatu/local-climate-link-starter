import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App.js';
import { setLocalePreference } from '../app/i18n.js';
import { setThemeMode } from '../app/themeMode.js';
import { createInstalledAutomation } from '../flows/installations/model.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';
import {
  resetHardwareSetupDraftStore,
  useHardwareSetupDraftStore
} from '../flows/hardware-setup/setupDraftStore.js';

vi.mock('../screens/AutomationDashboardScreen.js', () => ({
  AutomationDashboardScreen: ({
    onAddAutomation,
    onOpenPlugSettings
  }: {
    onAddAutomation(kind: 'climate' | 'time'): void;
    onOpenPlugSettings(deviceId: string): void;
  }) => (
    <main>
      <h1>dashboard-test</h1>
      <button type="button" onClick={() => onAddAutomation('climate')}>
        add-automation-test
      </button>
      <button type="button" onClick={() => onOpenPlugSettings('plug-settings-test')}>
        open-plug-settings-test
      </button>
    </main>
  )
}));

describe('navigation and settings regression coverage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetInstalledAutomationStore();
    resetHardwareSetupDraftStore();
    setLocalePreference('pl');
    setThemeMode('system');
  });

  afterEach(() => {
    cleanup();
    resetInstalledAutomationStore();
    resetHardwareSetupDraftStore();
    vi.unstubAllGlobals();
    setLocalePreference('system');
    setThemeMode('system');
    window.localStorage.clear();
  });

  it('opens language and appearance settings from the normal app shell', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Ustawienia' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Język' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Wygląd' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.queryByRole('button', { name: 'Przywróć system' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zamknij' })).toBeNull();
    expect(document.querySelector('.app-settings__hint')).toBeNull();
    const shell = document.querySelector('.app-root-shell');
    const content = shell?.querySelector(':scope > .app-root-shell__content');
    const navigation = shell?.querySelector(':scope > .app-bottom-nav');
    expect(shell).not.toBeNull();
    expect(content).not.toBeNull();
    expect(navigation).not.toBeNull();
    expect(content?.contains(navigation ?? null)).toBe(false);
  });

  it('returns visibly from Add automation to an existing dashboard', () => {
    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    useInstalledAutomationStore.getState().upsertInstallation(
      createInstalledAutomation({
        shelly: { id: 'shellyplugsg3-nav-regression', model: 'S3PL-00112EU', gen: 3 },
        shellyName: 'Salon',
        baseUrl: 'http://192.168.0.20/',
        scriptId: 1,
        scriptHash: 'lcl-nav-regression',
        config,
        nowMs: 1000
      })
    );

    render(<App />);
    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'add-automation-test' }));
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();

    const back = document.querySelector<HTMLButtonElement>(
      '.app-page-back-row .setup-context__back'
    );
    expect(back).not.toBeNull();
    fireEvent.click(back!);
    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();
  });
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
    expect(screen.getByRole('button', { name: 'Wstecz: Gniazdka' })).toBeVisible();
    const scanBle = screen.getByRole('button', {
      name: 'Skanuj termometry BLE przez to gniazdko'
    });
    expect(scanBle).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Usuń gniazdko tylko z aplikacji' })
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(scanBle);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      await screen.findByRole('heading', { name: 'Skanuj termometry BLE' })
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Wstecz: Nawilżacz' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Wstecz: Nawilżacz' }));
    expect(await screen.findByRole('heading', { name: 'Nawilżacz' })).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Wstecz: Gniazdka' }));
    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();
  });
});

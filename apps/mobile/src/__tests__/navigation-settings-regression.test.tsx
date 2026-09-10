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

vi.mock('../screens/AutomationDashboardScreen.js', () => ({
  AutomationDashboardScreen: ({ onAddAutomation }: { onAddAutomation(): void }) => (
    <main>
      <h1>dashboard-test</h1>
      <button type="button" onClick={onAddAutomation}>
        add-automation-test
      </button>
    </main>
  )
}));

describe('navigation and settings regression coverage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetInstalledAutomationStore();
    setLocalePreference('pl');
    setThemeMode('system');
  });

  afterEach(() => {
    cleanup();
    resetInstalledAutomationStore();
    setLocalePreference('system');
    setThemeMode('system');
    window.localStorage.clear();
  });

  it('opens language and appearance settings from the normal app shell', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia aplikacji' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();
  });
});

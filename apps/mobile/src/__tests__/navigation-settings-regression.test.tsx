import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App.js';
import { setLocalePreference } from '../app/i18n.js';
import { setThemeMode } from '../app/themeMode.js';

vi.mock('../screens/AutomationDashboardScreen.js', () => ({
  AutomationDashboardScreen: ({
    onAddAutomation,
    onOpenSettings
  }: {
    onAddAutomation(): void;
    onOpenSettings?: () => void;
  }) => (
    <main>
      <h1>dashboard-test</h1>
      <button type="button" onClick={onAddAutomation}>
        add-automation-test
      </button>
      <button type="button" onClick={onOpenSettings}>
        Ustawienia aplikacji
      </button>
    </main>
  )
}));

describe('navigation and settings regression coverage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocalePreference('pl');
    setThemeMode('system');
  });

  afterEach(() => {
    cleanup();
    setLocalePreference('system');
    setThemeMode('system');
    window.localStorage.clear();
  });

  it('returns visibly from Add automation to the dashboard', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'add-automation-test' }));
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();
  });
});

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AppSettingsScreen } from '../app/AppSettingsScreen.js';
import { I18nProvider, getLocalePreference, setLocalePreference } from '../app/i18n.js';
import { clearRuntimeIssues, reportRuntimeIssue } from '../app/runtimeDiagnostics.js';
import { getThemeMode, setThemeMode } from '../app/themeMode.js';

describe('app settings screen', () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  beforeEach(() => {
    window.localStorage.clear();
    setLocalePreference('system');
    setThemeMode('system');
    clearRuntimeIssues();
    document.documentElement.lang = 'en';
    document.documentElement.removeAttribute('data-lcl-theme');
  });

  afterEach(() => {
    cleanup();
    clearRuntimeIssues();
    setLocalePreference('system');
    setThemeMode('system');
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-lcl-theme');
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('sets production language and theme preferences and copies a support report', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    setLocalePreference('en');
    act(() => {
      reportRuntimeIssue('manual', 'client saw a blank screen');
    });

    render(
      <I18nProvider>
        <AppSettingsScreen onOpenClimate={vi.fn()} onOpenTime={vi.fn()} />
      </I18nProvider>
    );

    const settings = screen.getByRole('main');
    expect(screen.queryByRole('dialog')).toBeNull();
    const diagnostics = settings.querySelector('details');
    if (!diagnostics) throw new Error('settings diagnostics missing');
    fireEvent.click(diagnostics.querySelector('summary')!);
    expect(within(settings).getByText(/client saw a blank screen/)).toBeInTheDocument();

    act(() => {
      fireEvent.click(within(settings).getByRole('button', { name: 'Deutsch' }));
    });
    expect(getLocalePreference()).toBe('de');
    expect(document.documentElement.lang).toBe('de');

    act(() => {
      fireEvent.click(within(settings).getByRole('button', { name: 'Dunkel' }));
    });
    expect(getThemeMode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-lcl-theme')).toBe('dark');

    await act(async () => {
      fireEvent.click(
        within(settings).getByRole('button', { name: 'Support-Bericht kopieren' })
      );
    });

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('Locale preference: de')
    );
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Theme: dark'));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('manual: client saw a blank screen')
    );
  });
});

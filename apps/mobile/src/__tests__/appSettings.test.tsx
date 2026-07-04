import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AppSettingsModal } from '../app/AppSettingsModal.js';
import { I18nProvider, getLocalePreference, setLocalePreference } from '../app/i18n.js';
import { clearRuntimeIssues, reportRuntimeIssue } from '../app/runtimeDiagnostics.js';
import { getThemeMode, setThemeMode } from '../app/themeMode.js';

describe('app settings modal', () => {
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
        <AppSettingsModal
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
            { label: 'App version', value: '2.0.4' },
            { label: 'Platform', value: 'android' }
          ]}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    const dialog = screen.getByRole('dialog', { name: 'App settings' });
    expect(within(dialog).getByText(/client saw a blank screen/)).toBeInTheDocument();

    act(() => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Deutsch' }));
    });
    expect(getLocalePreference()).toBe('de');
    expect(document.documentElement.lang).toBe('de');

    act(() => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Dunkel' }));
    });
    expect(getThemeMode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-lcl-theme')).toBe('dark');

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Support-Bericht kopieren' })
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

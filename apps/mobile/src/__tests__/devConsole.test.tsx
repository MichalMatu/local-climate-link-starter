import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DevCommandPalette } from '../app/DevCommandPalette.js';
import { clearRuntimeIssues, installDevConsole } from '../app/devConsole.js';

describe('dev console', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    window.localStorage.clear();
    clearRuntimeIssues();
    document.documentElement.lang = 'en';
    document.documentElement.removeAttribute('data-lcl-theme');
    vi.spyOn(window.console, 'info').mockImplementation(() => undefined);
    cleanup = installDevConsole();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.restoreAllMocks();
    act(() => {
      clearRuntimeIssues();
    });
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-lcl-theme');
  });

  it('exposes locale and theme commands without visible UI', () => {
    expect(window.lclDev).toBeDefined();
    expect(window.lclDev?.help()).toContain(
      "lclDev.setLocale('pl'|'en'|'de'|'es'|'fr'|'it'|'pt-BR')"
    );

    const localeState = window.lclDev?.setLocale('de');
    expect(localeState?.locale.override).toBe('de');

    const darkState = window.lclDev?.setTheme('dark');
    expect(darkState?.theme.mode).toBe('dark');
    expect(document.documentElement.getAttribute('data-lcl-theme')).toBe('dark');

    const systemState = window.lclDev?.resetTheme();
    expect(systemState?.theme.mode).toBe('system');
    expect(document.documentElement.getAttribute('data-lcl-theme')).toBeNull();

    const resetLocaleState = window.lclDev?.resetLocale();
    expect(resetLocaleState?.locale.override).toBeNull();
  });

  it('captures runtime errors and can clear them', () => {
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'render failed',
        error: new Error('render failed'),
        filename: 'App.tsx',
        lineno: 12,
        colno: 4
      })
    );
    const manualIssue = window.lclDev?.reportError('manual note');

    expect(window.lclDev?.errors()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'error', message: 'render failed' }),
        expect.objectContaining({ kind: 'manual', message: 'manual note' })
      ])
    );
    expect(manualIssue).toEqual(expect.objectContaining({ kind: 'manual' }));
    expect(window.lclDev?.state().runtimeErrors).toBe(2);

    expect(window.lclDev?.clearErrors()).toEqual([]);
    expect(window.lclDev?.errors()).toEqual([]);
  });

  it('opens a friendly command menu after typing /help', async () => {
    window.lclDev?.reportError('manual note');
    render(<DevCommandPalette />);

    for (const key of ['/', 'h', 'e', 'l', 'p']) {
      act(() => {
        fireEvent.keyDown(window, { key });
      });
    }

    const dialog = await screen.findByRole('dialog', { name: 'Developer menu' });
    expect(within(dialog).getByRole('button', { name: 'de' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'dark' })).toBeInTheDocument();

    act(() => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'de' }));
    });
    expect(document.documentElement.lang).toBe('de');

    act(() => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'dark' }));
    });
    expect(document.documentElement.getAttribute('data-lcl-theme')).toBe('dark');

    expect(await within(dialog).findByText(/manual note/)).toBeInTheDocument();
    act(() => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Clear errors' }));
    });
    expect(
      await within(dialog).findByText('No runtime issues captured.')
    ).toBeInTheDocument();

    act(() => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Reset all' }));
    });
    expect(document.documentElement.getAttribute('data-lcl-theme')).toBeNull();
    expect(window.lclDev?.state().runtimeErrors).toBe(0);

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Developer menu' })
      ).not.toBeInTheDocument()
    );
  });
});

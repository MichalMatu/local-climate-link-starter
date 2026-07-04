import { Modal } from '@lcl/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { devCommandPaletteOpenEvent } from './devConsole.js';
import {
  clearRuntimeIssues,
  getRuntimeIssues,
  runtimeIssuesChangeEvent,
  type RuntimeIssue
} from './runtimeDiagnostics.js';
import {
  getLocalePreference,
  localePreferenceChangeEvent,
  localePreferences,
  resolveSystemLocale,
  setLocalePreference,
  type LocalePreference
} from './i18n.js';
import {
  getThemeMode,
  setThemeMode,
  themeModeChangeEvent,
  themeModes,
  type ThemeMode
} from './themeMode.js';

type DevCommandSnapshot = {
  localePreference: LocalePreference;
  systemLocale: Exclude<LocalePreference, 'system'>;
  themeMode: ThemeMode;
  runtimeIssues: readonly RuntimeIssue[];
};

const commandSequence = '/help';

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));

const readSnapshot = (): DevCommandSnapshot => ({
  localePreference: getLocalePreference(),
  systemLocale: resolveSystemLocale(),
  themeMode: getThemeMode(),
  runtimeIssues: getRuntimeIssues()
});

const formatIssue = (issue: RuntimeIssue): string =>
  `${issue.kind}: ${issue.message}${issue.source ? ` (${issue.source})` : ''}`;

export const DevCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DevCommandSnapshot>(() => readSnapshot());
  const commandBufferRef = useRef('');

  const refresh = useCallback(() => setSnapshot(readSnapshot()), []);

  const openMenu = useCallback(() => {
    refresh();
    setIsOpen(true);
  }, [refresh]);

  const closeMenu = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return undefined;
    }

    const handleOpen = () => openMenu();
    const handleRefresh = () => refresh();
    window.addEventListener(devCommandPaletteOpenEvent, handleOpen);
    window.addEventListener(localePreferenceChangeEvent, handleRefresh);
    window.addEventListener(themeModeChangeEvent, handleRefresh);
    window.addEventListener(runtimeIssuesChangeEvent, handleRefresh);
    return () => {
      window.removeEventListener(devCommandPaletteOpenEvent, handleOpen);
      window.removeEventListener(localePreferenceChangeEvent, handleRefresh);
      window.removeEventListener(themeModeChangeEvent, handleRefresh);
      window.removeEventListener(runtimeIssuesChangeEvent, handleRefresh);
    };
  }, [openMenu, refresh]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (event.key.length !== 1 || isEditableTarget(event.target)) {
        commandBufferRef.current = '';
        return;
      }

      commandBufferRef.current =
        `${commandBufferRef.current}${event.key.toLowerCase()}`.slice(
          -commandSequence.length
        );
      if (commandBufferRef.current === commandSequence) {
        event.preventDefault();
        commandBufferRef.current = '';
        openMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openMenu]);

  const latestIssues = useMemo(
    () => [...snapshot.runtimeIssues].slice(-4).reverse(),
    [snapshot.runtimeIssues]
  );

  const chooseLocale = (preference: LocalePreference) => {
    setLocalePreference(preference);
    refresh();
  };

  const chooseTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    refresh();
  };

  const clearErrors = () => {
    clearRuntimeIssues();
    refresh();
  };

  const resetAll = () => {
    setLocalePreference('system');
    setThemeMode('system');
    clearRuntimeIssues();
    refresh();
  };

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <Modal
      actions={
        <button className="secondary-action" type="button" onClick={resetAll}>
          Reset all
        </button>
      }
      closeLabel="Close"
      description="Type /help again or run lclDev.menu() to reopen this menu."
      initialFocus="dialog"
      open={isOpen}
      title="Developer menu"
      onClose={closeMenu}
    >
      <div className="dev-command-palette">
        <section className="dev-command-palette__section">
          <div className="dev-command-palette__section-header">
            <h3>Language</h3>
            <span>
              {snapshot.localePreference === 'system'
                ? `system: ${snapshot.systemLocale}`
                : snapshot.localePreference}
            </span>
          </div>
          <div className="dev-command-palette__choice-grid">
            {localePreferences.map((locale) => (
              <button
                key={locale}
                className={
                  snapshot.localePreference === locale
                    ? 'dev-command-palette__choice dev-command-palette__choice--active'
                    : 'dev-command-palette__choice'
                }
                type="button"
                aria-label={locale === 'system' ? 'system language' : undefined}
                aria-pressed={snapshot.localePreference === locale}
                onClick={() => chooseLocale(locale)}
              >
                {locale}
              </button>
            ))}
          </div>
        </section>

        <section className="dev-command-palette__section">
          <div className="dev-command-palette__section-header">
            <h3>Theme</h3>
            <span>{snapshot.themeMode}</span>
          </div>
          <div className="dev-command-palette__choice-grid">
            {themeModes.map((mode) => (
              <button
                key={mode}
                className={
                  snapshot.themeMode === mode
                    ? 'dev-command-palette__choice dev-command-palette__choice--active'
                    : 'dev-command-palette__choice'
                }
                type="button"
                aria-pressed={snapshot.themeMode === mode}
                onClick={() => chooseTheme(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </section>

        <section className="dev-command-palette__section">
          <div className="dev-command-palette__section-header">
            <h3>Runtime debug</h3>
            <span>{snapshot.runtimeIssues.length} captured</span>
          </div>
          {latestIssues.length > 0 ? (
            <ol className="dev-command-palette__issues">
              {latestIssues.map((issue) => (
                <li key={issue.id}>{formatIssue(issue)}</li>
              ))}
            </ol>
          ) : (
            <p>No runtime issues captured.</p>
          )}
          <div className="dev-command-palette__choice-grid">
            <button
              className="dev-command-palette__choice"
              type="button"
              onClick={clearErrors}
            >
              Clear errors
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
};

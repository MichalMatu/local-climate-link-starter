import { Capacitor } from '@capacitor/core';
import { DiagnosticRow, type DiagnosticRowProps } from '@lcl/ui';
import { IconChevronDown } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { AppBottomNavigation } from '../components/AppBottomNavigation.js';
import {
  getLocalePreference,
  localePreferenceChangeEvent,
  localePreferences,
  setLocalePreference,
  useTranslation,
  type Locale,
  type LocalePreference,
  type TranslationKey
} from './i18n.js';
import {
  clearRuntimeIssues,
  getRuntimeIssues,
  runtimeIssuesChangeEvent
} from './runtimeDiagnostics.js';
import { createSupportReport } from './supportReport.js';
import {
  getThemeMode,
  setThemeMode,
  themeModeChangeEvent,
  themeModes,
  type ThemeMode
} from './themeMode.js';

export type SupportDiagnosticRow = {
  label: string;
  value: string;
  tone?: DiagnosticRowProps['tone'];
};

type AppSettingsScreenProps = {
  onOpenClimate(): void;
  onOpenTime(): void;
};

const localeLabelKeys: Record<Locale, TranslationKey> = {
  pl: 'settings.language.pl',
  en: 'settings.language.en',
  de: 'settings.language.de',
  es: 'settings.language.es',
  fr: 'settings.language.fr',
  it: 'settings.language.it',
  'pt-BR': 'settings.language.ptBr'
};

const themeModeLabelKeys: Record<ThemeMode, TranslationKey> = {
  system: 'settings.appearance.system',
  light: 'settings.appearance.light',
  dark: 'settings.appearance.dark'
};

const formatIssue = (kind: string, message: string): string => `${kind}: ${message}`;

const copyToClipboard = async (value: string): Promise<void> => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard API unavailable.');
  }

  await navigator.clipboard.writeText(value);
};

export const AppSettingsScreen = ({
  onOpenClimate,
  onOpenTime
}: AppSettingsScreenProps) => {
  const { locale, t } = useTranslation();
  const platform = Capacitor.getPlatform();
  const [localePreference, setLocalePreferenceState] = useState<LocalePreference>(() =>
    getLocalePreference()
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getThemeMode());
  const [runtimeIssues, setRuntimeIssues] = useState(() => getRuntimeIssues());
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const refresh = () => {
      setLocalePreferenceState(getLocalePreference());
      setThemeModeState(getThemeMode());
      setRuntimeIssues(getRuntimeIssues());
    };

    window.addEventListener(localePreferenceChangeEvent, refresh);
    window.addEventListener(runtimeIssuesChangeEvent, refresh);
    window.addEventListener(themeModeChangeEvent, refresh);
    return () => {
      window.removeEventListener(localePreferenceChangeEvent, refresh);
      window.removeEventListener(runtimeIssuesChangeEvent, refresh);
      window.removeEventListener(themeModeChangeEvent, refresh);
    };
  }, []);

  const chooseLocale = (preference: LocalePreference) => {
    setLocalePreference(preference);
    setLocalePreferenceState(preference);
  };

  const chooseTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setThemeModeState(mode);
  };

  const clearDiagnostics = () => {
    clearRuntimeIssues();
    setRuntimeIssues([]);
    setCopyState('idle');
  };

  const latestIssues = [...runtimeIssues].slice(-4).reverse();
  const supportRows: readonly SupportDiagnosticRow[] = [
    { label: t('settings.support.platform'), value: platform }
  ];
  const supportReport = createSupportReport({
    platform,
    shellyDevices: [],
    sensorDevices: [],
    selectedShelly: t('common.missing'),
    selectedSensor: t('common.missing'),
    lastDiagnostics: [],
    activeLocale: locale,
    localePreference,
    themeMode,
    runtimeIssues
  });

  const copyReport = () => {
    void copyToClipboard(supportReport)
      .then(() => setCopyState('done'))
      .catch(() => setCopyState('failed'));
  };

  return (
    <main className="demo-shell app-settings-screen app-bottom-nav-shell">
      <header className="demo-header app-settings-screen__header">
        <h1>{t('dashboard.settingsTab')}</h1>
      </header>

      <div className="app-settings">
        <section className="app-settings__section">
          <div className="app-settings__section-header">
            <h2>{t('settings.language.title')}</h2>
          </div>
          <div className="app-settings__choice-grid">
            {localePreferences.map((preference) => (
              <button
                key={preference}
                className={
                  localePreference === preference
                    ? 'app-settings__choice app-settings__choice--active'
                    : 'app-settings__choice'
                }
                type="button"
                aria-pressed={localePreference === preference}
                onClick={() => chooseLocale(preference)}
              >
                {preference === 'system'
                  ? t('settings.system')
                  : t(localeLabelKeys[preference])}
              </button>
            ))}
          </div>
        </section>

        <section className="app-settings__section">
          <div className="app-settings__section-header">
            <h2>{t('settings.appearance.title')}</h2>
          </div>
          <div className="app-settings__choice-grid app-settings__choice-grid--appearance">
            {themeModes.map((mode) => (
              <button
                key={mode}
                className={
                  themeMode === mode
                    ? 'app-settings__choice app-settings__choice--active'
                    : 'app-settings__choice'
                }
                type="button"
                aria-pressed={themeMode === mode}
                onClick={() => chooseTheme(mode)}
              >
                {t(themeModeLabelKeys[mode])}
              </button>
            ))}
          </div>
        </section>

        <details className="app-settings__section app-settings__diagnostics">
          <summary className="app-settings__diagnostics-summary">
            <span>{t('common.diagnostics')}</span>
            <span className="app-settings__diagnostics-status">
              {t('settings.support.runtimeErrors', { count: runtimeIssues.length })}
              <IconChevronDown
                className="app-settings__diagnostics-chevron"
                aria-hidden="true"
              />
            </span>
          </summary>
          <div className="app-settings__diagnostics-body">
            <div className="status-stack">
              {supportRows.map((row) => (
                <DiagnosticRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  {...(row.tone ? { tone: row.tone } : {})}
                />
              ))}
            </div>

            {latestIssues.length > 0 && (
              <ol className="app-settings__issues">
                {latestIssues.map((issue) => (
                  <li key={issue.id}>{formatIssue(issue.kind, issue.message)}</li>
                ))}
              </ol>
            )}

            <div className="settings-action-stack">
              <button className="secondary-action" type="button" onClick={copyReport}>
                {t('settings.support.copyReport')}
              </button>
              {runtimeIssues.length > 0 && (
                <button className="secondary-action" type="button" onClick={clearDiagnostics}>
                  {t('settings.support.clearDiagnostics')}
                </button>
              )}
            </div>
            {copyState === 'done' && (
              <p className="app-settings__feedback">{t('settings.support.copyDone')}</p>
            )}
            {copyState === 'failed' && (
              <p className="app-settings__feedback app-settings__feedback--warning">
                {t('settings.support.copyFailed')}
              </p>
            )}
          </div>
        </details>
      </div>

      <AppBottomNavigation
        activeKind="settings"
        onOpenClimate={onOpenClimate}
        onOpenTime={onOpenTime}
      />
    </main>
  );
};
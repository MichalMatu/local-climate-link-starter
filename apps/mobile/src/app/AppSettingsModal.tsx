import { DiagnosticRow, Modal, type DiagnosticRowProps } from '@lcl/ui';
import { useEffect, useState } from 'react';
import {
  getLocalePreference,
  localePreferenceChangeEvent,
  localePreferences,
  setLocalePreference,
  supportedLocales,
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
import { createSupportReport, type SupportReportInput } from './supportReport.js';
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

type AppSettingsModalProps = {
  open: boolean;
  supportRows: readonly SupportDiagnosticRow[];
  supportReportInput: Omit<
    SupportReportInput,
    'activeLocale' | 'localePreference' | 'themeMode' | 'runtimeIssues'
  >;
  onClose(): void;
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

export const AppSettingsModal = ({
  open,
  supportRows,
  supportReportInput,
  onClose
}: AppSettingsModalProps) => {
  const { locale, t } = useTranslation();
  const [localePreference, setLocalePreferenceState] = useState<LocalePreference>(() =>
    getLocalePreference()
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getThemeMode());
  const [runtimeIssues, setRuntimeIssues] = useState(() => getRuntimeIssues());
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle');

  useEffect(() => {
    if (!open || typeof window === 'undefined') {
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
  }, [open]);

  const chooseLocale = (preference: LocalePreference) => {
    setLocalePreference(preference);
    setLocalePreferenceState(preference);
  };

  const chooseTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setThemeModeState(mode);
  };

  const resetSettings = () => {
    chooseLocale('system');
    chooseTheme('system');
    setCopyState('idle');
  };

  const clearDiagnostics = () => {
    clearRuntimeIssues();
    setRuntimeIssues([]);
    setCopyState('idle');
  };

  const copyReport = () => {
    void copyToClipboard(supportReport)
      .then(() => setCopyState('done'))
      .catch(() => setCopyState('failed'));
  };

  const latestIssues = [...runtimeIssues].slice(-4).reverse();
  const supportReport = createSupportReport({
    ...supportReportInput,
    activeLocale: locale,
    localePreference,
    themeMode,
    runtimeIssues
  });

  return (
    <Modal
      actions={
        <button className="secondary-action" type="button" onClick={resetSettings}>
          {t('settings.resetToSystem')}
        </button>
      }
      closeLabel={t('common.close')}
      initialFocus="dialog"
      open={open}
      size="diagnostic"
      title={t('settings.title')}
      onClose={onClose}
    >
      <div className="app-settings">
        <section className="app-settings__section">
          <div className="app-settings__section-header">
            <h3>{t('settings.language.title')}</h3>
            <span>
              {localePreference === 'system'
                ? t('settings.system')
                : t(localeLabelKeys[localePreference])}
            </span>
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
            <h3>{t('settings.appearance.title')}</h3>
            <span>{t(themeModeLabelKeys[themeMode])}</span>
          </div>
          <div className="app-settings__choice-grid">
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

        <section className="app-settings__section">
          <div className="app-settings__section-header">
            <h3>{t('settings.support.title')}</h3>
            <span>
              {t('settings.support.runtimeErrors', {
                count: runtimeIssues.length
              })}
            </span>
          </div>
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
          {latestIssues.length > 0 ? (
            <ol className="app-settings__issues">
              {latestIssues.map((issue) => (
                <li key={issue.id}>{formatIssue(issue.kind, issue.message)}</li>
              ))}
            </ol>
          ) : (
            <p>{t('settings.support.noRuntimeErrors')}</p>
          )}
          <div className="settings-action-stack">
            <button className="secondary-action" type="button" onClick={copyReport}>
              {t('settings.support.copyReport')}
            </button>
            <button className="secondary-action" type="button" onClick={clearDiagnostics}>
              {t('settings.support.clearDiagnostics')}
            </button>
          </div>
          {copyState === 'done' && (
            <p className="app-settings__feedback">{t('settings.support.copyDone')}</p>
          )}
          {copyState === 'failed' && (
            <p className="app-settings__feedback app-settings__feedback--warning">
              {t('settings.support.copyFailed')}
            </p>
          )}
        </section>

        <p className="app-settings__hint">
          {t('settings.language.systemHint', {
            languages: supportedLocales.join(', ')
          })}
        </p>
      </div>
    </Modal>
  );
};

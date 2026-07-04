import {
  getLocalePreference,
  setLocalePreference,
  supportedLocales,
  type Locale
} from './i18n.js';
import {
  clearRuntimeIssues,
  getRuntimeIssues,
  reportRuntimeIssue,
  runtimeIssuesChangeEvent,
  type RuntimeIssue
} from './runtimeDiagnostics.js';
import {
  applyThemeMode,
  getThemeMode,
  setThemeMode,
  themeModes,
  type ThemeMode
} from './themeMode.js';

export type DevConsoleState = {
  locale: {
    active: string;
    preference: 'system' | Locale;
    supported: readonly Locale[];
  };
  theme: {
    mode: ThemeMode;
    htmlAttribute: string | null;
  };
  runtimeErrors: number;
};

export const devCommandPaletteOpenEvent = 'lcl:dev-command-palette-open';
export const devRuntimeIssuesChangeEvent = runtimeIssuesChangeEvent;

export type LclDevConsole = {
  help: () => readonly string[];
  state: () => DevConsoleState;
  menu: () => DevConsoleState;
  setLocale: (locale: Locale) => DevConsoleState;
  resetLocale: () => DevConsoleState;
  setTheme: (mode: ThemeMode) => DevConsoleState;
  resetTheme: () => DevConsoleState;
  errors: () => readonly RuntimeIssue[];
  clearErrors: () => readonly RuntimeIssue[];
  reportError: (message: string) => RuntimeIssue;
  supportedLocales: readonly Locale[];
  themeModes: readonly ThemeMode[];
};

declare global {
  interface Window {
    lclDev?: LclDevConsole;
  }
}

const dispatchDevEvent = (eventName: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName));
  }
};

const assertLocale = (locale: string): Locale => {
  if (supportedLocales.includes(locale as Locale)) {
    return locale as Locale;
  }

  throw new Error(
    `Unsupported locale "${locale}". Use one of: ${supportedLocales.join(', ')}`
  );
};

const assertThemeMode = (mode: string): ThemeMode => {
  if (themeModes.includes(mode as ThemeMode)) {
    return mode as ThemeMode;
  }

  throw new Error(`Unsupported theme "${mode}". Use one of: ${themeModes.join(', ')}`);
};

const devState = (): DevConsoleState => ({
  locale: {
    active: typeof document === 'undefined' ? '' : document.documentElement.lang,
    preference: getLocalePreference(),
    supported: supportedLocales
  },
  theme: {
    mode: getThemeMode(),
    htmlAttribute:
      typeof document === 'undefined'
        ? null
        : document.documentElement.getAttribute('data-lcl-theme')
  },
  runtimeErrors: getRuntimeIssues().length
});

const help = () =>
  [
    "lclDev.setLocale('pl'|'en'|'de'|'es'|'fr'|'it'|'pt-BR')",
    'lclDev.resetLocale()',
    "lclDev.setTheme('system'|'light'|'dark')",
    'lclDev.resetTheme()',
    'lclDev.errors()',
    'lclDev.clearErrors()',
    'lclDev.reportError("message")',
    'lclDev.menu()',
    'Type /help in the app window',
    'lclDev.state()'
  ] as const;

export const installDevConsole = (): (() => void) => {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return () => undefined;
  }

  applyThemeMode();

  const api: LclDevConsole = {
    help,
    state: devState,
    menu() {
      dispatchDevEvent(devCommandPaletteOpenEvent);
      return devState();
    },
    setLocale(locale) {
      setLocalePreference(assertLocale(locale));
      return devState();
    },
    resetLocale() {
      setLocalePreference('system');
      return devState();
    },
    setTheme(mode) {
      setThemeMode(assertThemeMode(mode));
      return devState();
    },
    resetTheme() {
      setThemeMode('system');
      return devState();
    },
    errors: getRuntimeIssues,
    clearErrors: clearRuntimeIssues,
    reportError(message) {
      return reportRuntimeIssue('manual', message);
    },
    supportedLocales,
    themeModes
  };

  window.lclDev = api;
  window.console.info('Local Climate Link dev console ready. Run lclDev.help().');

  return () => {
    if (window.lclDev === api) {
      delete window.lclDev;
    }
  };
};

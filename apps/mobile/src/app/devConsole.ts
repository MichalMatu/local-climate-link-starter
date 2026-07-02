import {
  getDevLocaleOverride,
  setDevLocaleOverride,
  supportedLocales,
  type Locale
} from './i18n.js';
import {
  applyDevThemeMode,
  devThemeModes,
  getDevThemeMode,
  setDevThemeMode,
  type DevThemeMode
} from './themeMode.js';

type RuntimeIssueKind = 'error' | 'unhandledrejection' | 'manual';

export type RuntimeIssue = {
  id: number;
  kind: RuntimeIssueKind;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  atIso: string;
};

export type DevConsoleState = {
  locale: {
    active: string;
    override: Locale | null;
    supported: readonly Locale[];
  };
  theme: {
    mode: DevThemeMode;
    htmlAttribute: string | null;
  };
  runtimeErrors: number;
};

export const devCommandPaletteOpenEvent = 'lcl:dev-command-palette-open';
export const devRuntimeIssuesChangeEvent = 'lcl:dev-runtime-issues-change';

export type LclDevConsole = {
  help: () => readonly string[];
  state: () => DevConsoleState;
  menu: () => DevConsoleState;
  setLocale: (locale: Locale) => DevConsoleState;
  resetLocale: () => DevConsoleState;
  setTheme: (mode: DevThemeMode) => DevConsoleState;
  resetTheme: () => DevConsoleState;
  errors: () => readonly RuntimeIssue[];
  clearErrors: () => readonly RuntimeIssue[];
  reportError: (message: string) => RuntimeIssue;
  supportedLocales: readonly Locale[];
  themeModes: readonly DevThemeMode[];
};

declare global {
  interface Window {
    lclDev?: LclDevConsole;
  }
}

const maxRuntimeIssues = 50;
const runtimeIssues: RuntimeIssue[] = [];
let issueSequence = 0;
let cleanupRuntimeCapture: (() => void) | null = null;

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

const assertThemeMode = (mode: string): DevThemeMode => {
  if (devThemeModes.includes(mode as DevThemeMode)) {
    return mode as DevThemeMode;
  }

  throw new Error(`Unsupported theme "${mode}". Use one of: ${devThemeModes.join(', ')}`);
};

const messageFromUnknown = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'undefined') {
    return 'undefined';
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

const stackFromUnknown = (value: unknown): string | undefined =>
  value instanceof Error ? value.stack : undefined;

const pushIssue = (
  kind: RuntimeIssueKind,
  value: unknown,
  metadata: Partial<Pick<RuntimeIssue, 'source' | 'line' | 'column'>> = {}
): RuntimeIssue => {
  const stack = stackFromUnknown(value);
  const issue: RuntimeIssue = {
    id: ++issueSequence,
    kind,
    message: messageFromUnknown(value),
    atIso: new Date().toISOString(),
    ...metadata
  };
  if (stack) {
    issue.stack = stack;
  }

  runtimeIssues.push(issue);
  if (runtimeIssues.length > maxRuntimeIssues) {
    runtimeIssues.splice(0, runtimeIssues.length - maxRuntimeIssues);
  }
  dispatchDevEvent(devRuntimeIssuesChangeEvent);
  return issue;
};

const installRuntimeCapture = (): (() => void) => {
  if (cleanupRuntimeCapture || typeof window === 'undefined') {
    return cleanupRuntimeCapture ?? (() => undefined);
  }

  const handleError = (event: ErrorEvent) => {
    const metadata: Partial<Pick<RuntimeIssue, 'source' | 'line' | 'column'>> = {};
    if (event.filename) {
      metadata.source = event.filename;
    }
    if (event.lineno) {
      metadata.line = event.lineno;
    }
    if (event.colno) {
      metadata.column = event.colno;
    }

    pushIssue('error', event.error ?? event.message, metadata);
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    pushIssue('unhandledrejection', event.reason);
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  cleanupRuntimeCapture = () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    cleanupRuntimeCapture = null;
  };
  return cleanupRuntimeCapture;
};

const devState = (): DevConsoleState => ({
  locale: {
    active: typeof document === 'undefined' ? '' : document.documentElement.lang,
    override: getDevLocaleOverride(),
    supported: supportedLocales
  },
  theme: {
    mode: getDevThemeMode(),
    htmlAttribute:
      typeof document === 'undefined'
        ? null
        : document.documentElement.getAttribute('data-lcl-theme')
  },
  runtimeErrors: runtimeIssues.length
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

export const getRuntimeIssues = (): readonly RuntimeIssue[] => [...runtimeIssues];

export const clearRuntimeIssues = (): readonly RuntimeIssue[] => {
  runtimeIssues.splice(0, runtimeIssues.length);
  dispatchDevEvent(devRuntimeIssuesChangeEvent);
  return [];
};

export const installDevConsole = (): (() => void) => {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return () => undefined;
  }

  applyDevThemeMode();
  const cleanupCapture = installRuntimeCapture();

  const api: LclDevConsole = {
    help,
    state: devState,
    menu() {
      dispatchDevEvent(devCommandPaletteOpenEvent);
      return devState();
    },
    setLocale(locale) {
      setDevLocaleOverride(assertLocale(locale));
      return devState();
    },
    resetLocale() {
      setDevLocaleOverride(null);
      return devState();
    },
    setTheme(mode) {
      setDevThemeMode(assertThemeMode(mode));
      return devState();
    },
    resetTheme() {
      setDevThemeMode('system');
      return devState();
    },
    errors: getRuntimeIssues,
    clearErrors: clearRuntimeIssues,
    reportError(message) {
      return pushIssue('manual', message);
    },
    supportedLocales,
    themeModes: devThemeModes
  };

  window.lclDev = api;
  window.console.info('Local Climate Link dev console ready. Run lclDev.help().');

  return () => {
    cleanupCapture();
    if (window.lclDev === api) {
      delete window.lclDev;
    }
  };
};

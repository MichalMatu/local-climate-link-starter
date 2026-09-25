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

export type DevShellyBleCandidate = {
  deviceId: string;
  name: string;
  rssi: number | null;
};

export type DevShellyBleProbe = {
  deviceId: string;
  info: unknown;
  status: unknown;
};

export type DevShellyRelayTest = {
  deviceId: string;
  result: unknown;
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
  scanShelly: (timeoutMs?: number) => Promise<DevShellyBleCandidate[]>;
  probeShelly: (deviceId: string) => Promise<DevShellyBleProbe>;
  safeRelayTestShelly: (
    deviceId: string,
    onDurationMs?: number
  ) => Promise<DevShellyRelayTest>;
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

const shellyDevError = (message: string, error: unknown): Error => {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'technicalMessage' in error &&
          typeof error.technicalMessage === 'string'
        ? error.technicalMessage
        : String(error);
  return new Error(`${message}: ${detail}`);
};

const scanShelly = async (timeoutMs = 6000): Promise<DevShellyBleCandidate[]> => {
  const [{ Capacitor }, { CapacitorBleScanner }] = await Promise.all([
    import('@capacitor/core'),
    import('@lcl/ble-core')
  ]);
  const scanner = new CapacitorBleScanner({ platform: Capacitor.getPlatform() });
  const candidates = new Map<string, DevShellyBleCandidate>();

  try {
    for await (const advertisement of scanner.startScan({ timeoutMs })) {
      const name = advertisement.name ?? '';
      if (!name.toLowerCase().startsWith('shelly')) {
        continue;
      }
      candidates.set(advertisement.id, {
        deviceId: advertisement.id,
        name,
        rssi: advertisement.rssi ?? null
      });
    }
  } finally {
    await scanner.stopScan().catch(() => undefined);
  }

  return [...candidates.values()].sort(
    (left, right) => (right.rssi ?? -999) - (left.rssi ?? -999)
  );
};

const createShellyDevClient = async (deviceId: string) => {
  const [{ RpcShellyClient }, { createShellyBleTransport }] = await Promise.all([
    import('@lcl/shelly-client'),
    import('../platform/shellyBleTransport.js')
  ]);
  const transport = createShellyBleTransport(deviceId);
  return { transport, client: new RpcShellyClient(transport) };
};

const probeShelly = async (deviceId: string): Promise<DevShellyBleProbe> => {
  const { transport, client } = await createShellyDevClient(deviceId);

  try {
    const info = await client.getDeviceInfo();
    if (!info.ok) {
      throw shellyDevError('Shelly.GetDeviceInfo failed', info.error);
    }
    const status = await client.getStatus();
    if (!status.ok) {
      throw shellyDevError('Shelly.GetStatus failed', status.error);
    }
    return { deviceId, info: info.value, status: status.value };
  } finally {
    await transport.disconnect();
  }
};

const safeRelayTestShelly = async (
  deviceId: string,
  onDurationMs = 500
): Promise<DevShellyRelayTest> => {
  const { transport, client } = await createShellyDevClient(deviceId);

  try {
    const result = await client.safeRelayTest({ onDurationMs });
    if (!result.ok) {
      throw shellyDevError('Shelly safe relay test failed', result.error);
    }
    return { deviceId, result: result.value };
  } finally {
    await transport.disconnect();
  }
};

const help = () =>
  [
    "lclDev.setLocale('pl'|'en'|'de'|'es'|'fr'|'it'|'pt-BR')",
    'lclDev.resetLocale()',
    "lclDev.setTheme('system'|'light'|'dark')",
    'lclDev.resetTheme()',
    'lclDev.errors()',
    'lclDev.clearErrors()',
    'lclDev.reportError("message")',
    'await lclDev.scanShelly()',
    "await lclDev.probeShelly('<deviceId>')",
    "await lclDev.safeRelayTestShelly('<deviceId>')",
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
    scanShelly,
    probeShelly,
    safeRelayTestShelly,
    supportedLocales,
    themeModes
  };

  window.lclDev = api;
  window.console.info('Shelly Link dev console ready. Run lclDev.help().');

  return () => {
    if (window.lclDev === api) {
      delete window.lclDev;
    }
  };
};

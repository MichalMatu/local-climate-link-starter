export const devThemeModes = ['system', 'light', 'dark'] as const;
export type DevThemeMode = (typeof devThemeModes)[number];

export const devThemeChangeEvent = 'lcl:dev-theme-change';

const DEV_THEME_STORAGE_KEY = 'lcl.dev.themeMode.v1';

const isDevThemeMode = (value: string): value is DevThemeMode =>
  devThemeModes.includes(value as DevThemeMode);

const readStoredThemeMode = (): DevThemeMode => {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return 'system';
  }

  try {
    const storedMode = window.localStorage.getItem(DEV_THEME_STORAGE_KEY);
    return storedMode && isDevThemeMode(storedMode) ? storedMode : 'system';
  } catch {
    return 'system';
  }
};

const writeStoredThemeMode = (mode: DevThemeMode) => {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }

  try {
    if (mode === 'system') {
      window.localStorage.removeItem(DEV_THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(DEV_THEME_STORAGE_KEY, mode);
    }
  } catch {
    // Dev-only convenience storage can fail in private/browser-restricted modes.
  }
};

export const getDevThemeMode = (): DevThemeMode => readStoredThemeMode();

export const applyDevThemeMode = (mode: DevThemeMode = getDevThemeMode()) => {
  if (!import.meta.env.DEV || typeof document === 'undefined') {
    return;
  }

  if (mode === 'system') {
    document.documentElement.removeAttribute('data-lcl-theme');
    return;
  }

  document.documentElement.setAttribute('data-lcl-theme', mode);
};

export const setDevThemeMode = (mode: DevThemeMode): DevThemeMode => {
  if (!import.meta.env.DEV) {
    return 'system';
  }

  writeStoredThemeMode(mode);
  applyDevThemeMode(mode);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(devThemeChangeEvent));
  }
  return mode;
};

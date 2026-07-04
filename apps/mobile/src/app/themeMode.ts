export const themeModes = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof themeModes)[number];

export const themeModeChangeEvent = 'lcl:theme-mode-change';

const THEME_MODE_STORAGE_KEY = 'lcl.preferences.themeMode.v1';

const isThemeMode = (value: string): value is ThemeMode =>
  themeModes.includes(value as ThemeMode);

const readStoredThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'system';
  }

  try {
    const storedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return storedMode && isThemeMode(storedMode) ? storedMode : 'system';
  } catch {
    return 'system';
  }
};

const writeStoredThemeMode = (mode: ThemeMode) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (mode === 'system') {
      window.localStorage.removeItem(THEME_MODE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // Preference storage can fail in private/browser-restricted modes.
  }
};

export const getThemeMode = (): ThemeMode => readStoredThemeMode();

export const applyThemeMode = (mode: ThemeMode = getThemeMode()) => {
  if (typeof document === 'undefined') {
    return;
  }

  if (mode === 'system') {
    document.documentElement.removeAttribute('data-lcl-theme');
    return;
  }

  document.documentElement.setAttribute('data-lcl-theme', mode);
};

export const setThemeMode = (mode: ThemeMode): ThemeMode => {
  writeStoredThemeMode(mode);
  applyThemeMode(mode);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(themeModeChangeEvent));
  }
  return mode;
};

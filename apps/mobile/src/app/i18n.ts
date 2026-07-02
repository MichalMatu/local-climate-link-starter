import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { de } from './locales/de.js';
import { en } from './locales/en.js';
import { es } from './locales/es.js';
import { fr } from './locales/fr.js';
import { it } from './locales/it.js';
import { pl, type PlMessages } from './locales/pl.js';
import { ptBr } from './locales/ptBr.js';

export const supportedLocales = ['pl', 'en', 'de', 'es', 'fr', 'it', 'pt-BR'] as const;
export type Locale = (typeof supportedLocales)[number];

export const messages: Record<Locale, PlMessages> = {
  pl,
  en,
  de,
  es,
  fr,
  it,
  'pt-BR': ptBr
};

type MessageTree = PlMessages;
type MessageParams = Record<string, string | number>;
const DEV_LOCALE_STORAGE_KEY = 'lcl.dev.localeOverride.v1';
export const devLocaleChangeEvent = 'lcl:dev-locale-change';

type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends Record<string, unknown>
      ? `${K}.${LeafPaths<T[K]>}`
      : never;
}[keyof T & string];

export type TranslationKey = LeafPaths<MessageTree>;

export type Translate = (key: TranslationKey, params?: MessageParams) => string;

const isSupportedLocale = (value: string): value is Locale =>
  supportedLocales.includes(value as Locale);

const readStorageValue = (key: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorageValue = (key: string, value: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Dev-only convenience storage can fail in private/browser-restricted modes.
  }
};

const localeAliases: Readonly<Record<string, Locale>> = {
  pt: 'pt-BR'
};

const normalizeLanguageTag = (languageTag: string): string =>
  languageTag.trim().toLowerCase().replace(/_/g, '-');

const browserLanguageTags = (): readonly string[] => {
  if (typeof navigator === 'undefined') {
    return [];
  }

  const languages =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [];
  return navigator.language ? [...languages, navigator.language] : languages;
};

export const resolveSystemLocale = (
  languageTags: readonly string[] = browserLanguageTags()
): Locale => {
  for (const languageTag of languageTags) {
    const normalizedTag = normalizeLanguageTag(languageTag);
    const exactLocale = supportedLocales.find(
      (locale) => locale.toLowerCase() === normalizedTag
    );
    if (exactLocale) {
      return exactLocale;
    }

    const language = normalizedTag.split('-')[0] ?? '';
    if (isSupportedLocale(language)) {
      return language;
    }

    const aliasedLocale = localeAliases[language];
    if (aliasedLocale) {
      return aliasedLocale;
    }
  }

  return 'en';
};

export const getDevLocaleOverride = (): Locale | null => {
  if (!import.meta.env.DEV) {
    return null;
  }

  const storedLocale = readStorageValue(DEV_LOCALE_STORAGE_KEY);
  return storedLocale && isSupportedLocale(storedLocale) ? storedLocale : null;
};

export const setDevLocaleOverride = (locale: Locale | null): Locale | null => {
  if (!import.meta.env.DEV) {
    return null;
  }

  writeStorageValue(DEV_LOCALE_STORAGE_KEY, locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale ?? resolveSystemLocale();
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(devLocaleChangeEvent));
  }
  return locale;
};

export const resolveConfiguredLocale = (
  languageTags: readonly string[] = browserLanguageTags()
): Locale => getDevLocaleOverride() ?? resolveSystemLocale(languageTags);

let activeLocale: Locale = resolveConfiguredLocale();

const resolveMessage = (locale: Locale, key: TranslationKey): string => {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (typeof node !== 'object' || node === null || !(part in node)) {
      return undefined;
    }
    return (node as Record<string, unknown>)[part];
  }, messages[locale]);

  if (typeof value !== 'string') {
    throw new Error(`Missing translation key: ${key}`);
  }

  return value;
};

export const translate = (
  locale: Locale,
  key: TranslationKey,
  params: MessageParams = {}
): string =>
  resolveMessage(locale, key).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramName) =>
    paramName in params ? String(params[paramName]) : match
  );

export const t = (key: TranslationKey, params: MessageParams = {}): string =>
  translate(activeLocale, key, params);

type I18nContextValue = {
  locale: Locale;
  t: Translate;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>(() => resolveConfiguredLocale());

  useEffect(() => {
    activeLocale = locale;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleLanguageChange = () => setLocale(resolveConfiguredLocale());
    window.addEventListener('languagechange', handleLanguageChange);
    window.addEventListener(devLocaleChangeEvent, handleLanguageChange);
    return () => {
      window.removeEventListener('languagechange', handleLanguageChange);
      window.removeEventListener(devLocaleChangeEvent, handleLanguageChange);
    };
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, params) => translate(locale, key, params)
    }),
    [locale]
  );

  return createElement(I18nContext.Provider, { value }, children);
};

export const useTranslation = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (context) {
    return context;
  }

  return {
    locale: activeLocale,
    t
  };
};

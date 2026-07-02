import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { en } from './locales/en.js';
import { pl, type PlMessages } from './locales/pl.js';

export const supportedLocales = ['pl', 'en'] as const;
export type Locale = (typeof supportedLocales)[number];

export const messages: Record<Locale, PlMessages> = {
  pl,
  en
};

type MessageTree = PlMessages;
type MessageParams = Record<string, string | number>;

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

const normalizeLanguageTag = (languageTag: string): string =>
  languageTag.trim().toLowerCase().split('-')[0] ?? '';

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
    const language = normalizeLanguageTag(languageTag);
    if (isSupportedLocale(language)) {
      return language;
    }
  }

  return 'en';
};

let activeLocale: Locale = resolveSystemLocale();

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
  const [locale, setLocale] = useState<Locale>(() => resolveSystemLocale());

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

    const handleLanguageChange = () => setLocale(resolveSystemLocale());
    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
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

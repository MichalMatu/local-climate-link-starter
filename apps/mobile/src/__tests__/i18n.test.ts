import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  messages,
  resolveSystemLocale,
  supportedLocales,
  t,
  translate,
  type TranslationKey
} from '../app/i18n.js';

const flattenKeys = (value: unknown, prefix = ''): string[] => {
  if (typeof value === 'string') {
    return [prefix];
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
};

const sourceRoot = dirname(fileURLToPath(import.meta.url)).replace(
  /\/src\/__tests__$/,
  '/src'
);
const repoRoot = join(sourceRoot, '../../..');

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      if (path.includes('/app/locales') || path.includes('/__tests__')) {
        return [];
      }
      return collectSourceFiles(path);
    }

    return ['.ts', '.tsx'].includes(extname(path)) ? [path] : [];
  });

const hardcodedPolishPattern =
  /\b(Nazwa|Gniazdko|Gniazdka|Termometr|Termometry|Dodaj|Usuń|Skanuj|Zamknij|Wybierz|Przekaźnik|Wilgotność|Temperatura|Sprawdź|Reguła|Skrypt|Czas|Brak|Pobieram|Odśwież|Ustawienia|Zaawansowane|Zastosuj|Domyślne|Potwierdź|Adres|Progi|Prąd|Energia|Zegar|Powód|poniżej|powyżej|wpisz|wybierz)\b|[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

describe('i18n', () => {
  it('resolves required MVP safety and setup messages in Polish', () => {
    expect(translate('pl', 'hardware.sensor.add')).toBe('Dodaj termometr');
    expect(translate('pl', 'hardware.shelly.add')).toBe('Dodaj gniazdko');
    expect(translate('pl', 'hardware.rule.setThreshold')).toBe('Ustaw próg');
    expect(translate('pl', 'hardware.safety.heatingDefaultOff')).toBe(
      'Dla grzania domyślny tryb bezpieczeństwa to OFF.'
    );
    expect(translate('pl', 'hardware.safety.matterBlocked')).toBe(
      'Matter jest włączony. Lokalny termostat wymaga Shelly Scripts.'
    );
  });

  it('resolves required MVP messages in English', () => {
    expect(translate('en', 'hardware.sensor.add')).toBe('Add thermometer');
    expect(translate('en', 'hardware.shelly.add')).toBe('Add plug');
    expect(translate('en', 'hardware.rule.setThreshold')).toBe('Set threshold');
    expect(translate('en', 'hardware.safety.matterBlocked')).toBe(
      'Matter is enabled. The local thermostat requires Shelly Scripts.'
    );
  });

  it('resolves required MVP messages in every supported locale', () => {
    for (const locale of supportedLocales) {
      expect(translate(locale, 'hardware.sensor.add')).not.toBe('');
      expect(translate(locale, 'hardware.shelly.add')).not.toBe('');
      expect(translate(locale, 'hardware.rule.setThreshold')).not.toBe('');
      expect(translate(locale, 'hardware.safety.heatingDefaultOff')).not.toBe('');
      expect(translate(locale, 'hardware.safety.matterBlocked')).not.toBe('');
    }
  });

  it('keeps every locale on the same key set', () => {
    const baseKeys = flattenKeys(messages.pl).sort();

    for (const locale of supportedLocales) {
      expect(flattenKeys(messages[locale]).sort()).toEqual(baseKeys);
    }
  });

  it('uses the system language with English fallback', () => {
    expect(resolveSystemLocale(['pl-PL', 'en-US'])).toBe('pl');
    expect(resolveSystemLocale(['en-GB'])).toBe('en');
    expect(resolveSystemLocale(['de-DE'])).toBe('de');
    expect(resolveSystemLocale(['es-MX'])).toBe('es');
    expect(resolveSystemLocale(['fr-CA'])).toBe('fr');
    expect(resolveSystemLocale(['it-IT'])).toBe('it');
    expect(resolveSystemLocale(['pt-BR'])).toBe('pt-BR');
    expect(resolveSystemLocale(['pt-PT'])).toBe('pt-BR');
    expect(resolveSystemLocale(['zh-CN'])).toBe('en');
    expect(resolveSystemLocale([])).toBe('en');
  });

  it('interpolates validation parameters per locale', () => {
    expect(
      translate('pl', 'hardware.validation.scanAddressRequired', {
        label: translate('pl', 'hardware.validation.scanStartLabel')
      })
    ).toBe('Wpisz adres początkowy, np. 192.168.0.1.');

    expect(
      translate('en', 'hardware.validation.scanAddressRequired', {
        label: translate('en', 'hardware.validation.scanStartLabel')
      })
    ).toBe('Enter start address, e.g. 192.168.0.1.');
  });

  it('fails loudly for missing keys', () => {
    expect(() => t('hardware.missing.key' as TranslationKey)).toThrow(
      'Missing translation key: hardware.missing.key'
    );
  });

  it('keeps Polish UI copy out of production components and helpers', () => {
    const files = [
      ...collectSourceFiles(sourceRoot),
      ...collectSourceFiles(join(repoRoot, 'packages/ui/src'))
    ];
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return hardcodedPolishPattern.test(source) ? [relative(repoRoot, file)] : [];
    });

    expect(offenders).toEqual([]);
  });
});

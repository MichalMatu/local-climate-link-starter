import { t, type TranslationKey } from '../app/i18n.js';

describe('i18n', () => {
  it('resolves required MVP safety and setup messages', () => {
    expect(t('hardware.sensor.add')).toBe('Dodaj termometr');
    expect(t('hardware.shelly.add')).toBe('Dodaj gniazdko');
    expect(t('hardware.rule.setThreshold')).toBe('Ustaw próg');
    expect(t('hardware.safety.heatingDefaultOff')).toBe(
      'Dla grzania domyślny tryb bezpieczeństwa to OFF.'
    );
    expect(t('hardware.safety.matterBlocked')).toBe(
      'Matter jest włączony. Lokalny termostat wymaga Shelly Scripts.'
    );
  });

  it('interpolates validation parameters', () => {
    expect(
      t('hardware.validation.scanAddressRequired', {
        label: t('hardware.validation.scanStartLabel')
      })
    ).toBe('Wpisz adres początkowy, np. 192.168.0.1.');
  });

  it('fails loudly for missing keys', () => {
    expect(() => t('hardware.missing.key' as TranslationKey)).toThrow(
      'Missing translation key: hardware.missing.key'
    );
  });
});

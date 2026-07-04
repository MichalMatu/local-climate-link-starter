import { render, screen, waitFor } from '@testing-library/react';

import { landingLocales, landingMessages, resolveLandingLocale } from './content';
import { LandingPage } from './page';

beforeEach(() => {
  document.head.innerHTML = `
    <meta name="description" content="" />
    <meta property="og:title" content="" />
    <meta property="og:description" content="" />
  `;
});

const collectStrings = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
};

describe('LandingPage', () => {
  it('shows the Polish product promise and primary beta action', () => {
    render(<LandingPage initialLocale="pl" />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Termostat bez huba' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pobierz betę Android' })).toHaveAttribute(
      'href',
      '#beta'
    );
  });

  it('shows English when the resolved locale is English', () => {
    render(<LandingPage initialLocale="en" />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Thermostat without a hub' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Android beta' })).toHaveAttribute(
      'href',
      '#beta'
    );
    expect(screen.getByRole('link', { name: 'Download APK' })).toHaveAttribute(
      'href',
      'https://github.com/MichalMatu/local-climate-link-starter/releases/tag/v2.0.2'
    );
  });

  it.each(landingLocales)('updates document metadata for %s', async (locale) => {
    render(<LandingPage initialLocale={locale} />);

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', locale);
      expect(document.title).toBe(landingMessages[locale].meta.title);
      expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
        'content',
        landingMessages[locale].meta.description
      );
    });
  });

  it('keeps the supported MVP hardware visible', () => {
    render(<LandingPage initialLocale="en" />);

    expect(screen.getByText('Shelly Plug S Gen3')).toBeInTheDocument();
    expect(screen.getByText('Xiaomi LYWSD03MMC / PVVX')).toBeInTheDocument();
    expect(screen.getByText('TP357 custom BLE')).toBeInTheDocument();
  });
});

describe('resolveLandingLocale', () => {
  it('supports every app locale and falls back to English', () => {
    expect(landingLocales).toEqual(['pl', 'en', 'de', 'es', 'fr', 'it', 'pt-BR']);
    expect(resolveLandingLocale(['pl-PL'])).toBe('pl');
    expect(resolveLandingLocale(['en-US'])).toBe('en');
    expect(resolveLandingLocale(['de-DE'])).toBe('de');
    expect(resolveLandingLocale(['es-ES'])).toBe('es');
    expect(resolveLandingLocale(['fr-FR'])).toBe('fr');
    expect(resolveLandingLocale(['it-IT'])).toBe('it');
    expect(resolveLandingLocale(['pt-BR'])).toBe('pt-BR');
    expect(resolveLandingLocale(['pt-PT'])).toBe('pt-BR');
    expect(resolveLandingLocale(['zh-CN'])).toBe('en');
  });
});

describe('landingMessages', () => {
  it.each(landingLocales)('keeps %s copy structurally complete', (locale) => {
    const copy = landingMessages[locale];
    const strings = collectStrings(copy);

    expect(copy.workflow.steps).toHaveLength(3);
    expect(copy.hardware.items).toHaveLength(3);
    expect(copy.instructions.items).toHaveLength(4);
    expect(copy.faq.items).toHaveLength(3);
    expect(strings.every((text) => text.trim().length > 0)).toBe(true);
  });

  it('keeps hardware details localized beyond English', () => {
    expect(landingMessages.de.hardware.items[0]?.detail).toContain('Shelly-Firmware');
    expect(landingMessages.es.hardware.items[0]?.detail).toContain('firmware Shelly');
    expect(landingMessages.fr.hardware.items[0]?.detail).toContain('firmware Shelly');
    expect(landingMessages.it.hardware.items[0]?.detail).toContain('firmware Shelly');
    expect(landingMessages['pt-BR'].hardware.items[0]?.detail).toContain(
      'firmware Shelly'
    );
  });

  it('keeps non-English preview labels localized', () => {
    expect(landingMessages.de.preview.tabs.sensors).toBe('Sensoren');
    expect(landingMessages.de.preview.tabs.rule).toBe('Regel');
    expect(landingMessages.de.preview.addThermometer).toBe('Thermometer hinzufügen');
    expect(landingMessages.es.preview.aria).toContain('Vista previa');
    expect(landingMessages.fr.preview.aria).toContain('Aperçu');
    expect(landingMessages.it.preview.aria).toContain('Anteprima');
    expect(landingMessages['pt-BR'].preview.aria).toContain('Prévia');
  });
});

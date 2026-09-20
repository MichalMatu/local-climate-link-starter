import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  I18nProvider,
  setLocalePreference,
  translate,
  useTranslation,
  type Locale
} from '../app/i18n.js';
import { unwrapShellyResult } from '../flows/hardware-setup/shellyRequests.js';

const invalidResponse = {
  ok: false as const,
  error: {
    kind: 'unknown' as const,
    userMessageKey: 'errors.shellyInvalidResponse',
    technicalMessage: 'Shelly RPC HTTP 500',
    retryable: true
  }
};

const currentShellyErrorMessage = (): string => {
  try {
    unwrapShellyResult(invalidResponse);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const LocaleProbe = ({
  onMessage
}: {
  onMessage(locale: Locale, message: string): void;
}) => {
  const { locale } = useTranslation();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onMessage(locale, currentShellyErrorMessage());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [locale, onMessage]);

  return null;
};

describe('Shelly request translations', () => {
  afterEach(() => {
    cleanup();
    setLocalePreference('system');
  });

  it('resolves request errors using the current locale instead of import-time copy', async () => {
    const onMessage = vi.fn<(locale: Locale, message: string) => void>();
    setLocalePreference('pl');
    render(
      <I18nProvider>
        <LocaleProbe onMessage={onMessage} />
      </I18nProvider>
    );

    await waitFor(() =>
      expect(onMessage).toHaveBeenCalledWith(
        'pl',
        translate('pl', 'hardware.shelly.invalidResponse')
      )
    );

    act(() => setLocalePreference('en'));

    await waitFor(() =>
      expect(onMessage).toHaveBeenCalledWith(
        'en',
        translate('en', 'hardware.shelly.invalidResponse')
      )
    );
  });
});

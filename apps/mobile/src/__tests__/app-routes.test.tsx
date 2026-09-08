import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import type { SetupIntent } from '../flows/setup-intent.js';

vi.mock('../screens/hardware-setup/HardwareSetupScreen.js', () => ({
  HardwareSetupScreen: ({
    setupIntent,
    onBackToIntent
  }: {
    setupIntent?: SetupIntent;
    onBackToIntent?: () => void;
  }) => (
    <section>
      <p>{`mock-setup-${setupIntent ?? 'none'}`}</p>
      <button type="button" onClick={onBackToIntent}>
        mock-back
      </button>
    </section>
  )
}));

import { AppRoutes } from '../routes/AppRoutes.js';

const renderRoutes = () =>
  render(
    <I18nProvider>
      <AppRoutes />
    </I18nProvider>
  );

describe('AppRoutes user intent entry', () => {
  beforeEach(() => {
    setLocalePreference('pl');
  });

  it('starts from the user goal instead of technical setup tabs', () => {
    renderRoutes();

    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować temperaturą/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować wilgotnością/ })).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Zarządzać istniejącą automatyką/ })
    ).toBeVisible();
  });

  it('opens the selected goal and can return to goal selection', async () => {
    renderRoutes();

    fireEvent.click(screen.getByRole('button', { name: /Sterować temperaturą/ }));
    expect(await screen.findByText('mock-setup-temperature')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { createInstalledAutomation } from '../flows/installations/model.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';
import type { SetupIntent } from '../flows/setup-intent.js';

vi.mock('../screens/InstallationDetailScreen.js', () => ({
  InstallationDetailScreen: ({
    installationId,
    onBack
  }: {
    installationId: string;
    onBack: () => void;
  }) => (
    <section>
      <p>{`mock-installation-${installationId}`}</p>
      <button type="button" onClick={onBack}>
        mock-dashboard-back
      </button>
    </section>
  )
}));

vi.mock('../screens/hardware-setup/HardwareSetupScreen.js', () => ({
  HardwareSetupScreen: ({
    setupIntent,
    onBackToIntent,
    onSetupComplete
  }: {
    setupIntent?: SetupIntent;
    onBackToIntent?: () => void;
    onSetupComplete?: () => void;
  }) => (
    <section>
      <p>{`mock-setup-${setupIntent ?? 'none'}`}</p>
      <button type="button" onClick={onBackToIntent}>
        mock-back
      </button>
      <button type="button" onClick={onSetupComplete}>
        mock-complete
      </button>
    </section>
  )
}));

import { AppRoutes } from '../routes/AppRoutes.js';

const renderRoutes = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
      </QueryClientProvider>
    </I18nProvider>
  );
};

describe('AppRoutes user intent entry', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    resetInstalledAutomationStore();
  });

  it('opens the dashboard immediately when an installed automation already exists', () => {
    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    useInstalledAutomationStore.getState().upsertInstallation(
      createInstalledAutomation({
        shelly: { id: 'shellyplugsg3-route', model: 'S3PL-00112EU', gen: 3 },
        shellyName: 'Salon',
        baseUrl: 'http://192.168.0.20/',
        scriptId: 1,
        scriptHash: 'lcl-route',
        config,
        nowMs: 1000
      })
    );

    renderRoutes();

    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Co chcesz zrobić?' })).toBeNull();
  });

  it('opens an installed system by stable installation id and returns to the dashboard', () => {
    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    const installation = createInstalledAutomation({
      shelly: { id: 'shellyplugsg3-route-detail', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Salon',
      baseUrl: 'http://192.168.0.20/',
      scriptId: 1,
      scriptHash: 'lcl-route-detail',
      config,
      nowMs: 1000
    });
    useInstalledAutomationStore.getState().upsertInstallation(installation);

    renderRoutes();

    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-dashboard-back' }));
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
  });

  it('starts from the user goal instead of technical setup tabs', () => {
    renderRoutes();

    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować temperaturą/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować wilgotnością/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować według czasu/ })).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Zarządzać istniejącą automatyką/ })
    ).toBeVisible();
  });

  it('opens time setup and returns to the dashboard after setup completion', async () => {
    renderRoutes();

    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));
    expect(await screen.findByText('mock-setup-time')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
  });

  it('opens the management dashboard from the user goal', () => {
    renderRoutes();

    fireEvent.click(
      screen.getByRole('button', { name: /Zarządzać istniejącą automatyką/ })
    );

    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.getByText('Nie masz jeszcze zapisanej automatyki')).toBeVisible();
  });

  it('opens the selected goal and can return to goal selection', async () => {
    renderRoutes();

    fireEvent.click(screen.getByRole('button', { name: /Sterować temperaturą/ }));
    expect(await screen.findByText('mock-setup-temperature')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
  });
});

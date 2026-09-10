import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { createInstalledAutomation } from '../flows/installations/model.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';
import type { SetupIntent } from '../flows/setup-intent.js';

const nativeAppMocks = vi.hoisted(() => {
  let backListener: (() => void) | undefined;
  const removeListener = vi.fn(async () => undefined);
  const addListener = vi.fn(async (eventName: string, listener: () => void) => {
    if (eventName === 'backButton') {
      backListener = listener;
    }
    return { remove: removeListener };
  });
  return {
    addListener,
    exitApp: vi.fn(async () => undefined),
    getPlatform: vi.fn(() => 'web'),
    removeListener,
    fireBack: () => backListener?.(),
    resetListener: () => {
      backListener = undefined;
    }
  };
});

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: nativeAppMocks.addListener,
    exitApp: nativeAppMocks.exitApp
  }
}));

vi.mock(import('@capacitor/core'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      getPlatform: nativeAppMocks.getPlatform
    }
  };
});

vi.mock('../screens/InstallationDetailScreen.js', () => ({
  InstallationDetailScreen: ({
    installationId,
    onBack,
    onNavigateDashboard
  }: {
    installationId: string;
    onBack: () => void;
    onNavigateDashboard?: (kind: 'climate' | 'time') => void;
  }) => (
    <section>
      <p>{`mock-installation-${installationId}`}</p>
      <button type="button" onClick={onBack}>
        mock-dashboard-back
      </button>
      <button type="button" onClick={() => onNavigateDashboard?.('time')}>
        mock-dashboard-time
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
    nativeAppMocks.resetListener();
    nativeAppMocks.getPlatform.mockReturnValue('web');
    nativeAppMocks.addListener.mockClear();
    nativeAppMocks.exitApp.mockClear();
    nativeAppMocks.removeListener.mockClear();
  });

  it('keeps native back handling disabled in the web preview', () => {
    renderRoutes();

    expect(nativeAppMocks.addListener).not.toHaveBeenCalled();
  });

  it('returns from Android setup to the goal and exits only at the root', async () => {
    nativeAppMocks.getPlatform.mockReturnValue('android');
    const view = renderRoutes();
    await waitFor(() =>
      expect(nativeAppMocks.addListener).toHaveBeenCalledWith(
        'backButton',
        expect.any(Function)
      )
    );

    fireEvent.click(screen.getByRole('button', { name: /Sterować temperaturą/ }));
    expect(await screen.findByText('mock-setup-temperature')).toBeVisible();

    act(() => nativeAppMocks.fireBack());
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();

    act(() => nativeAppMocks.fireBack());
    await waitFor(() => expect(nativeAppMocks.exitApp).toHaveBeenCalledTimes(1));

    view.unmount();
    await waitFor(() => expect(nativeAppMocks.removeListener).toHaveBeenCalledTimes(1));
  });

  it('returns from an installed detail to the dashboard before exiting Android', async () => {
    nativeAppMocks.getPlatform.mockReturnValue('android');
    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    const installation = createInstalledAutomation({
      shelly: { id: 'shellyplugsg3-native-back', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Salon',
      baseUrl: 'http://192.168.0.20/',
      scriptId: 1,
      scriptHash: 'lcl-native-back',
      config,
      nowMs: 1000
    });
    useInstalledAutomationStore.getState().upsertInstallation(installation);

    renderRoutes();
    await waitFor(() =>
      expect(nativeAppMocks.addListener).toHaveBeenCalledWith(
        'backButton',
        expect.any(Function)
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();

    act(() => nativeAppMocks.fireBack());
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();

    act(() => nativeAppMocks.fireBack());
    await waitFor(() => expect(nativeAppMocks.exitApp).toHaveBeenCalledTimes(1));
  });

  it('keeps zero-installation Android state on the canonical goal screen', async () => {
    nativeAppMocks.getPlatform.mockReturnValue('android');
    renderRoutes();
    await waitFor(() =>
      expect(nativeAppMocks.addListener).toHaveBeenCalledWith(
        'backButton',
        expect.any(Function)
      )
    );

    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Zarządzać istniejącą automatyką/ })
    ).toBeNull();
    expect(screen.queryByText('Nie masz jeszcze zapisanej automatyki')).toBeNull();
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

    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-dashboard-time' }));
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Klimat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-dashboard-back' }));
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
  });

  it('opens Settings as a full page and returns through bottom navigation', () => {
    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    useInstalledAutomationStore.getState().upsertInstallation(
      createInstalledAutomation({
        shelly: { id: 'shellyplugsg3-settings-route', model: 'S3PL-00112EU', gen: 3 },
        shellyName: 'Salon',
        baseUrl: 'http://192.168.0.20/',
        scriptId: 1,
        scriptHash: 'lcl-settings-route',
        config,
        nowMs: 1000
      })
    );

    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Ustawienia' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('starts from the user goal instead of technical setup tabs', () => {
    renderRoutes();

    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować temperaturą/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować wilgotnością/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować według czasu/ })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Zarządzać istniejącą automatyką/ })
    ).toBeNull();
  });

  it('opens time setup and returns to the dashboard after setup completion', async () => {
    renderRoutes();

    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));
    expect(await screen.findByText('mock-setup-time')).toBeVisible();

    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    useInstalledAutomationStore.getState().upsertInstallation(
      createInstalledAutomation({
        shelly: { id: 'shellyplugsg3-setup-complete', model: 'S3PL-00112EU', gen: 3 },
        shellyName: 'Salon',
        baseUrl: 'http://192.168.0.20/',
        scriptId: 1,
        scriptHash: 'lcl-setup-complete',
        config,
        nowMs: 1000
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
  });

  it('shows management only when an installation exists', () => {
    const config = createDefaultShellyThermostatConfig(
      'xiaomi_lywsd03mmc_bthome_v2',
      'heating'
    );
    useInstalledAutomationStore.getState().upsertInstallation(
      createInstalledAutomation({
        shelly: { id: 'shellyplugsg3-manage', model: 'S3PL-00112EU', gen: 3 },
        shellyName: 'Salon',
        baseUrl: 'http://192.168.0.20/',
        scriptId: 1,
        scriptHash: 'lcl-manage',
        config,
        nowMs: 1000
      })
    );

    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
    fireEvent.click(
      screen.getByRole('button', { name: /Zarządzać istniejącą automatyką/ })
    );

    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
  });

  it('opens the selected goal and can return to goal selection', async () => {
    renderRoutes();

    fireEvent.click(screen.getByRole('button', { name: /Sterować temperaturą/ }));
    expect(await screen.findByText('mock-setup-temperature')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
  });
});

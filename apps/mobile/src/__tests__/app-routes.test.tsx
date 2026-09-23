import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import {
  createInstalledAutomation,
  createTimeInstalledAutomation
} from '../flows/installations/model.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';
import type { SetupIntent } from '../flows/setup-intent.js';
import {
  resetHardwareSetupDraftStore,
  useHardwareSetupDraftStore
} from '../flows/hardware-setup/setupDraftStore.js';

const nativeAppMocks = vi.hoisted(() => {
  let backListener: (() => void) | undefined;
  const removeListener = vi.fn(async () => undefined);
  const addListener = vi.fn(async (eventName: string, listener: () => void) => {
    if (eventName === 'backButton') backListener = listener;
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
  App: { addListener: nativeAppMocks.addListener, exitApp: nativeAppMocks.exitApp }
}));

vi.mock(import('@capacitor/core'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, getPlatform: nativeAppMocks.getPlatform }
  };
});

vi.mock('../screens/InstallationDetailScreen.js', () => ({
  InstallationDetailScreen: ({
    installationId,
    onBack,
    onNavigateDashboard,
    onEdit
  }: {
    installationId: string;
    onBack: () => void;
    onNavigateDashboard?: (kind: 'climate' | 'time') => void;
    onEdit?: () => void;
  }) => (
    <section>
      <p>{`mock-installation-${installationId}`}</p>
      <button type="button" onClick={onBack}>
        mock-dashboard-back
      </button>
      <button type="button" onClick={() => onNavigateDashboard?.('time')}>
        mock-dashboard-time
      </button>
      <button type="button" onClick={onEdit}>
        mock-edit
      </button>
    </section>
  )
}));

vi.mock('../screens/hardware-setup/HardwareSetupScreen.js', () => ({
  HardwareSetupScreen: ({
    setupIntent,
    fixedShellyId,
    editInstallationId,
    onBackToIntent,
    onSetupComplete,
    plugAddOnly,
    sensorAddOnly
  }: {
    setupIntent?: SetupIntent;
    fixedShellyId?: string;
    editInstallationId?: string;
    onBackToIntent?: () => void;
    onSetupComplete?: () => void;
    plugAddOnly?: boolean;
    sensorAddOnly?: boolean;
  }) => (
    <section>
      <p>{`mock-setup-${setupIntent ?? 'none'}`}</p>
      <p>{`mock-fixed-shelly-${fixedShellyId ?? 'none'}`}</p>
      <p>{`mock-edit-installation-${editInstallationId ?? 'none'}`}</p>
      <p>{`mock-plug-add-${plugAddOnly ? 'yes' : 'no'}`}</p>
      <p>{`mock-sensor-add-${sensorAddOnly ? 'yes' : 'no'}`}</p>
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
      </QueryClientProvider>
    </I18nProvider>
  );
};

const addClimateInstallation = (suffix = 'route') => {
  const config = createDefaultShellyThermostatConfig(
    'xiaomi_lywsd03mmc_bthome_v2',
    'heating'
  );
  const installation = createInstalledAutomation({
    shelly: { id: `shellyplugsg3-${suffix}`, model: 'S3PL-00112EU', gen: 3 },
    shellyName: 'Salon',
    baseUrl: 'http://192.168.0.20/',
    scriptId: 1,
    scriptHash: `lcl-${suffix}`,
    config,
    nowMs: 1000
  });
  useInstalledAutomationStore.getState().upsertInstallation(installation);
  return installation;
};

const addTimeInstallation = (suffix = 'time-route') => {
  const installation = createTimeInstalledAutomation({
    shelly: { id: `shellyplugsg3-${suffix}`, model: 'S3PL-00112EU', gen: 3 },
    shellyName: 'Lampa',
    baseUrl: 'http://192.168.0.24/',
    onJobId: 7,
    offJobId: 8,
    config: { relayId: 0, onTime: '08:00', offTime: '20:00' },
    nowMs: 1000
  });
  useInstalledAutomationStore.getState().upsertInstallation(installation);
  useHardwareSetupDraftStore.getState().upsertShellyDevice({
    id: installation.shelly.deviceId,
    name: installation.shelly.name,
    baseUrl: installation.shelly.baseUrl,
    scriptIdInput: '1'
  });
  return installation;
};

describe('AppRoutes navigation shell', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    resetInstalledAutomationStore();
    resetHardwareSetupDraftStore();
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

  it('uses the empty dashboard as the canonical zero-installation root', () => {
    renderRoutes();
    expect(screen.getByRole('main', { name: 'Gniazdka' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Dodaj gniazdko' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.queryByRole('heading', { name: 'Co chcesz zrobić?' })).toBeNull();
    expect(document.querySelector('.app-settings-trigger')).toBeNull();
  });

  it('opens standalone Add Plug without page-local back and keeps bottom navigation available', async () => {
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));
    expect(await screen.findByText('mock-setup-none')).toBeVisible();
    expect(screen.getByText('mock-plug-add-yes')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Co chcesz zrobić?' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'mock-add-back' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Gniazdka' }));
    expect(screen.getByRole('main', { name: 'Gniazdka' })).toBeVisible();
  });

  it('uses Android system Back to leave both standalone device-add pages', async () => {
    nativeAppMocks.getPlatform.mockReturnValue('android');
    renderRoutes();
    await waitFor(() =>
      expect(nativeAppMocks.addListener).toHaveBeenCalledWith(
        'backButton',
        expect.any(Function)
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));
    expect(await screen.findByText('mock-plug-add-yes')).toBeVisible();
    act(() => nativeAppMocks.fireBack());
    expect(screen.getByRole('main', { name: 'Gniazdka' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Skanuj termometry BLE telefonem' })
    );
    expect(await screen.findByText('mock-sensor-add-yes')).toBeVisible();
    act(() => nativeAppMocks.fireBack());
    expect(screen.getByRole('main', { name: 'Termometry' })).toBeVisible();
  });

  it('starts climate setup from a saved plug with fixed Shelly context', async () => {
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.30/',
      name: 'Nawilżacz',
      baseUrl: 'http://192.168.0.30/',
      scriptIdInput: '1'
    });
    renderRoutes();
    const card = screen.getByText('Nawilżacz').closest('article');
    expect(card).not.toBeNull();
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', { name: 'Dodaj automatykę' })
    );
    fireEvent.click(screen.getByRole('button', { name: /Sterować temperaturą/ }));
    expect(await screen.findByText('mock-setup-temperature')).toBeVisible();
    expect(screen.getByText('mock-fixed-shelly-http://192.168.0.30/')).toBeVisible();
  });

  it('starts time setup from a saved plug and keeps that Shelly context', async () => {
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.33/',
      name: 'Lampa',
      baseUrl: 'http://192.168.0.33/',
      scriptIdInput: '1'
    });
    renderRoutes();
    const card = screen.getByText('Lampa').closest('article');
    expect(card).not.toBeNull();
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', { name: 'Dodaj automatykę' })
    );
    expect(screen.getByRole('button', { name: /Sterować według czasu/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));
    expect(await screen.findByText('mock-setup-time')).toBeVisible();
    expect(screen.getByText('mock-fixed-shelly-http://192.168.0.33/')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
  });

  it('keeps Settings available from per-plug Add automation intent', () => {
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.31/',
      name: 'Wentylator',
      baseUrl: 'http://192.168.0.31/',
      scriptIdInput: '1'
    });
    renderRoutes();
    const card = screen.getByText('Wentylator').closest('article');
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', { name: 'Dodaj automatykę' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }));
    expect(screen.getByRole('heading', { name: 'Ustawienia' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('returns from Android setup through intent and dashboard before exiting', async () => {
    nativeAppMocks.getPlatform.mockReturnValue('android');
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.32/',
      name: 'Grzejnik',
      baseUrl: 'http://192.168.0.32/',
      scriptIdInput: '1'
    });
    const view = renderRoutes();
    await waitFor(() =>
      expect(nativeAppMocks.addListener).toHaveBeenCalledWith(
        'backButton',
        expect.any(Function)
      )
    );

    const card = screen.getByText('Grzejnik').closest('article');
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', { name: 'Dodaj automatykę' })
    );
    fireEvent.click(screen.getByRole('button', { name: /Sterować temperaturą/ }));
    expect(await screen.findByText('mock-setup-temperature')).toBeVisible();

    act(() => nativeAppMocks.fireBack());
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    act(() => nativeAppMocks.fireBack());
    expect(screen.getByRole('main', { name: 'Gniazdka' })).toBeVisible();
    act(() => nativeAppMocks.fireBack());
    await waitFor(() => expect(nativeAppMocks.exitApp).toHaveBeenCalledTimes(1));

    view.unmount();
    await waitFor(() => expect(nativeAppMocks.removeListener).toHaveBeenCalled());
  });

  it('opens an installed system by stable id and returns to its dashboard', () => {
    const installation = addClimateInstallation('detail');
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-dashboard-back' }));
    expect(screen.getByRole('main', { name: 'Gniazdka' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('opens climate edit from detail, hydrates the existing editor draft, and returns to detail', async () => {
    const installation = addClimateInstallation('edit');
    renderRoutes();

    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-edit' }));

    expect(await screen.findByText('mock-setup-temperature')).toBeVisible();
    expect(
      screen.getByText(`mock-fixed-shelly-${installation.shelly.deviceId}`)
    ).toBeVisible();
    expect(screen.getByText(`mock-edit-installation-${installation.id}`)).toBeVisible();

    const draft = useHardwareSetupDraftStore.getState();
    expect(draft.selectedShellyId).toBe(installation.shelly.deviceId);
    expect(draft.selectedSensorId).toBe(installation.config.sensor.runtimeAddress);
    expect(draft.rulePreset).toBe(installation.config.rule.mode);
    expect(draft.onThresholdInput).toBe(
      String(installation.config.rule.control.onThreshold)
    );
    expect(draft.offThresholdInput).toBe(
      String(installation.config.rule.control.offThreshold)
    );

    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-edit' }));
    expect(await screen.findByText('mock-setup-temperature')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();
  });

  it('opens Time edit from detail and returns to the same installed automation', async () => {
    const installation = addTimeInstallation('edit-time');
    renderRoutes();

    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-edit' }));

    expect(await screen.findByText('mock-setup-time')).toBeVisible();
    expect(
      screen.getByText(`mock-fixed-shelly-${installation.shelly.deviceId}`)
    ).toBeVisible();
    expect(screen.getByText(`mock-edit-installation-${installation.id}`)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-edit' }));
    expect(await screen.findByText('mock-setup-time')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();
  });

  it('completes per-plug Time setup back to the Plugs dashboard', async () => {
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.34/',
      name: 'Pompa',
      baseUrl: 'http://192.168.0.34/',
      scriptIdInput: '1'
    });
    renderRoutes();
    const card = screen.getByText('Pompa').closest('article');
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', { name: 'Dodaj automatykę' })
    );
    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));
    expect(await screen.findByText('mock-setup-time')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));
    expect(screen.getByRole('main', { name: 'Gniazdka' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});

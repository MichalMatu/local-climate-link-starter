import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { climate, plug, sensor } from '../flows/registry/fixtures.test-support.js';
import {
  usePlugStore,
  useRuleStore,
  useSensorStore
} from '../flows/registry/devicesAndRules.js';
import type { SetupIntent } from '../flows/setup-intent.js';

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

vi.mock('../screens/rules/RuleDetailScreen.js', () => ({
  RuleDetailScreen: ({
    ruleId,
    onBack,
    onEdit
  }: {
    ruleId: string;
    onBack: () => void;
    onEdit?: () => void;
  }) => (
    <section>
      <p>{`mock-rule-${ruleId}`}</p>
      <button type="button" onClick={onBack}>
        mock-dashboard-back
      </button>
      <button type="button" onClick={onEdit}>
        mock-edit-rule
      </button>
    </section>
  )
}));

vi.mock('../screens/devices/PlugManagementScreen.js', () => ({
  PlugManagementScreen: () => <section>mock-plugs</section>
}));

vi.mock('../screens/devices/SensorManagementScreen.js', () => ({
  SensorManagementScreen: () => <section>mock-sensors</section>
}));

vi.mock('../screens/rules/RuleEditorScreen.js', () => ({
  RuleEditorScreen: ({
    intent,
    ruleId,
    onCancel,
    onComplete
  }: {
    intent?: SetupIntent;
    ruleId?: string;
    onCancel: () => void;
    onComplete: (ruleId: string) => void;
  }) => (
    <section>
      <p>{ruleId ? `mock-edit-${ruleId}` : `mock-setup-${intent ?? 'none'}`}</p>
      <button type="button" onClick={onCancel}>
        mock-back
      </button>
      <button type="button" onClick={() => onComplete(ruleId ?? 'created-rule')}>
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

const addClimateRule = () => {
  usePlugStore.setState({ items: [plug], loadError: null });
  useSensorStore.setState({ items: [sensor], loadError: null });
  useRuleStore.setState({
    items: [{ ...climate, name: 'Salon climate' }],
    loadError: null
  });
  return { ...climate, name: 'Salon climate' };
};

const resetRegistries = () => {
  usePlugStore.setState({ items: [], loadError: null });
  useSensorStore.setState({ items: [], loadError: null });
  useRuleStore.setState({ items: [], loadError: null });
};

describe('AppRoutes navigation shell', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    resetRegistries();
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

  it('uses plugs as the canonical zero-installation root', () => {
    renderRoutes();
    expect(screen.getByText('mock-plugs')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.queryByRole('heading', { name: 'Co chcesz zrobić?' })).toBeNull();
    expect(document.querySelector('.app-settings-trigger')).toBeNull();
  });

  it('routes the four-item bottom navigation through top-level sections', () => {
    renderRoutes();

    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Gniazdka' }));
    expect(screen.getByText('mock-plugs')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    expect(screen.getByText('mock-sensors')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Termometry' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }));
    expect(screen.getByRole('heading', { name: 'Ustawienia' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reguły' }));
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reguły' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('opens Add automation from the temporary Rules entry and does not expose legacy manage choice', () => {
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Reguły' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować temperaturą/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować wilgotnością/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować według czasu/ })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Zarządzać istniejącą automatyką/ })
    ).toBeNull();
    expect(document.querySelector('.app-settings-trigger')).toBeNull();
  });

  it('returns from Android setup through intent and dashboard before exiting', async () => {
    nativeAppMocks.getPlatform.mockReturnValue('android');
    const view = renderRoutes();
    await waitFor(() =>
      expect(nativeAppMocks.addListener).toHaveBeenCalledWith(
        'backButton',
        expect.any(Function)
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reguły' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
    fireEvent.click(screen.getByRole('button', { name: /Sterować temperaturą/ }));
    expect(await screen.findByText('mock-setup-temperature')).toBeVisible();

    act(() => nativeAppMocks.fireBack());
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    act(() => nativeAppMocks.fireBack());
    expect(screen.getByText('mock-plugs')).toBeVisible();
    act(() => nativeAppMocks.fireBack());
    await waitFor(() => expect(nativeAppMocks.exitApp).toHaveBeenCalledTimes(1));

    view.unmount();
    await waitFor(() => expect(nativeAppMocks.removeListener).toHaveBeenCalled());
  });

  it('opens time setup from the shared add flow and returns through intent on Android', async () => {
    nativeAppMocks.getPlatform.mockReturnValue('android');
    renderRoutes();
    await waitFor(() => expect(nativeAppMocks.addListener).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Reguły' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));
    expect(await screen.findByText('mock-setup-time')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toBeVisible();
    act(() => nativeAppMocks.fireBack());
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    act(() => nativeAppMocks.fireBack());
    expect(screen.getByText('mock-plugs')).toBeVisible();
  });

  it('opens a saved rule by stable id and returns to plugs', () => {
    const rule = addClimateRule();
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Reguły' }));
    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon climate' }));
    expect(screen.getByText(`mock-rule-${rule.id}`)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-edit-rule' }));
    expect(screen.getByText(`mock-edit-${rule.id}`)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));
    expect(screen.getByText(`mock-rule-${rule.id}`)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reguły' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    fireEvent.click(screen.getByRole('button', { name: 'mock-dashboard-back' }));
    expect(screen.getByText('mock-plugs')).toBeVisible();
  });
});

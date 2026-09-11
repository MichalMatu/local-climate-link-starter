import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { createInstalledAutomation } from '../flows/installations/model.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';

const runtimeMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  diagnosticsRefetch: vi.fn(),
  controlRefetch: vi.fn()
}));

vi.mock('../flows/installations/useInstalledAutomationRuntime.js', () => ({
  useInstalledAutomationDiagnostics: () => ({
    data: undefined,
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: runtimeMocks.diagnosticsRefetch
  }),
  useInstalledAutomationControl: () => ({
    data: {
      relayOn: false,
      automationMode: 'manual',
      runtimeModeSupported: true,
      automationScriptId: 7,
      firmwareId: '1.0.0',
      telemetry: {},
      clock: { timeSynced: false }
    },
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: runtimeMocks.controlRefetch
  }),
  useInstalledAutomationActions: () => ({
    mutate: runtimeMocks.mutate,
    isPending: false,
    isError: false
  })
}));

import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';

const installation = createInstalledAutomation({
  shelly: { id: 'shelly-controls', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Salon',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: 'hash',
  config: createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2', 'heating'),
  nowMs: 1000
});

describe('AutomationDashboardScreen controls', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    resetInstalledAutomationStore();
    runtimeMocks.mutate.mockReset();
    useInstalledAutomationStore.getState().upsertInstallation(installation);
  });

  afterEach(() => {
    cleanup();
    resetInstalledAutomationStore();
  });

  it('shows verified AUTO/MANUAL and ON/OFF controls and routes safe actions', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AutomationDashboardScreen
            onAddAutomation={vi.fn()}
            onOpenInstallation={vi.fn()}
          />
        </QueryClientProvider>
      </I18nProvider>
    );

    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText('Wymaga uwagi')).toBeNull();
    const manual = screen.getByRole('button', { name: 'MANUAL' });
    const auto = screen.getByRole('button', { name: 'AUTO' });
    const on = screen.getByRole('button', { name: 'ON' });
    const off = screen.getByRole('button', { name: 'OFF' });

    expect(manual).toHaveAttribute('aria-pressed', 'true');
    expect(off).toHaveAttribute('aria-pressed', 'true');
    expect(on).toBeEnabled();

    fireEvent.click(auto);
    expect(runtimeMocks.mutate).toHaveBeenCalledWith('auto');

    fireEvent.click(on);
    expect(runtimeMocks.mutate).toHaveBeenCalledWith('on');
  });
});

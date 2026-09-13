import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { climate, plug, sensor, time } from '../flows/registry/fixtures.test-support.js';
import {
  usePlugStore,
  useRuleStore,
  useSensorStore
} from '../flows/registry/devicesAndRules.js';
import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';

const resetRegistries = () => {
  usePlugStore.setState({ items: [], loadError: null });
  useSensorStore.setState({ items: [], loadError: null });
  useRuleStore.setState({ items: [], loadError: null });
};

const seedDevices = () => {
  usePlugStore.setState({ items: [plug], loadError: null });
  useSensorStore.setState({ items: [sensor], loadError: null });
};

const renderDashboard = (onOpenRule = vi.fn()) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <AutomationDashboardScreen onAddAutomation={vi.fn()} onOpenRule={onOpenRule} />
      </QueryClientProvider>
    </I18nProvider>
  );
};

describe('AutomationDashboardScreen rule registry', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    resetRegistries();
  });
  afterEach(() => {
    cleanup();
    resetRegistries();
  });

  it('uses the rule registry as the canonical empty dashboard', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.getByText('Brak automatyzacji')).toBeVisible();
  });

  it('shows independent rule, plug and sensor names and opens by stable rule id', () => {
    seedDevices();
    useRuleStore.setState({
      items: [
        { ...climate, name: 'Nocne grzanie' },
        { ...time, id: 'time-2', name: 'Światło rano', updatedAtMs: 3 }
      ],
      loadError: null
    });
    const onOpenRule = vi.fn();
    renderDashboard(onOpenRule);

    expect(screen.getByText('Nocne grzanie')).toBeVisible();
    expect(screen.getAllByText(plug.name).length).toBeGreaterThan(0);
    expect(screen.getByText(sensor.name)).toBeVisible();
    expect(screen.getByText('Światło rano')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Nocne grzanie' }));
    expect(onOpenRule).toHaveBeenCalledWith(climate.id);
  });
});

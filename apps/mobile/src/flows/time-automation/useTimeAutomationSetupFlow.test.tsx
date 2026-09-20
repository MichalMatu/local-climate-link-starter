import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createTimeInstalledAutomation,
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../../features/automations/index.js';
import { useTimeAutomationSetupFlow } from './useTimeAutomationSetupFlow.js';

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('useTimeAutomationSetupFlow edit state', () => {
  afterEach(() => resetInstalledAutomationStore());

  it('prefills the existing installed Time configuration in edit mode', () => {
    const installation = createTimeInstalledAutomation({
      shelly: { id: 'shelly-time-edit', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Lampa',
      baseUrl: 'http://192.168.0.24/',
      onJobId: 7,
      offJobId: 8,
      config: { relayId: 0, onTime: '06:15', offTime: '22:45' },
      nowMs: 1000
    });
    useInstalledAutomationStore.getState().upsertInstallation(installation);

    const { result } = renderHook(
      () =>
        useTimeAutomationSetupFlow(
          {
            id: installation.shelly.deviceId,
            name: installation.shelly.name,
            baseUrl: installation.shelly.baseUrl,
            scriptIdInput: '1'
          },
          installation.id
        ),
      { wrapper }
    );

    expect(result.current.isEditingTimeAutomation).toBe(true);
    expect(result.current.onTime).toBe('06:15');
    expect(result.current.offTime).toBe('22:45');
    expect(result.current.configState).toMatchObject({
      ok: true,
      config: { relayId: 0, onTime: '06:15', offTime: '22:45' }
    });
  });

  it('keeps the install defaults outside edit mode', () => {
    const { result } = renderHook(
      () =>
        useTimeAutomationSetupFlow({
          id: 'shelly-new',
          name: 'Nowe gniazdko',
          baseUrl: 'http://192.168.0.25/',
          scriptIdInput: '1'
        }),
      { wrapper }
    );

    expect(result.current.isEditingTimeAutomation).toBe(false);
    expect(result.current.onTime).toBe('08:00');
    expect(result.current.offTime).toBe('20:00');
  });
});

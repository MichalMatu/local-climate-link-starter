import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as ShellyRequestsModule from './shellyRequests.js';

const prepareShellyBleDiscoveryMock = vi.hoisted(() => vi.fn());
const installShellyBleDiscoveryScriptMock = vi.hoisted(() => vi.fn());
const readShellyBleDiscoverySnapshotMock = vi.hoisted(() => vi.fn());
const restartShellyBleDiscoveryScanMock = vi.hoisted(() => vi.fn());
const stopShellyBleDiscoveryMock = vi.hoisted(() => vi.fn());

vi.mock('./shellyRequests.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyRequestsModule>();
  return {
    ...actual,
    prepareShellyBleDiscovery: prepareShellyBleDiscoveryMock,
    installShellyBleDiscoveryScript: installShellyBleDiscoveryScriptMock,
    readShellyBleDiscoverySnapshot: readShellyBleDiscoverySnapshotMock,
    restartShellyBleDiscoveryScan: restartShellyBleDiscoveryScanMock,
    stopShellyBleDiscovery: stopShellyBleDiscoveryMock
  };
});

import { useShellyBleDiscoveryFlow } from './useShellyBleDiscoveryFlow.js';

const device = {
  id: 'shelly-late-discovery',
  name: 'Late discovery Plug',
  baseUrl: 'http://192.168.0.10/',
  scriptIdInput: '1'
};

const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('useShellyBleDiscoveryFlow lifecycle', () => {
  it('does not dispatch React state when a pending discovery start rejects after unmount', async () => {
    const queryClient = createQueryClient();
    let rejectPreparation: ((reason?: unknown) => void) | undefined;
    prepareShellyBleDiscoveryMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectPreparation = reject;
        })
    );

    const { result, unmount } = renderHook(() => useShellyBleDiscoveryFlow(), {
      wrapper: createWrapper(queryClient)
    });
    let pendingStart!: Promise<unknown>;

    act(() => {
      pendingStart = result.current.startBleDiscoveryMutation.mutateAsync(device);
    });
    await waitFor(() => expect(prepareShellyBleDiscoveryMock).toHaveBeenCalledOnce());

    unmount();
    vi.stubGlobal('window', undefined);
    rejectPreparation?.(new Error('late discovery start failure'));

    try {
      await expect(pendingStart).rejects.toThrow('late discovery start failure');
    } finally {
      vi.unstubAllGlobals();
      queryClient.clear();
    }
  });

  it('still stops a remotely started discovery session when cleanup was requested before a late success', async () => {
    const queryClient = createQueryClient();
    let resolveSnapshot: ((snapshot: unknown) => void) | undefined;
    prepareShellyBleDiscoveryMock.mockResolvedValueOnce({
      automationScriptId: 4,
      automationWasRunning: true
    });
    installShellyBleDiscoveryScriptMock.mockResolvedValueOnce({ scriptId: 7 });
    readShellyBleDiscoverySnapshotMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSnapshot = resolve;
        })
    );
    stopShellyBleDiscoveryMock.mockResolvedValueOnce(undefined);

    const { result, unmount } = renderHook(() => useShellyBleDiscoveryFlow(), {
      wrapper: createWrapper(queryClient)
    });

    act(() => result.current.startBleDiscovery(device));
    await waitFor(() =>
      expect(readShellyBleDiscoverySnapshotMock).toHaveBeenCalledOnce()
    );

    const cleanupBleDiscovery = result.current.cleanupBleDiscovery;
    unmount();
    cleanupBleDiscovery();
    resolveSnapshot?.({ devices: [] });

    await waitFor(() =>
      expect(stopShellyBleDiscoveryMock).toHaveBeenCalledWith(device.baseUrl, {
        discoveryScriptId: 7,
        automationScriptId: 4,
        restartAutomation: true
      })
    );
    queryClient.clear();
  });
});

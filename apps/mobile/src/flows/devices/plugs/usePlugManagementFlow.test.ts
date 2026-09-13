import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlugStore, useRuleStore } from '../../registry/devicesAndRules.js';
import { plug } from '../../registry/fixtures.test-support.js';
import { createPlugRuntimeFixture } from './runtime.test-support.js';
import { createPlugRuntimeClients } from './runtimeClient.js';
import { usePlugManagementFlow } from './usePlugManagementFlow.js';

vi.mock('./runtimeClient.js', () => ({ createPlugRuntimeClients: vi.fn() }));

const queryClients: QueryClient[] = [];
const renderFlow = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  queryClients.push(client);
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
  return { ...renderHook(usePlugManagementFlow, { wrapper }), client };
};

beforeEach(() => {
  localStorage.clear();
  usePlugStore.setState({ items: [plug], loadError: null });
  useRuleStore.setState({ items: [], loadError: null });
  vi.mocked(createPlugRuntimeClients).mockReturnValue(createPlugRuntimeFixture().clients);
});
afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((client) => client.clear());
  vi.clearAllMocks();
  usePlugStore.setState({ items: [], loadError: null });
  useRuleStore.setState({ items: [], loadError: null });
});

describe('standalone plug management flow', () => {
  it('reads no device until selected, then refreshes verified relay state after ON/OFF', async () => {
    const { result } = renderFlow();
    expect(createPlugRuntimeClients).not.toHaveBeenCalled();
    act(() => result.current.selectPlug(plug.id));
    await waitFor(() => expect(result.current.canControlRelay).toBe(true));
    await act(async () => {
      await result.current.relay.mutateAsync({ id: plug.id, on: true });
    });
    await waitFor(() => expect(result.current.snapshot?.relayOn).toBe(true));
    await act(async () => {
      await result.current.relay.mutateAsync({ id: plug.id, on: false });
    });
    await waitFor(() => expect(result.current.snapshot?.relayOn).toBe(false));
  });

  it('never exposes a cached relay snapshot as controllable after registry load failure', async () => {
    const { result } = renderFlow();
    act(() => result.current.selectPlug(plug.id));
    await waitFor(() => expect(result.current.canControlRelay).toBe(true));
    act(() => useRuleStore.setState({ loadError: { kind: 'storage-invalid' } }));
    expect(result.current.canControlRelay).toBe(false);
    expect(result.current.loadError).toEqual({ kind: 'storage-invalid' });
  });

  it('separates endpoint cache entries and fails closed on a failed new endpoint', async () => {
    const { result } = renderFlow();
    act(() => result.current.selectPlug(plug.id));
    await waitFor(() => expect(result.current.canControlRelay).toBe(true));
    vi.mocked(createPlugRuntimeClients).mockImplementation(() => {
      throw new Error('Offline');
    });
    act(() =>
      usePlugStore.getState().upsert({ ...plug, baseUrl: 'http://192.168.1.88' })
    );
    await waitFor(() => expect(result.current.runtime.isError).toBe(true));
    expect(result.current.snapshot).toBe(null);
    expect(result.current.canControlRelay).toBe(false);
  });

  it('removes cached runtime state and selection after removing an unreferenced plug', async () => {
    const { result, client } = renderFlow();
    act(() => result.current.selectPlug(plug.id));
    await waitFor(() => expect(result.current.canControlRelay).toBe(true));
    await act(async () => {
      await result.current.removal.mutateAsync(plug.id);
    });
    expect(result.current.selectedPlug).toBe(null);
    expect(client.getQueriesData({ queryKey: ['plug-runtime', plug.id] })).toEqual([]);
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type * as ShellyRequestsModule from './shellyRequests.js';

const readShellySetupScanResultMock = vi.hoisted(() => vi.fn());

vi.mock('./shellyRequests.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShellyRequestsModule>();
  return { ...actual, readShellySetupScanResult: readShellySetupScanResultMock };
});
import { buildShellyScanUrls, useShellySetupScanFlow } from './useShellySetupScanFlow.js';

describe('Shelly setup scan derivation', () => {
  it('preserves every address in the requested IPv4 range', () => {
    expect(buildShellyScanUrls('192.168.0.1', '192.168.0.3')).toEqual([
      'http://192.168.0.1/',
      'http://192.168.0.2/',
      'http://192.168.0.3/'
    ]);
  });

  it('defaults STA discovery to the full common 192.168.0.x host range', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useShellySetupScanFlow(), { wrapper });

    expect(result.current.shellyScanStartInput).toBe('192.168.0.1');
    expect(result.current.shellyScanEndInput).toBe('192.168.0.254');
    queryClient.clear();
  });

  it('publishes a found Shelly before the full range scan completes', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const found = {
      baseUrl: 'http://192.168.0.10/',
      deviceInfo: { id: 'shelly-test', model: 'S3PL-00112EU', gen: 3 }
    };
    let finishScan: (() => void) | undefined;
    const keepScanning = new Promise<void>((resolve) => {
      finishScan = resolve;
    });
    readShellySetupScanResultMock.mockImplementation(async (baseUrl: string) => {
      if (baseUrl === found.baseUrl) return found;
      await keepScanning;
      throw new Error('not a Shelly device');
    });

    const { result } = renderHook(() => useShellySetupScanFlow(), { wrapper });
    act(() => {
      result.current.setShellyScanStartInput('192.168.0.10');
      result.current.setShellyScanEndInput('192.168.0.11');
    });
    act(() => result.current.startShellyScan());

    await waitFor(() => expect(result.current.shellyScanResults).toEqual([found]));
    expect(result.current.shellyScanMutation.isPending).toBe(true);

    await act(async () => finishScan?.());
    await waitFor(() => expect(result.current.shellyScanMutation.isSuccess).toBe(true));
    queryClient.clear();
  });

  it('allows an incomplete scan address while the user is editing without crashing render', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useShellySetupScanFlow(), { wrapper });

    act(() => {
      result.current.setShellyScanStartInput('192.168.0.');
    });

    expect(result.current.shellyScanStartInput).toBe('192.168.0.');
    queryClient.clear();
  });
});

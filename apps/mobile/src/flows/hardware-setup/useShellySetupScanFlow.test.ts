import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
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

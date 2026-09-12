import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import {
  buildUnsavedShellyScanUrls,
  useShellySetupScanFlow
} from './useShellySetupScanFlow.js';

const device = (id: string, baseUrl: string) => ({
  id,
  name: id,
  baseUrl,
  scriptIdInput: '1'
});

describe('Shelly setup scan derivation', () => {
  it('excludes already saved devices from the requested IPv4 range', () => {
    expect(
      buildUnsavedShellyScanUrls(
        [device('saved', '192.168.0.2')],
        '192.168.0.1',
        '192.168.0.3'
      )
    ).toEqual(['http://192.168.0.1/', 'http://192.168.0.3/']);
  });

  it('preserves the full range when saved entries are outside it', () => {
    expect(
      buildUnsavedShellyScanUrls(
        [device('other', 'http://192.168.1.2/')],
        '192.168.0.1',
        '192.168.0.2'
      )
    ).toEqual(['http://192.168.0.1/', 'http://192.168.0.2/']);
  });

  it('allows an incomplete scan address while the user is editing without crashing render', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useShellySetupScanFlow([]), { wrapper });

    act(() => {
      result.current.setShellyScanStartInput('192.168.0.');
    });

    expect(result.current.shellyScanStartInput).toBe('192.168.0.');
    queryClient.clear();
  });
});

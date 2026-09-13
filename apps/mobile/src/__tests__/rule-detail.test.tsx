import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { climate, plug, sensor, time } from '../flows/registry/fixtures.test-support.js';
import { useSensorStore } from '../flows/registry/devicesAndRules.js';

const runtimeMock = vi.hoisted(() => ({
  rule: null as unknown,
  plug: null as unknown,
  data: null as unknown,
  isFetching: false,
  isError: false,
  isPending: false,
  actionError: false,
  mutate: vi.fn(),
  refetch: vi.fn(async () => undefined)
}));

vi.mock('../flows/rules/useRuleRuntime.js', () => ({
  useRuleRuntime: () => ({
    rule: runtimeMock.rule,
    plug: runtimeMock.plug,
    runtime: {
      data: runtimeMock.data,
      isFetching: runtimeMock.isFetching,
      isError: runtimeMock.isError,
      refetch: runtimeMock.refetch
    },
    action: {
      isPending: runtimeMock.isPending,
      isError: runtimeMock.actionError,
      mutate: runtimeMock.mutate
    }
  })
}));

import { RuleDetailScreen } from '../screens/rules/RuleDetailScreen.js';

const renderDetail = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <RuleDetailScreen ruleId="rule" onBack={vi.fn()} />
      </QueryClientProvider>
    </I18nProvider>
  );
};

describe('RuleDetailScreen', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    useSensorStore.setState({ items: [sensor], loadError: null });
    runtimeMock.mutate.mockReset();
    runtimeMock.refetch.mockClear();
    runtimeMock.plug = plug;
    runtimeMock.isFetching = false;
    runtimeMock.isError = false;
    runtimeMock.isPending = false;
    runtimeMock.actionError = false;
  });
  afterEach(cleanup);

  it('routes verified climate AUTO, MANUAL and relay actions through the rule lifecycle', () => {
    runtimeMock.rule = {
      ...climate,
      deployment: {
        scriptId: 7,
        scriptHash: 'hash',
        safetyTest: { status: 'verified', verifiedAtMs: 10 }
      }
    };
    runtimeMock.data = {
      relayOn: false,
      mode: 'manual',
      modeSupported: true,
      scriptMatch: 'matched',
      scriptId: 7,
      telemetry: null,
      clock: null
    };
    renderDetail();
    expect(screen.getByRole('heading', { name: climate.name })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'AUTO' }));
    expect(runtimeMock.mutate).toHaveBeenCalledWith('resume', expect.any(Object));
    fireEvent.click(screen.getByRole('button', { name: 'ON' }));
    expect(runtimeMock.mutate).toHaveBeenCalledWith('relay-on', expect.any(Object));
  });

  it('requires the climate safety test before exposing runtime mode controls', () => {
    runtimeMock.rule = {
      ...climate,
      deployment: {
        scriptId: 7,
        scriptHash: 'hash',
        safetyTest: { status: 'pending' }
      }
    };
    runtimeMock.data = undefined;
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Przetestuj' }));
    expect(runtimeMock.mutate).toHaveBeenCalledWith('verify', expect.any(Object));
    expect(screen.queryByRole('button', { name: 'AUTO' })).toBeNull();
  });

  it('resumes a paused native time rule', () => {
    runtimeMock.rule = {
      ...time,
      deployment: { pairs: [{ windowIndex: 0, onJobId: 10, offJobId: 11 }] }
    };
    runtimeMock.data = {
      relayOn: false,
      clock: null,
      scheduleState: 'paused'
    };
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Wznów automatykę' }));
    expect(runtimeMock.mutate).toHaveBeenCalledWith('resume', expect.any(Object));
  });
});

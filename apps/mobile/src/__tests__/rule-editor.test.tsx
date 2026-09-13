import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { climate, plug, sensor } from '../flows/registry/fixtures.test-support.js';
import {
  usePlugStore,
  useRuleStore,
  useSensorStore
} from '../flows/registry/devicesAndRules.js';
import type { AutomationRule } from '../flows/rules/model.js';
import type * as RuleLifecycle from '../flows/rules/lifecycle.js';

const lifecycleMocks = vi.hoisted(() => ({
  saveRuleDraft: vi.fn(),
  deployRule: vi.fn(),
  redeployRule: vi.fn()
}));

vi.mock('../flows/rules/lifecycle.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RuleLifecycle>();
  return {
    ...actual,
    saveRuleDraft: lifecycleMocks.saveRuleDraft,
    deployRule: lifecycleMocks.deployRule,
    redeployRule: lifecycleMocks.redeployRule
  };
});

import { RuleEditorScreen } from '../screens/rules/RuleEditorScreen.js';

const renderEditor = (props: {
  intent?: 'temperature' | 'humidity' | 'time';
  ruleId?: string;
}) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } }
  });
  const onComplete = vi.fn();
  render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <RuleEditorScreen {...props} onCancel={vi.fn()} onComplete={onComplete} />
      </QueryClientProvider>
    </I18nProvider>
  );
  return { onComplete };
};

const resetStores = () => {
  usePlugStore.setState({ items: [], loadError: null });
  useSensorStore.setState({ items: [], loadError: null });
  useRuleStore.setState({ items: [], loadError: null });
};

describe('RuleEditorScreen', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    resetStores();
    lifecycleMocks.saveRuleDraft.mockReset();
    lifecycleMocks.deployRule.mockReset();
    lifecycleMocks.redeployRule.mockReset();
    lifecycleMocks.saveRuleDraft.mockImplementation((rule: AutomationRule) => rule);
    lifecycleMocks.deployRule.mockImplementation(async (id: string) =>
      useRuleStore.getState().items.find((rule) => rule.id === id)
    );
    lifecycleMocks.redeployRule.mockImplementation(async (rule: AutomationRule) => rule);
  });

  it('creates and deploys a climate rule using saved plug and thermometer registries', async () => {
    usePlugStore.setState({ items: [plug], loadError: null });
    useSensorStore.setState({ items: [sensor], loadError: null });
    lifecycleMocks.saveRuleDraft.mockImplementation((rule: AutomationRule) => {
      useRuleStore.setState({ items: [rule], loadError: null });
      return rule;
    });
    const { onComplete } = renderEditor({ intent: 'temperature' });
    fireEvent.change(screen.getByRole('textbox', { name: /Nazwa/ }), {
      target: { value: 'Grzanie szklarni' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }));
    await waitFor(() => expect(lifecycleMocks.saveRuleDraft).toHaveBeenCalledTimes(1));
    const desired = lifecycleMocks.saveRuleDraft.mock.calls[0]?.[0] as AutomationRule;
    expect(desired).toMatchObject({
      kind: 'climate',
      name: 'Grzanie szklarni',
      plugId: plug.id,
      sensorId: sensor.id
    });
    expect(lifecycleMocks.deployRule).toHaveBeenCalledWith(desired.id);
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(desired.id));
  });

  it('creates a time rule without requiring a thermometer', async () => {
    usePlugStore.setState({ items: [plug], loadError: null });
    lifecycleMocks.saveRuleDraft.mockImplementation((rule: AutomationRule) => {
      useRuleStore.setState({ items: [rule], loadError: null });
      return rule;
    });
    renderEditor({ intent: 'time' });
    fireEvent.change(screen.getByRole('textbox', { name: /Nazwa/ }), {
      target: { value: 'Lampy' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz harmonogram w Shelly' }));
    await waitFor(() => expect(lifecycleMocks.deployRule).toHaveBeenCalledTimes(1));
    const desired = lifecycleMocks.saveRuleDraft.mock.calls[0]?.[0] as AutomationRule;
    expect(desired.kind).toBe('time');
  });

  it('redeploys an existing deployed rule instead of creating a second rule', async () => {
    const deployed = {
      ...climate,
      deployment: {
        scriptId: 7,
        scriptHash: 'hash',
        safetyTest: { status: 'verified' as const, verifiedAtMs: 4 }
      }
    };
    usePlugStore.setState({ items: [plug], loadError: null });
    useSensorStore.setState({ items: [sensor], loadError: null });
    useRuleStore.setState({ items: [deployed], loadError: null });
    renderEditor({ ruleId: deployed.id });
    fireEvent.change(screen.getByRole('textbox', { name: /Nazwa/ }), {
      target: { value: 'Nowa nazwa' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));
    await waitFor(() => expect(lifecycleMocks.redeployRule).toHaveBeenCalledTimes(1));
    expect(lifecycleMocks.saveRuleDraft).not.toHaveBeenCalled();
    expect(lifecycleMocks.deployRule).not.toHaveBeenCalled();
    expect(lifecycleMocks.redeployRule.mock.calls[0]?.[0]).toMatchObject({
      id: deployed.id,
      name: 'Nowa nazwa',
      deployment: null
    });
  });
});

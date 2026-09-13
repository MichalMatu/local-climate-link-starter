import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IconPlus, IconTemperature } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from '../app/i18n.js';
import {
  usePlugStore,
  useRuleStore,
  useSensorStore
} from '../flows/registry/devicesAndRules.js';
import { RuleCard } from './rules/RuleCard.js';
import './AutomationDashboardScreen.css';

const isRuleRuntimeQuery = (query: { queryKey: readonly unknown[] }) =>
  query.queryKey[0] === 'rule-runtime';

type AutomationDashboardScreenProps = {
  onAddAutomation(): void;
  onOpenRule(ruleId: string): void;
};

export const AutomationDashboardScreen = ({
  onAddAutomation,
  onOpenRule
}: AutomationDashboardScreenProps) => {
  const { t } = useTranslation();
  const rules = useRuleStore((state) => state.items);
  const plugs = usePlugStore((state) => state.items);
  const sensors = useSensorStore((state) => state.items);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;
    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void queryClient.refetchQueries({ predicate: isRuleRuntimeQuery });
    }).then((handle) => {
      if (!active) void handle.remove();
      else removeListener = () => handle.remove();
    });
    return () => {
      active = false;
      if (removeListener) void removeListener();
    };
  }, [queryClient]);

  return (
    <main className="demo-shell dashboard-shell app-bottom-nav-shell">
      <header className="demo-header dashboard-header app-page-header">
        <h1>{t('dashboard.title')}</h1>
      </header>
      <section className="dashboard-grid" aria-label={t('dashboard.systemsLabel')}>
        {rules.length ? (
          rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              plugName={
                plugs.find((plug) => plug.id === rule.plugId)?.name ?? t('common.missing')
              }
              sensorName={
                rule.kind === 'climate'
                  ? (sensors.find((sensor) => sensor.id === rule.sensorId)?.name ?? null)
                  : null
              }
              onOpen={onOpenRule}
            />
          ))
        ) : (
          <div className="dashboard-kind-empty">
            <IconTemperature className="dashboard-kind-empty__icon" aria-hidden="true" />
            <strong>{t('dashboard.emptyCategory')}</strong>
          </div>
        )}
      </section>
      <button
        className="dashboard-fab"
        type="button"
        aria-label={t('dashboard.addAutomation')}
        title={t('dashboard.addAutomation')}
        onClick={onAddAutomation}
      >
        <IconPlus className="dashboard-fab__icon" aria-hidden="true" />
      </button>
    </main>
  );
};

#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=259b82bf55af63d191c0e693c0633a8517c02b84
cd "$REPO"
git fetch origin "$BRANCH" agent-control
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }
git checkout "$BRANCH"
git reset --hard "$REMOTE"
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

mkdir -p apps/mobile/src/screens/rules

cat > apps/mobile/src/screens/rules/rulePresentation.ts <<'EOF'
import type { AutomationRule, RuleSchedule } from '../../flows/rules/model.js';

export const ruleContextKey = (rule: AutomationRule) => {
  if (rule.kind === 'time') return 'intent.time.context' as const;
  return rule.config.rule.control.metric === 'humidity'
    ? ('intent.humidity.context' as const)
    : ('intent.temperature.context' as const);
};

export const ruleThresholdSummary = (rule: AutomationRule): string | null => {
  if (rule.kind !== 'climate') return null;
  const unit = rule.config.rule.control.metric === 'humidity' ? '%' : '°C';
  const { onThreshold, offThreshold } = rule.config.rule.control;
  return `${onThreshold}${unit} / ${offThreshold}${unit}`;
};

export const ruleScheduleSummary = (schedule: RuleSchedule | null): string | null => {
  if (!schedule) return null;
  return schedule.windows.map((window) => `${window.start}–${window.end}`).join(', ');
};
EOF

cat > apps/mobile/src/screens/rules/RuleCard.tsx <<'EOF'
import { IconAlertTriangle, IconClock, IconDotsVertical, IconTemperature } from '@tabler/icons-react';
import { useTranslation } from '../../app/i18n.js';
import type { AutomationRule } from '../../flows/rules/model.js';
import { useRuleRuntime } from '../../flows/rules/useRuleRuntime.js';
import { ruleContextKey, ruleScheduleSummary, ruleThresholdSummary } from './rulePresentation.js';

type RuleCardProps = {
  rule: AutomationRule;
  plugName: string;
  sensorName: string | null;
  onOpen(ruleId: string): void;
};

type RuleCardStatus = {
  label: string;
  tone: 'ok' | 'paused' | 'attention' | 'offline' | 'unknown' | 'loading';
};

export const RuleCard = ({ rule, plugName, sensorName, onOpen }: RuleCardProps) => {
  const { t } = useTranslation();
  const { runtime, action } = useRuleRuntime(rule.id);
  const snapshot = runtime.data;

  const status = (() => {
    if (!rule.deployment) {
      return { label: t('common.missing'), tone: 'unknown' } satisfies RuleCardStatus;
    }
    if (runtime.isFetching && !snapshot) {
      return { label: t('dashboard.health.loading'), tone: 'loading' } satisfies RuleCardStatus;
    }
    if (runtime.isError) {
      return { label: t('dashboard.health.offline'), tone: 'offline' } satisfies RuleCardStatus;
    }
    if (!snapshot) {
      return { label: t('dashboard.health.unknown'), tone: 'unknown' } satisfies RuleCardStatus;
    }
    if ('mode' in snapshot) {
      if (
        rule.kind !== 'climate' ||
        rule.deployment.safetyTest.status !== 'verified' ||
        snapshot.scriptMatch !== 'matched' ||
        !snapshot.modeSupported
      ) {
        return {
          label: t('dashboard.health.attention'),
          tone: 'attention'
        } satisfies RuleCardStatus;
      }
      return snapshot.mode === 'manual'
        ? ({ label: t('dashboard.health.paused'), tone: 'paused' } satisfies RuleCardStatus)
        : ({ label: t('dashboard.health.ok'), tone: 'ok' } satisfies RuleCardStatus);
    }
    switch (snapshot.scheduleState) {
      case 'running':
        return { label: t('dashboard.health.ok'), tone: 'ok' } satisfies RuleCardStatus;
      case 'paused':
        return {
          label: t('dashboard.health.paused'),
          tone: 'paused'
        } satisfies RuleCardStatus;
      case 'attention':
        return {
          label: t('dashboard.health.attention'),
          tone: 'attention'
        } satisfies RuleCardStatus;
      case 'undeployed':
        return { label: t('common.missing'), tone: 'unknown' } satisfies RuleCardStatus;
    }
  })();

  const detail =
    rule.kind === 'climate'
      ? (sensorName ?? t('common.missing'))
      : (ruleScheduleSummary(rule.config.schedule) ?? t('common.missing'));
  const threshold = ruleThresholdSummary(rule);
  const active =
    snapshot &&
    (('mode' in snapshot && snapshot.mode === 'auto') ||
      ('scheduleState' in snapshot && snapshot.scheduleState === 'running'));

  return (
    <article className="automation-card rule-card">
      <header className="automation-card__header">
        <span
          className={`automation-card__leading-icon${active ? ' automation-card__leading-icon--active' : ''}`}
          aria-hidden="true"
        >
          {rule.kind === 'time' ? (
            <IconClock className="automation-card__icon" />
          ) : (
            <IconTemperature className="automation-card__icon" />
          )}
        </span>
        <div className="automation-card__identity">
          <h2>{rule.name}</h2>
          <p>{t(ruleContextKey(rule))}</p>
        </div>
        <button
          className="automation-card__menu"
          type="button"
          aria-label={`${t('dashboard.openSystem')}: ${rule.name}`}
          title={t('dashboard.openSystem')}
          onClick={() => onOpen(rule.id)}
        >
          <IconDotsVertical className="automation-card__menu-icon" />
        </button>
      </header>

      <dl className="rule-card__summary">
        <div>
          <dt>{t('time.device')}</dt>
          <dd>{plugName}</dd>
        </div>
        <div>
          <dt>{rule.kind === 'climate' ? t('dashboard.sensor') : t('time.scheduleSummary')}</dt>
          <dd>{detail}</dd>
        </div>
        {threshold && (
          <div>
            <dt>{t('dashboard.thresholds')}</dt>
            <dd>{threshold}</dd>
          </div>
        )}
      </dl>

      <footer className="automation-card__footer">
        <div className={`automation-card__status automation-card__status--${status.tone}`}>
          {(status.tone === 'attention' || status.tone === 'offline') && (
            <IconAlertTriangle aria-hidden="true" />
          )}
          <span>{action.isPending ? t('detail.changingState') : status.label}</span>
        </div>
      </footer>
    </article>
  );
};
EOF

cat > apps/mobile/src/screens/rules/RuleRuntimeControls.tsx <<'EOF'
import { useTranslation } from '../../app/i18n.js';
import type { AutomationRule } from '../../flows/rules/model.js';
import type { RuleRuntimeSnapshot } from '../../flows/rules/lifecycle.js';
import type { RuleAction } from '../../flows/rules/useRuleRuntime.js';

type RuleRuntimeControlsProps = {
  rule: AutomationRule;
  snapshot: RuleRuntimeSnapshot | undefined;
  busy: boolean;
  onAction(action: RuleAction): void;
  onRefresh(): void;
};

export const RuleRuntimeControls = ({
  rule,
  snapshot,
  busy,
  onAction,
  onRefresh
}: RuleRuntimeControlsProps) => {
  const { t } = useTranslation();

  if (!rule.deployment) {
    return (
      <button className="primary-action" type="button" disabled={busy} onClick={() => onAction('deploy')}>
        {t('common.send')}
      </button>
    );
  }

  if (rule.kind === 'climate') {
    if (rule.deployment.safetyTest.status !== 'verified') {
      return (
        <button className="primary-action" type="button" disabled={busy} onClick={() => onAction('verify')}>
          {busy ? t('common.testing') : t('common.test')}
        </button>
      );
    }
    if (!snapshot || !('mode' in snapshot)) {
      return (
        <button className="secondary-action" type="button" disabled={busy} onClick={onRefresh}>
          {t('common.refresh')}
        </button>
      );
    }
    const exact = snapshot.scriptMatch === 'matched' && snapshot.modeSupported;
    return (
      <>
        <div className="automation-control-group" role="group" aria-label={t('detail.automation')}>
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={exact && snapshot.mode === 'auto'}
            disabled={busy || !exact || snapshot.mode !== 'manual'}
            onClick={() => onAction('resume')}
          >
            AUTO
          </button>
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={exact && snapshot.mode === 'manual'}
            disabled={busy || !exact || snapshot.mode !== 'auto'}
            onClick={() => onAction('pause')}
          >
            MANUAL
          </button>
        </div>
        <div className="automation-relay-actions" role="group" aria-label={t('dashboard.output')}>
          <button
            className="automation-relay-button"
            type="button"
            aria-pressed={snapshot.relayOn}
            disabled={busy || !exact || snapshot.mode !== 'manual'}
            onClick={() => onAction('relay-on')}
          >
            ON
          </button>
          <button
            className="automation-relay-button"
            type="button"
            aria-pressed={!snapshot.relayOn}
            disabled={busy || !exact || snapshot.mode !== 'manual'}
            onClick={() => onAction('relay-off')}
          >
            OFF
          </button>
        </div>
      </>
    );
  }

  if (!snapshot || !('scheduleState' in snapshot)) {
    return (
      <button className="secondary-action" type="button" disabled={busy} onClick={onRefresh}>
        {t('common.refresh')}
      </button>
    );
  }
  if (snapshot.scheduleState === 'attention' || snapshot.scheduleState === 'undeployed') {
    return (
      <button className="primary-action" type="button" disabled={busy} onClick={() => onAction('recover')}>
        {t('common.refresh')}
      </button>
    );
  }
  return snapshot.scheduleState === 'running' ? (
    <button className="secondary-action" type="button" disabled={busy} onClick={() => onAction('pause')}>
      {t('detail.pause')}
    </button>
  ) : (
    <button className="primary-action" type="button" disabled={busy} onClick={() => onAction('resume')}>
      {t('detail.resume')}
    </button>
  );
};
EOF

cat > apps/mobile/src/screens/rules/RuleDetailScreen.tsx <<'EOF'
import { Modal } from '@lcl/ui';
import { useState } from 'react';
import { useTranslation } from '../../app/i18n.js';
import { useSensorStore } from '../../flows/registry/devicesAndRules.js';
import { useRuleRuntime, type RuleAction } from '../../flows/rules/useRuleRuntime.js';
import { RuleRuntimeControls } from './RuleRuntimeControls.js';
import { ruleContextKey, ruleScheduleSummary, ruleThresholdSummary } from './rulePresentation.js';
import './RuleDetailScreen.css';

type RuleDetailScreenProps = {
  ruleId: string;
  onBack(): void;
};

export const RuleDetailScreen = ({ ruleId, onBack }: RuleDetailScreenProps) => {
  const { t } = useTranslation();
  const { rule, plug, runtime, action } = useRuleRuntime(ruleId);
  const sensor = useSensorStore((state) =>
    rule?.kind === 'climate'
      ? state.items.find((candidate) => candidate.id === rule.sensorId)
      : undefined
  );
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!rule || !plug) {
    return (
      <main className="demo-shell rule-detail-shell app-bottom-nav-shell">
        <header className="demo-header app-page-header">
          <h1>{t('detail.notFoundTitle')}</h1>
        </header>
        <button className="secondary-action" type="button" onClick={onBack}>
          {t('detail.backToDashboard')}
        </button>
      </main>
    );
  }

  const snapshot = runtime.data;
  const threshold = ruleThresholdSummary(rule);
  const schedule = ruleScheduleSummary(
    rule.kind === 'climate' ? rule.schedule : rule.config.schedule
  );
  const runtimeLabel = (() => {
    if (!rule.deployment) return t('common.missing');
    if (runtime.isFetching && !snapshot) return t('dashboard.health.loading');
    if (runtime.isError) return t('dashboard.health.offline');
    if (!snapshot) return t('dashboard.health.unknown');
    if ('mode' in snapshot) {
      if (snapshot.scriptMatch !== 'matched' || !snapshot.modeSupported) {
        return t('dashboard.health.attention');
      }
      return snapshot.mode === 'auto' ? 'AUTO' : snapshot.mode === 'manual' ? 'MANUAL' : t('common.unknown');
    }
    return snapshot.scheduleState === 'running'
      ? t('dashboard.health.ok')
      : snapshot.scheduleState === 'paused'
        ? t('dashboard.health.paused')
        : t('dashboard.health.attention');
  })();

  const handleAction = (kind: RuleAction) => {
    action.mutate(kind, {
      onSuccess: () => {
        if (kind === 'delete') onBack();
      }
    });
  };

  return (
    <main className="demo-shell rule-detail-shell app-bottom-nav-shell">
      <header className="demo-header app-page-header rule-detail-header">
        <div>
          <h1>{rule.name}</h1>
          <p>{t(ruleContextKey(rule))}</p>
        </div>
      </header>

      <section className="rule-detail-grid" aria-label={t('detail.currentState')}>
        <article className="automation-card rule-detail-card">
          <h2>{t('detail.currentState')}</h2>
          <dl className="rule-detail-summary">
            <div>
              <dt>{t('time.device')}</dt>
              <dd>{plug.name}</dd>
            </div>
            {rule.kind === 'climate' && (
              <div>
                <dt>{t('dashboard.sensor')}</dt>
                <dd>{sensor?.name ?? t('common.missing')}</dd>
              </div>
            )}
            <div>
              <dt>{t('detail.automation')}</dt>
              <dd>{runtimeLabel}</dd>
            </div>
            {snapshot && 'relayOn' in snapshot && (
              <div>
                <dt>{t('dashboard.output')}</dt>
                <dd>{snapshot.relayOn ? 'ON' : 'OFF'}</dd>
              </div>
            )}
          </dl>
        </article>

        <article className="automation-card rule-detail-card">
          <h2>{t('detail.configuration')}</h2>
          <dl className="rule-detail-summary">
            {threshold && (
              <div>
                <dt>{t('dashboard.thresholds')}</dt>
                <dd>{threshold}</dd>
              </div>
            )}
            <div>
              <dt>{t('time.scheduleSummary')}</dt>
              <dd>{schedule ?? t('common.disabled')}</dd>
            </div>
          </dl>
        </article>

        <article className="automation-card rule-detail-card rule-detail-controls">
          <h2>{t('detail.automation')}</h2>
          <RuleRuntimeControls
            rule={rule}
            snapshot={snapshot}
            busy={action.isPending}
            onAction={handleAction}
            onRefresh={() => void runtime.refetch()}
          />
          {(action.isError || runtime.isError) && (
            <p className="rule-detail-error">{t('detail.actionFailed')}</p>
          )}
        </article>

        <article className="automation-card rule-detail-card">
          <button
            className="secondary-action secondary-action--danger"
            type="button"
            disabled={action.isPending}
            onClick={() => setDeleteOpen(true)}
          >
            {t('common.delete')}
          </button>
        </article>
      </section>

      <Modal
        open={deleteOpen}
        busy={action.isPending}
        closeLabel={t('common.cancel')}
        title={t('common.delete')}
        description={rule.name}
        onClose={() => setDeleteOpen(false)}
        actions={
          <button
            className="secondary-action secondary-action--danger"
            type="button"
            disabled={action.isPending}
            onClick={() => handleAction('delete')}
          >
            {t('common.confirmDelete')}
          </button>
        }
      >
        <p>{t('detail.description')}</p>
      </Modal>
    </main>
  );
};
EOF

cat > apps/mobile/src/screens/rules/RuleDetailScreen.css <<'EOF'
.rule-detail-shell {
  align-content: start;
  gap: var(--lcl-spacing-md);
}

.rule-detail-header p {
  color: var(--lcl-color-text-muted);
  margin: var(--lcl-spacing-xs) 0 0;
}

.rule-detail-grid {
  display: grid;
  gap: var(--lcl-spacing-md);
}

.rule-detail-card {
  box-shadow: none;
  display: grid;
  gap: var(--lcl-spacing-md);
}

.rule-detail-card h2 {
  margin: 0;
}

.rule-detail-summary,
.rule-card__summary {
  display: grid;
  gap: var(--lcl-spacing-sm);
  margin: 0;
}

.rule-detail-summary > div,
.rule-card__summary > div {
  display: grid;
  gap: var(--lcl-spacing-xs);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
}

.rule-detail-summary dt,
.rule-card__summary dt {
  color: var(--lcl-color-text-muted);
}

.rule-detail-summary dd,
.rule-card__summary dd {
  margin: 0;
  overflow-wrap: anywhere;
  text-align: right;
}

.rule-detail-controls .automation-control-group,
.rule-detail-controls .automation-relay-actions {
  display: flex;
  gap: var(--lcl-spacing-sm);
  width: 100%;
}

.rule-detail-controls .automation-control-group > *,
.rule-detail-controls .automation-relay-actions > * {
  flex: 1 1 0;
}

.rule-detail-error {
  color: var(--lcl-color-status-danger-text);
  margin: 0;
}
EOF

cat > apps/mobile/src/screens/AutomationDashboardScreen.tsx <<'EOF'
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
EOF

cat >> apps/mobile/src/screens/AutomationDashboardScreen.css <<'EOF'

.rule-card__summary {
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  padding-top: var(--lcl-spacing-sm);
}

.rule-card .automation-card__status--ok {
  color: var(--lcl-color-accent);
}

.rule-card .automation-card__status--paused,
.rule-card .automation-card__status--loading {
  color: var(--lcl-color-text-muted);
}
EOF

cat > apps/mobile/src/routes/AppRoutes.tsx <<'EOF'
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AppSettingsScreen } from '../app/AppSettingsScreen.js';
import { useTranslation } from '../app/i18n.js';
import {
  AppBottomNavigation,
  type AppNavigationKind
} from '../components/AppBottomNavigation.js';
import type { SetupIntent } from '../flows/setup-intent.js';
import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';
import { SetupIntentScreen } from '../screens/SetupIntentScreen.js';
import { PlugManagementScreen } from '../screens/devices/PlugManagementScreen.js';
import { SensorManagementScreen } from '../screens/devices/SensorManagementScreen.js';
import { RuleDetailScreen } from '../screens/rules/RuleDetailScreen.js';

const HardwareSetupScreen = lazy(async () => {
  const module = await import('../screens/hardware-setup/HardwareSetupScreen.js');
  return { default: module.HardwareSetupScreen };
});

type PrimaryAppRoute =
  | { type: 'dashboard' }
  | { type: 'plugs' }
  | { type: 'sensors' }
  | { type: 'intent' }
  | { type: 'setup'; intent: SetupIntent }
  | { type: 'rule'; ruleId: string };
type AppRoute = PrimaryAppRoute | { type: 'settings'; returnTo: PrimaryAppRoute };

const resolveAndroidBackRoute = (route: AppRoute): AppRoute | null => {
  switch (route.type) {
    case 'settings':
      return route.returnTo;
    case 'setup':
      return { type: 'intent' };
    case 'rule':
    case 'intent':
    case 'plugs':
    case 'sensors':
      return { type: 'dashboard' };
    case 'dashboard':
      return null;
  }
};

export const AppRoutes = () => {
  const { t } = useTranslation();
  const [route, setRoute] = useState<AppRoute>({ type: 'dashboard' });
  const routeRef = useRef(route);
  const navigate = useCallback((nextRoute: AppRoute) => {
    routeRef.current = nextRoute;
    setRoute(nextRoute);
  }, []);
  const navigateTopLevel = useCallback(
    (kind: AppNavigationKind) => {
      if (kind === 'settings') {
        const current = routeRef.current;
        if (current.type !== 'settings') navigate({ type: 'settings', returnTo: current });
      } else {
        navigate({ type: kind === 'rules' ? 'dashboard' : kind });
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    void App.addListener('backButton', () => {
      const nextRoute = resolveAndroidBackRoute(routeRef.current);
      if (nextRoute === null) void App.exitApp();
      else navigate(nextRoute);
    }).then((handle) => {
      if (!active) void handle.remove();
      else removeListener = () => handle.remove();
    });
    return () => {
      active = false;
      if (removeListener) void removeListener();
    };
  }, [navigate]);

  const content = () => {
    switch (route.type) {
      case 'settings':
        return <AppSettingsScreen />;
      case 'plugs':
        return <PlugManagementScreen onOpenRule={(ruleId) => navigate({ type: 'rule', ruleId })} />;
      case 'sensors':
        return <SensorManagementScreen />;
      case 'intent':
        return (
          <SetupIntentScreen
            onCancel={() => navigate({ type: 'dashboard' })}
            onSelect={(intent) => navigate({ type: 'setup', intent })}
          />
        );
      case 'dashboard':
        return (
          <AutomationDashboardScreen
            onAddAutomation={() => navigate({ type: 'intent' })}
            onOpenRule={(ruleId) => navigate({ type: 'rule', ruleId })}
          />
        );
      case 'rule':
        return <RuleDetailScreen ruleId={route.ruleId} onBack={() => navigate({ type: 'dashboard' })} />;
      case 'setup':
        return (
          <HardwareSetupScreen
            setupIntent={route.intent}
            onBackToIntent={() => navigate({ type: 'intent' })}
            onSetupComplete={() => navigate({ type: 'dashboard' })}
          />
        );
    }
  };
  const activeKind: AppNavigationKind =
    route.type === 'plugs' || route.type === 'sensors' || route.type === 'settings'
      ? route.type
      : 'rules';

  return (
    <>
      <Suspense
        fallback={
          <main className="demo-shell hardware-shell app-bottom-nav-shell">
            <p>{t('app.loadingConfigurator')}</p>
          </main>
        }
      >
        {content()}
      </Suspense>
      <AppBottomNavigation activeKind={activeKind} onNavigate={navigateTopLevel} />
    </>
  );
};
EOF

cat > apps/mobile/src/__tests__/automation-dashboard.test.tsx <<'EOF'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { climate, plug, sensor, time } from '../flows/registry/fixtures.test-support.js';
import { usePlugStore, useRuleStore, useSensorStore } from '../flows/registry/devicesAndRules.js';
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
EOF

rm -f apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
s = p.read_text()
# Replace imports for old installed model/store with rule registry fixtures.
start = "import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';\n"
s = s.replace(start, '')
s = s.replace("import { createInstalledAutomation } from '../flows/installations/model.js';\n", '')
s = s.replace("import {\n  resetInstalledAutomationStore,\n  useInstalledAutomationStore\n} from '../flows/installations/store.js';\n", "import { climate, plug, sensor } from '../flows/registry/fixtures.test-support.js';\nimport { usePlugStore, useRuleStore, useSensorStore } from '../flows/registry/devicesAndRules.js';\n")
old_mock = """vi.mock('../screens/InstallationDetailScreen.js', () => ({\n  InstallationDetailScreen: ({\n    installationId,\n    onBack\n  }: {\n    installationId: string;\n    onBack: () => void;\n  }) => (\n    <section>\n      <p>{`mock-installation-${installationId}`}</p>\n      <button type=\"button\" onClick={onBack}>\n        mock-dashboard-back\n      </button>\n    </section>\n  )\n}));\n"""
new_mock = """vi.mock('../screens/rules/RuleDetailScreen.js', () => ({\n  RuleDetailScreen: ({ ruleId, onBack }: { ruleId: string; onBack: () => void }) => (\n    <section>\n      <p>{`mock-rule-${ruleId}`}</p>\n      <button type=\"button\" onClick={onBack}>\n        mock-dashboard-back\n      </button>\n    </section>\n  )\n}));\n"""
if old_mock not in s:
    raise SystemExit('old detail mock anchor missing')
s = s.replace(old_mock, new_mock)
old_helper_start = "const addClimateInstallation = (suffix = 'route') => {\n"
old_helper_end = "\n};\n\ndescribe('AppRoutes navigation shell'"
idx1 = s.find(old_helper_start)
idx2 = s.find(old_helper_end, idx1)
if idx1 == -1 or idx2 == -1:
    raise SystemExit('installation helper anchors missing')
helper = """const addClimateRule = () => {\n  usePlugStore.setState({ items: [plug], loadError: null });\n  useSensorStore.setState({ items: [sensor], loadError: null });\n  useRuleStore.setState({ items: [{ ...climate, name: 'Salon climate' }], loadError: null });\n  return { ...climate, name: 'Salon climate' };\n};\n\nconst resetRegistries = () => {\n  usePlugStore.setState({ items: [], loadError: null });\n  useSensorStore.setState({ items: [], loadError: null });\n  useRuleStore.setState({ items: [], loadError: null });\n};\n"""
s = s[:idx1] + helper + s[idx2+4:]
s = s.replace('    resetInstalledAutomationStore();', '    resetRegistries();')
s = s.replace("  it('opens an installed system by stable id and returns to its dashboard', () => {\n    const installation = addClimateInstallation('detail');", "  it('opens a saved rule by stable id and returns to its dashboard', () => {\n    const rule = addClimateRule();")
s = s.replace("fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon' }));\n    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();", "fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon climate' }));\n    expect(screen.getByText(`mock-rule-${rule.id}`)).toBeVisible();")
p.write_text(s)
PY

cat > apps/mobile/src/__tests__/rule-detail.test.tsx <<'EOF'
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
EOF

pnpm exec prettier --write \
  apps/mobile/src/screens/rules/rulePresentation.ts \
  apps/mobile/src/screens/rules/RuleCard.tsx \
  apps/mobile/src/screens/rules/RuleRuntimeControls.tsx \
  apps/mobile/src/screens/rules/RuleDetailScreen.tsx \
  apps/mobile/src/screens/rules/RuleDetailScreen.css \
  apps/mobile/src/screens/AutomationDashboardScreen.tsx \
  apps/mobile/src/screens/AutomationDashboardScreen.css \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/__tests__/automation-dashboard.test.tsx \
  apps/mobile/src/__tests__/app-routes.test.tsx \
  apps/mobile/src/__tests__/rule-detail.test.tsx

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/__tests__/automation-dashboard.test.tsx \
  src/__tests__/app-routes.test.tsx \
  src/__tests__/rule-detail.test.tsx \
  src/flows/rules/lifecycle.test.ts \
  src/flows/rules/draft.test.ts
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add -A apps/mobile/src/screens apps/mobile/src/routes/AppRoutes.tsx apps/mobile/src/__tests__/automation-dashboard.test.tsx apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx apps/mobile/src/__tests__/app-routes.test.tsx apps/mobile/src/__tests__/rule-detail.test.tsx
git commit -m 'Cut product UI over to rules'
HEAD=$(git rev-parse HEAD)
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$EXPECTED" ]] || { echo 'Remote moved during product cutover task'; exit 4; }
git push origin "$HEAD:$BRANCH"
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$HEAD" ]] || { echo 'Push verification failed'; exit 5; }
echo "FINAL_HEAD=$HEAD"

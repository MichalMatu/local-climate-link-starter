import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type {
  ClimateInstalledAutomation,
  InstalledAutomation
} from '../flows/installations/model.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import { installedAutomationHealth } from '../flows/installations/runtimeDiagnostics.js';
import {
  formatInstallationMetric,
  installationHealthLabel,
  installationThresholdSummary
} from '../flows/installations/presentation.js';
import { installedAutomationScriptMatch } from '../flows/installations/runtimeControl.js';
import {
  useInstalledAutomationActions,
  useInstalledAutomationControl,
  useInstalledAutomationDiagnostics
} from '../flows/installations/useInstalledAutomationRuntime.js';
import { useTranslation } from '../app/i18n.js';
import { TimeAutomationCard } from './TimeAutomationCard.js';
import './AutomationDashboardScreen.css';

type IconProps = { className?: string };

const ThermometerIcon = ({ className }: IconProps) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0Z" />
    <path d="M12 9v6" />
  </svg>
);

const ClockIcon = ({ className }: IconProps) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const SettingsIcon = ({ className }: IconProps) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.55v-.1a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 3.75 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.55h.05a1.7 1.7 0 0 0 1.1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.86-2.86.06.06A1.7 1.7 0 0 0 8.15 3.75a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4.05v.05a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4H21v4.05h-.1a1.7 1.7 0 0 0-1.1.4 1.7 1.7 0 0 0-.4 1Z" />
  </svg>
);

const DotsIcon = ({ className }: IconProps) => (
  <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const isDashboardRuntimeQuery = (query: { queryKey: readonly unknown[] }) => {
  const root = query.queryKey[0];
  return (
    root === 'installed-automation-diagnostics' ||
    root === 'installed-automation-control' ||
    root === 'time-automation-runtime'
  );
};

type AutomationCardProps = {
  installation: InstalledAutomation;
  onOpen(installationId: string): void;
};

const ClimateAutomationCard = ({
  installation,
  onOpen
}: {
  installation: ClimateInstalledAutomation;
  onOpen(installationId: string): void;
}) => {
  const { t } = useTranslation();
  const query = useInstalledAutomationDiagnostics(installation);
  const control = useInstalledAutomationControl(installation);
  const action = useInstalledAutomationActions(installation);

  const snapshot = query.data;
  const health = snapshot ? installedAutomationHealth(snapshot) : null;
  const controlStatus = control.data;
  const controlMatch = controlStatus
    ? installedAutomationScriptMatch(installation, controlStatus)
    : null;
  const controlsVerified = controlMatch === 'matched';
  const automationRunning = controlsVerified && controlStatus?.automationMode === 'auto';
  const manualControl = controlsVerified && controlStatus?.automationMode === 'manual';
  const relayState =
    controlStatus?.relayOn ??
    snapshot?.plug?.relayState ??
    snapshot?.diagnostics.relayState;
  const purposeLabel =
    installation.config.rule.control.metric === 'humidity'
      ? t('intent.humidity.context')
      : t('intent.temperature.context');

  let warningLabel: string | null = null;
  let warningClass = 'attention';
  if (controlMatch !== null && controlMatch !== 'matched') {
    warningLabel = t('dashboard.health.attention');
  } else if (query.isError && control.isError) {
    warningLabel = t('dashboard.health.offline');
    warningClass = 'offline';
  } else if (health !== null && health !== 'ok') {
    warningLabel = installationHealthLabel(health, t);
    warningClass = health;
  } else if (query.isError || control.isError) {
    warningLabel = t('dashboard.health.attention');
  }

  return (
    <article className="automation-card automation-card--climate">
      <header className="automation-card__header">
        <span
          className={`automation-card__leading-icon${
            automationRunning ? ' automation-card__leading-icon--active' : ''
          }`}
        >
          <ThermometerIcon className="automation-card__leading-icon-svg" />
        </span>
        <div className="automation-card__identity">
          <h2>{installation.shelly.name}</h2>
          <p className="automation-card__purpose">{purposeLabel}</p>
          {warningLabel && (
            <span className={`automation-health automation-health--${warningClass}`}>
              {warningLabel}
            </span>
          )}
        </div>
        <div className="automation-card__header-actions">
          <button
            className="automation-master-switch"
            type="button"
            role="switch"
            aria-checked={automationRunning}
            aria-label={automationRunning ? t('detail.pause') : t('detail.resume')}
            title={automationRunning ? t('detail.pause') : t('detail.resume')}
            disabled={action.isPending || !controlsVerified}
            onClick={() => action.mutate(automationRunning ? 'manual' : 'auto')}
          >
            <span className="automation-master-switch__thumb" />
          </button>
          <button
            className="automation-card__menu"
            type="button"
            aria-label={`${t('dashboard.openSystem')}: ${installation.shelly.name}`}
            title={t('dashboard.openSystem')}
            onClick={() => onOpen(installation.id)}
          >
            <DotsIcon className="automation-card__menu-icon" />
          </button>
        </div>
      </header>

      <div className="automation-metrics" aria-label={t('dashboard.currentValues')}>
        <div>
          <span>{t('dashboard.temperature')}</span>
          <strong>
            {formatInstallationMetric(snapshot?.diagnostics.lastTemp, '°C')}
          </strong>
        </div>
        <div>
          <span>{t('dashboard.humidity')}</span>
          <strong>
            {formatInstallationMetric(snapshot?.diagnostics.lastHumidity, '%')}
          </strong>
        </div>
        <div>
          <span>{t('dashboard.vpd')}</span>
          <strong>
            {formatInstallationMetric(snapshot?.diagnostics.lastVpd, ' kPa', 2)}
          </strong>
        </div>
      </div>

      <dl className="automation-summary">
        <div>
          <dt>{t('dashboard.thresholds')}</dt>
          <dd>
            {installationThresholdSummary(
              installation,
              snapshot?.diagnostics.lastEffectiveOnThreshold,
              snapshot?.diagnostics.lastEffectiveOffThreshold
            )}
          </dd>
        </div>
        <div>
          <dt>{t('dashboard.sensor')}</dt>
          <dd>{installation.config.sensor.displayName}</dd>
        </div>
      </dl>

      <footer className="automation-card__footer">
        <div className="automation-card__controls">
          <div
            className="automation-control-group"
            role="group"
            aria-label={t('detail.automation')}
          >
            <button
              className="automation-control-button"
              type="button"
              aria-pressed={automationRunning}
              disabled={action.isPending || !controlsVerified}
              onClick={() => {
                if (controlStatus?.automationMode !== 'auto') action.mutate('auto');
              }}
            >
              AUTO
            </button>
            <button
              className="automation-control-button"
              type="button"
              aria-pressed={manualControl}
              disabled={action.isPending || !controlsVerified}
              onClick={() => {
                if (controlStatus?.automationMode !== 'manual') action.mutate('manual');
              }}
            >
              MANUAL
            </button>
          </div>
          <div
            className="automation-relay-actions"
            role="group"
            aria-label={t('dashboard.output')}
          >
            <button
              className="automation-relay-button"
              type="button"
              aria-pressed={relayState === true}
              disabled={action.isPending || !manualControl}
              onClick={() => {
                if (!controlStatus?.relayOn) action.mutate('on');
              }}
            >
              ON
            </button>
            <button
              className="automation-relay-button"
              type="button"
              aria-pressed={relayState === false}
              disabled={action.isPending || !manualControl}
              onClick={() => {
                if (controlStatus?.relayOn) action.mutate('off');
              }}
            >
              OFF
            </button>
          </div>
        </div>
        <button
          className="automation-card__detail-link"
          type="button"
          onClick={() => onOpen(installation.id)}
        >
          <span>{t('dashboard.openSystem')}</span>
          <span aria-hidden="true">›</span>
        </button>
        {action.isError && (
          <span className="automation-control-error" role="alert">
            {t('detail.actionFailed')}
          </span>
        )}
      </footer>
    </article>
  );
};

const AutomationCard = ({ installation, onOpen }: AutomationCardProps) =>
  installation.kind === 'time' ? (
    <TimeAutomationCard installation={installation} onOpen={onOpen} />
  ) : (
    <ClimateAutomationCard installation={installation} onOpen={onOpen} />
  );

type AutomationDashboardScreenProps = {
  onAddAutomation(): void;
  onOpenInstallation(installationId: string): void;
  onOpenSettings?: () => void;
};

export const AutomationDashboardScreen = ({
  onAddAutomation,
  onOpenInstallation,
  onOpenSettings
}: AutomationDashboardScreenProps) => {
  const { t } = useTranslation();
  const installations = useInstalledAutomationStore((state) => state.installations);
  const queryClient = useQueryClient();
  const hasClimate = installations.some((installation) => installation.kind !== 'time');
  const hasTime = installations.some((installation) => installation.kind === 'time');
  const [activeKind, setActiveKind] = useState<'climate' | 'time'>(() =>
    hasTime && !hasClimate ? 'time' : 'climate'
  );

  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;

    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void queryClient.refetchQueries({ predicate: isDashboardRuntimeQuery });
      }
    }).then((handle) => {
      if (!active) {
        void handle.remove();
        return;
      }
      removeListener = () => handle.remove();
    });

    return () => {
      active = false;
      if (removeListener) void removeListener();
    };
  }, [queryClient]);

  const visibleInstallations = installations.filter((installation) =>
    activeKind === 'time' ? installation.kind === 'time' : installation.kind !== 'time'
  );

  return (
    <main className="demo-shell dashboard-shell">
      <header className="demo-header dashboard-header">
        <div>
          <h1>{t('dashboard.title')}</h1>
        </div>
      </header>

      <section className="dashboard-grid" aria-label={t('dashboard.systemsLabel')}>
        {visibleInstallations.length > 0 ? (
          visibleInstallations.map((installation) => (
            <AutomationCard
              key={installation.id}
              installation={installation}
              onOpen={onOpenInstallation}
            />
          ))
        ) : (
          <div className="dashboard-kind-empty" role="status">
            <span className="dashboard-kind-empty__icon">
              {activeKind === 'time' ? (
                <ClockIcon className="dashboard-nav__icon" />
              ) : (
                <ThermometerIcon className="dashboard-nav__icon" />
              )}
            </span>
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
        <svg aria-hidden="true" className="dashboard-fab__icon" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <nav className="dashboard-bottom-nav" aria-label={t('dashboard.systemsLabel')}>
        <button
          className="dashboard-bottom-nav__item"
          type="button"
          data-dashboard-kind="climate"
          aria-current={activeKind === 'climate' ? 'page' : undefined}
          onClick={() => setActiveKind('climate')}
        >
          <ThermometerIcon className="dashboard-nav__icon" />
          <span>{t('dashboard.climateTab')}</span>
        </button>
        <button
          className="dashboard-bottom-nav__item"
          type="button"
          data-dashboard-kind="time"
          aria-current={activeKind === 'time' ? 'page' : undefined}
          onClick={() => setActiveKind('time')}
        >
          <ClockIcon className="dashboard-nav__icon" />
          <span>{t('dashboard.timeTab')}</span>
        </button>
        <button
          className="dashboard-bottom-nav__item"
          type="button"
          aria-haspopup="dialog"
          onClick={() => onOpenSettings?.()}
        >
          <SettingsIcon className="dashboard-nav__icon" />
          <span>{t('dashboard.settingsTab')}</span>
        </button>
      </nav>
    </main>
  );
};

import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  IconAlertTriangle,
  IconChevronRight,
  IconClock,
  IconDotsVertical,
  IconPlus,
  IconSettings,
  IconTemperature
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import type {
  ClimateInstalledAutomation,
  InstalledAutomation
} from '../flows/installations/model.js';
import {
  formatInstallationMetric,
  installationHealthLabel,
  installationThresholdSummary
} from '../flows/installations/presentation.js';
import { installedAutomationHealth } from '../flows/installations/runtimeDiagnostics.js';
import { installedAutomationScriptMatch } from '../flows/installations/runtimeControl.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import {
  useInstalledAutomationActions,
  useInstalledAutomationControl,
  useInstalledAutomationDiagnostics
} from '../flows/installations/useInstalledAutomationRuntime.js';
import { TimeAutomationCard } from './TimeAutomationCard.js';
import './AutomationDashboardScreen.css';

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
  const controlsHumidity = installation.config.rule.control.metric === 'humidity';
  const purposeLabel = controlsHumidity
    ? t('intent.humidity.context')
    : t('intent.temperature.context');
  const thresholdSummary = installationThresholdSummary(
    installation,
    snapshot?.diagnostics.lastEffectiveOnThreshold,
    snapshot?.diagnostics.lastEffectiveOffThreshold
  );

  const primaryMetric = controlsHumidity
    ? {
        label: t('dashboard.humidity'),
        value: formatInstallationMetric(snapshot?.diagnostics.lastHumidity, '%')
      }
    : {
        label: t('dashboard.temperature'),
        value: formatInstallationMetric(snapshot?.diagnostics.lastTemp, '°C')
      };
  const secondaryMetric = controlsHumidity
    ? {
        label: t('dashboard.temperature'),
        value: formatInstallationMetric(snapshot?.diagnostics.lastTemp, '°C')
      }
    : {
        label: t('dashboard.humidity'),
        value: formatInstallationMetric(snapshot?.diagnostics.lastHumidity, '%')
      };

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
          aria-hidden="true"
        >
          <IconTemperature className="automation-card__icon" />
        </span>

        <div className="automation-card__identity">
          <h2>{installation.shelly.name}</h2>
          <p>{purposeLabel}</p>
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
            <IconDotsVertical className="automation-card__menu-icon" />
          </button>
        </div>
      </header>

      <div className="automation-card__main" aria-label={t('dashboard.currentValues')}>
        <div className="automation-card__primary-metric">
          <span>{primaryMetric.label}</span>
          <strong>{primaryMetric.value}</strong>
          <small aria-label={`${t('dashboard.thresholds')}: ${thresholdSummary}`}>
            {thresholdSummary}
          </small>
        </div>

        <div className="automation-card__secondary-metrics">
          <div>
            <span>{secondaryMetric.label}</span>
            <strong>{secondaryMetric.value}</strong>
          </div>
          <div>
            <span>{t('dashboard.vpd')}</span>
            <strong>
              {formatInstallationMetric(snapshot?.diagnostics.lastVpd, ' kPa', 2)}
            </strong>
          </div>
        </div>

        <div
          className="automation-control-group automation-card__mode-control"
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
      </div>

      <div
        className="automation-relay-actions automation-card__relay-actions"
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

      <footer className="automation-card__footer">
        <button
          className={`automation-card__status-link${
            warningLabel ? ` automation-card__status-link--${warningClass}` : ''
          }`}
          type="button"
          aria-label={t('dashboard.openSystem')}
          onClick={() => onOpen(installation.id)}
        >
          <span className="automation-card__status-copy">
            {warningLabel && <IconAlertTriangle aria-hidden="true" />}
            <span>{warningLabel ?? t('dashboard.openSystem')}</span>
          </span>
          <IconChevronRight aria-hidden="true" />
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
        <h1>{t('dashboard.title')}</h1>
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
            {activeKind === 'time' ? (
              <IconClock className="dashboard-kind-empty__icon" aria-hidden="true" />
            ) : (
              <IconTemperature
                className="dashboard-kind-empty__icon"
                aria-hidden="true"
              />
            )}
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

      <nav className="dashboard-bottom-nav" aria-label={t('dashboard.systemsLabel')}>
        <button
          className="dashboard-bottom-nav__item"
          type="button"
          data-dashboard-kind="climate"
          aria-current={activeKind === 'climate' ? 'page' : undefined}
          onClick={() => setActiveKind('climate')}
        >
          <IconTemperature className="dashboard-nav__icon" aria-hidden="true" />
          <span>{t('dashboard.climateTab')}</span>
        </button>
        <button
          className="dashboard-bottom-nav__item"
          type="button"
          data-dashboard-kind="time"
          aria-current={activeKind === 'time' ? 'page' : undefined}
          onClick={() => setActiveKind('time')}
        >
          <IconClock className="dashboard-nav__icon" aria-hidden="true" />
          <span>{t('dashboard.timeTab')}</span>
        </button>
        <button
          className="dashboard-bottom-nav__item"
          type="button"
          aria-haspopup="dialog"
          disabled={!onOpenSettings}
          onClick={() => onOpenSettings?.()}
        >
          <IconSettings className="dashboard-nav__icon" aria-hidden="true" />
          <span>{t('dashboard.settingsTab')}</span>
        </button>
      </nav>
    </main>
  );
};

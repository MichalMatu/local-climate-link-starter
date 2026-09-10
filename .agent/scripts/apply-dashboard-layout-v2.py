from pathlib import Path

ROOT = Path('.')

screen = r'''import { App as CapacitorApp } from '@capacitor/app';
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
'''

css = r'''.dashboard-shell {
  --dashboard-nav-height: calc(
    var(--lcl-size-control-min-height) + var(--lcl-spacing-lg)
  );
  --dashboard-switch-height: calc(var(--lcl-spacing-lg) + var(--lcl-spacing-sm));
  --dashboard-switch-width: calc(var(--lcl-spacing-2xl) + var(--lcl-spacing-lg));
  --dashboard-switch-thumb: calc(
    var(--dashboard-switch-height) - (var(--lcl-border-width-md) * 2)
  );
  align-content: start;
  gap: var(--lcl-spacing-md);
  padding-bottom: calc(
    var(--dashboard-nav-height) + var(--lcl-spacing-2xl) +
      var(--lcl-fluid-shell-padding) + env(safe-area-inset-bottom)
  );
}

.dashboard-shell .dashboard-header {
  align-items: center;
  min-height: var(--lcl-size-control-min-height);
  padding-right: 0;
}

.dashboard-shell .dashboard-header h1 {
  font-size: calc(var(--lcl-font-size-2xl) + var(--lcl-spacing-md));
  line-height: var(--lcl-line-height-tight);
}

.dashboard-shell .dashboard-grid {
  gap: var(--lcl-spacing-md);
}

.dashboard-shell .automation-card {
  box-shadow: none;
  gap: var(--lcl-spacing-sm);
  padding: var(--lcl-spacing-md);
}

.dashboard-shell .automation-card__header {
  align-items: center;
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.automation-card__leading-icon {
  align-items: center;
  background: var(--lcl-color-surface-muted);
  border-radius: var(--lcl-radius-round);
  color: var(--lcl-color-text-muted);
  display: inline-flex;
  height: var(--lcl-size-control-min-height);
  justify-content: center;
  width: var(--lcl-size-control-min-height);
}

.automation-card__leading-icon--active {
  color: var(--lcl-color-accent);
}

.automation-card__icon,
.automation-card__menu-icon,
.dashboard-nav__icon,
.dashboard-fab__icon {
  height: var(--lcl-size-control-icon-size);
  width: var(--lcl-size-control-icon-size);
}

.dashboard-shell .automation-card__identity {
  display: grid;
  gap: var(--lcl-spacing-xs);
  min-width: 0;
}

.dashboard-shell .automation-card__identity h2 {
  font-size: var(--lcl-font-size-2xl);
  line-height: var(--lcl-line-height-tight);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-shell .automation-card__identity p {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  line-height: var(--lcl-line-height-compact);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.automation-card__header-actions {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-xs);
}

.automation-master-switch {
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-round);
  cursor: pointer;
  height: var(--dashboard-switch-height);
  padding: 0;
  position: relative;
  transition-duration: var(--lcl-motion-fast);
  transition-property: background-color, border-color, opacity;
  width: var(--dashboard-switch-width);
}

.automation-master-switch[aria-checked='true'] {
  background: var(--lcl-color-accent);
  border-color: var(--lcl-color-accent);
}

.automation-master-switch:disabled {
  cursor: not-allowed;
  opacity: var(--lcl-opacity-disabled);
}

.automation-master-switch__thumb {
  background: var(--lcl-color-surface);
  border-radius: var(--lcl-radius-round);
  box-shadow: var(--lcl-shadow-sm);
  height: var(--dashboard-switch-thumb);
  left: var(--lcl-border-width-md);
  position: absolute;
  top: var(--lcl-border-width-md);
  transition-duration: var(--lcl-motion-fast);
  transition-property: transform;
  width: var(--dashboard-switch-thumb);
}

.automation-master-switch[aria-checked='true'] .automation-master-switch__thumb {
  transform: translateX(
    calc(
      var(--dashboard-switch-width) - var(--dashboard-switch-thumb) -
        (var(--lcl-border-width-md) * 2)
    )
  );
}

.automation-card__menu {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: var(--lcl-radius-round);
  color: var(--lcl-color-text);
  cursor: pointer;
  display: inline-flex;
  height: var(--lcl-size-control-min-height);
  justify-content: center;
  padding: 0;
  width: var(--lcl-size-control-min-height);
}

.automation-card__menu:hover,
.automation-card__menu:focus-visible,
.dashboard-bottom-nav__item:hover,
.dashboard-bottom-nav__item:focus-visible {
  color: var(--lcl-color-accent);
}

.automation-card__main {
  align-items: center;
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: minmax(0, 1fr) auto var(--lcl-size-action-min-width);
  min-width: 0;
  padding-top: var(--lcl-spacing-sm);
}

.automation-card__primary-metric,
.automation-card__secondary-metrics,
.automation-card__secondary-metrics > div {
  display: grid;
  min-width: 0;
}

.automation-card__primary-metric {
  gap: var(--lcl-spacing-xs);
}

.automation-card__primary-metric > span,
.automation-card__secondary-metrics span {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-xs);
  line-height: var(--lcl-line-height-compact);
}

.automation-card__primary-metric strong {
  font-size: calc(var(--lcl-font-size-2xl) + var(--lcl-spacing-sm));
  line-height: var(--lcl-line-height-tight);
  white-space: nowrap;
}

.automation-card__primary-metric small {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-xs);
  font-weight: var(--lcl-font-weight-semibold);
  line-height: var(--lcl-line-height-compact);
  white-space: nowrap;
}

.automation-card__secondary-metrics {
  gap: var(--lcl-spacing-sm);
}

.automation-card__secondary-metrics > div {
  gap: var(--lcl-spacing-xs);
}

.automation-card__secondary-metrics strong {
  font-size: var(--lcl-font-size-sm);
  line-height: var(--lcl-line-height-tight);
  white-space: nowrap;
}

.dashboard-shell .automation-control-group {
  background: var(--lcl-color-surface-muted);
  border: 0;
  border-radius: var(--lcl-radius-round);
  display: flex;
  overflow: hidden;
}

.dashboard-shell .automation-control-group > * {
  flex: 1 1 0;
}

.dashboard-shell .automation-control-button {
  background: transparent;
  border: 0;
  border-radius: var(--lcl-radius-round);
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-xs);
  min-height: var(--lcl-size-compact-control-min-height);
  padding: 0 var(--lcl-spacing-xs);
}

.dashboard-shell .automation-control-button[aria-pressed='true'] {
  background: var(--lcl-color-accent);
  color: var(--lcl-color-accent-contrast);
}

.automation-card__relay-actions {
  display: flex;
  gap: var(--lcl-spacing-sm);
  width: 100%;
}

.automation-card__relay-actions > * {
  flex: 1 1 0;
}

.dashboard-shell .automation-relay-button {
  min-height: var(--lcl-size-compact-control-min-height);
}

.dashboard-shell .automation-card__footer {
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  display: grid;
  gap: var(--lcl-spacing-xs);
  padding-top: 0;
}

.automation-card__status-link {
  align-items: center;
  background: transparent;
  border: 0;
  color: var(--lcl-color-text-muted);
  cursor: pointer;
  display: flex;
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-semibold);
  gap: var(--lcl-spacing-sm);
  justify-content: space-between;
  min-height: var(--lcl-size-compact-control-min-height);
  padding: var(--lcl-spacing-xs) 0 0;
  text-align: left;
  width: 100%;
}

.automation-card__status-copy {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-xs);
  min-width: 0;
}

.automation-card__status-copy svg,
.automation-card__status-link > svg {
  flex: 0 0 auto;
  height: var(--lcl-size-control-icon-size);
  width: var(--lcl-size-control-icon-size);
}

.automation-card__status-link--attention,
.automation-card__status-link--stale,
.automation-card__status-link--unknown {
  color: var(--lcl-color-status-warning-text);
}

.automation-card__status-link--offline {
  color: var(--lcl-color-status-danger-text);
}

.dashboard-kind-empty {
  align-items: center;
  color: var(--lcl-color-text-muted);
  display: grid;
  gap: var(--lcl-spacing-sm);
  justify-items: center;
  min-height: calc(var(--lcl-size-control-min-height) * 3);
  text-align: center;
}

.dashboard-kind-empty__icon {
  background: var(--lcl-color-surface-muted);
  border-radius: var(--lcl-radius-round);
  box-sizing: content-box;
  height: var(--lcl-size-control-icon-size);
  padding: var(--lcl-spacing-md);
  width: var(--lcl-size-control-icon-size);
}

.dashboard-bottom-nav {
  align-items: stretch;
  background: var(--lcl-color-surface);
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  bottom: 0;
  box-shadow: var(--lcl-shadow-sm);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  left: 0;
  min-height: var(--dashboard-nav-height);
  padding: var(--lcl-spacing-xs) var(--lcl-fluid-shell-padding)
    calc(var(--lcl-spacing-xs) + env(safe-area-inset-bottom));
  position: fixed;
  right: 0;
  z-index: var(--lcl-z-index-header);
}

.dashboard-bottom-nav__item {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text-muted);
  cursor: pointer;
  display: grid;
  font-size: var(--lcl-font-size-xs);
  font-weight: var(--lcl-font-weight-semibold);
  gap: var(--lcl-spacing-xs);
  justify-items: center;
  min-width: 0;
  padding: var(--lcl-spacing-xs) var(--lcl-spacing-sm);
}

.dashboard-bottom-nav__item[aria-current='page'] {
  color: var(--lcl-color-accent);
}

.dashboard-bottom-nav__item:disabled {
  cursor: not-allowed;
  opacity: var(--lcl-opacity-disabled);
}

.dashboard-shell .dashboard-fab {
  border-radius: var(--lcl-radius-round);
  bottom: calc(
    var(--dashboard-nav-height) + var(--lcl-spacing-md) + env(safe-area-inset-bottom)
  );
  height: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-md));
  position: fixed;
  right: var(--lcl-fluid-shell-padding);
  width: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-md));
  z-index: var(--lcl-z-index-header);
}

@media (max-width: 30rem) {
  .automation-card__main {
    gap: var(--lcl-spacing-xs) var(--lcl-spacing-sm);
    grid-template-columns: minmax(0, 1fr) auto var(--lcl-size-action-min-width);
  }
}
'''

(ROOT / 'apps/mobile/src/screens/AutomationDashboardScreen.tsx').write_text(screen)
(ROOT / 'apps/mobile/src/screens/AutomationDashboardScreen.css').write_text(css)

# Keep the existing tests focused on user-visible behavior after the layout compaction.
test_path = ROOT / 'apps/mobile/src/__tests__/automation-dashboard.test.tsx'
test_text = test_path.read_text()
test_text = test_text.replace("    expect(screen.getByText('Xiaomi salon')).toBeVisible();\n", '')
test_path.write_text(test_text)

print('dashboard layout v2 applied')

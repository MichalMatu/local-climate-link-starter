from pathlib import Path
import re

ROOT = Path('.')


def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrences, found {actual}: {old[:80]!r}')
    p.write_text(text.replace(old, new))


def regex_once(path: str, pattern: str, repl: str) -> None:
    p = ROOT / path
    text = p.read_text()
    text, count = re.subn(pattern, repl, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise SystemExit(f'{path}: pattern did not match exactly once: {pattern!r}')
    p.write_text(text)


dashboard = r'''import { App as CapacitorApp } from '@capacitor/app';
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
  const automationRunning =
    controlsVerified && controlStatus?.automationMode === 'auto';
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
  } else if (query.isError || control.isError) {
    warningLabel = t('dashboard.health.attention');
  } else if (health !== null && health !== 'ok') {
    warningLabel = installationHealthLabel(health, t);
    warningClass = health;
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
          <strong>{formatInstallationMetric(snapshot?.diagnostics.lastTemp, '°C')}</strong>
        </div>
        <div>
          <span>{t('dashboard.humidity')}</span>
          <strong>{formatInstallationMetric(snapshot?.diagnostics.lastHumidity, '%')}</strong>
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
'''
(ROOT / 'apps/mobile/src/screens/AutomationDashboardScreen.tsx').write_text(dashboard)

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

.automation-card__leading-icon-svg,
.dashboard-nav__icon,
.automation-card__menu-icon {
  height: var(--lcl-size-control-icon-size);
  width: var(--lcl-size-control-icon-size);
}

.dashboard-shell .automation-card__identity {
  min-width: 0;
}

.dashboard-shell .automation-card__identity h2 {
  font-size: var(--lcl-font-size-2xl);
  line-height: var(--lcl-line-height-tight);
  margin: 0;
  overflow-wrap: anywhere;
}

.automation-card__purpose {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  line-height: var(--lcl-line-height-compact);
  margin: var(--lcl-spacing-xs) 0 0;
}

.dashboard-shell .automation-card__identity .automation-health {
  display: inline-flex;
  margin-top: var(--lcl-spacing-xs);
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

.dashboard-shell .automation-card__controls {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
}

.dashboard-shell .automation-control-group {
  display: flex;
  justify-self: center;
  width: min(100%, var(--lcl-size-action-min-width));
}

.dashboard-shell .automation-control-group > * {
  flex: 1 1 0;
}

.dashboard-shell .automation-relay-actions {
  display: flex;
  gap: var(--lcl-spacing-sm);
  width: 100%;
}

.dashboard-shell .automation-relay-actions > * {
  flex: 1 1 0;
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
  align-items: center;
  background: var(--lcl-color-surface-muted);
  border-radius: var(--lcl-radius-round);
  color: var(--lcl-color-text-muted);
  display: inline-flex;
  height: var(--lcl-size-control-min-height);
  justify-content: center;
  width: var(--lcl-size-control-min-height);
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

.dashboard-shell .dashboard-fab {
  bottom: calc(
    var(--dashboard-nav-height) + var(--lcl-spacing-md) +
      env(safe-area-inset-bottom)
  );
  position: fixed;
  right: var(--lcl-fluid-shell-padding);
  z-index: var(--lcl-z-index-header);
}
'''
(ROOT / 'apps/mobile/src/screens/AutomationDashboardScreen.css').write_text(css)

replace_exact(
    'apps/mobile/src/app/App.tsx',
    '        <AppRoutes />',
    '        <AppRoutes onOpenSettings={() => setSettingsOpen(true)} />'
)

replace_exact(
    'apps/mobile/src/routes/AppRoutes.tsx',
    'export const AppRoutes = () => {',
    "type AppRoutesProps = {\n  onOpenSettings?: () => void;\n};\n\nexport const AppRoutes = ({ onOpenSettings }: AppRoutesProps = {}) => {"
)
replace_exact(
    'apps/mobile/src/routes/AppRoutes.tsx',
    '        onOpenInstallation={(installationId) =>\n          navigate({ type: \'installation\', installationId })\n        }',
    "        onOpenInstallation={(installationId) =>\n          navigate({ type: 'installation', installationId })\n        }\n        {...(onOpenSettings ? { onOpenSettings } : {})}"
)

app_shell = r'''.app-shell {
  position: relative;
}

.app-shell > .demo-shell > .demo-header {
  padding-right: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-sm));
}

.app-shell > .dashboard-shell > .dashboard-header {
  padding-right: 0;
}

.app-settings-trigger {
  align-items: center;
  background: transparent;
  border: var(--lcl-border-width-sm) solid transparent;
  border-radius: var(--lcl-radius-md);
  box-shadow: none;
  color: var(--lcl-color-text);
  cursor: pointer;
  display: inline-flex;
  height: var(--lcl-size-control-min-height);
  justify-content: center;
  padding: 0;
  position: absolute;
  right: var(--lcl-fluid-shell-padding);
  top: var(--lcl-fluid-shell-padding);
  width: var(--lcl-size-control-min-height);
  z-index: var(--lcl-z-index-header);
}

.app-shell:has(> .dashboard-shell) > .app-settings-trigger {
  display: none;
}

.app-settings-trigger:hover,
.app-settings-trigger:focus-visible {
  border-color: var(--lcl-color-accent);
  color: var(--lcl-color-accent);
}

.app-settings-trigger__icon {
  height: var(--lcl-size-control-icon-size);
  width: var(--lcl-size-control-icon-size);
}
'''
(ROOT / 'apps/mobile/src/app/appShell.css').write_text(app_shell)

for hook_path in [
    'apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts',
    'apps/mobile/src/flows/time-automation/useTimeAutomationRuntime.ts'
]:
    p = ROOT / hook_path
    text = p.read_text()
    occurrences = text.count('    refetchOnWindowFocus: false')
    if occurrences < 1:
        raise SystemExit(f'{hook_path}: expected refetchOnWindowFocus false')
    text = text.replace(
        '    refetchOnWindowFocus: false',
        "    refetchOnMount: 'always',\n    refetchOnWindowFocus: true,\n    refetchOnReconnect: true"
    )
    p.write_text(text)

translations = {
    'pl.ts': ('Ustawienia', 'Brak automatyzacji'),
    'en.ts': ('Settings', 'No automations'),
    'de.ts': ('Einstellungen', 'Keine Automatisierungen'),
    'es.ts': ('Ajustes', 'Sin automatizaciones'),
    'fr.ts': ('Réglages', 'Aucune automatisation'),
    'it.ts': ('Impostazioni', 'Nessuna automazione'),
    'ptBr.ts': ('Configurações', 'Nenhuma automação'),
}
for filename, (settings_label, empty_label) in translations.items():
    p = ROOT / 'apps/mobile/src/app/locales' / filename
    text = p.read_text()
    if 'settingsTab:' in text or 'emptyCategory:' in text:
        raise SystemExit(f'{filename}: dashboard final keys already present')
    text, count = re.subn(
        r"(\n\s*timeTab: '[^']+',)",
        rf"\1\n    settingsTab: '{settings_label}',",
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit(f'{filename}: could not insert settingsTab')
    text, count = re.subn(
        r"(\n\s*emptyTitle: '[^']+',)",
        rf"\1\n    emptyCategory: '{empty_label}',",
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit(f'{filename}: could not insert emptyCategory')
    p.write_text(text)

# Dashboard tests: expose settings callback from helper.
replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard.test.tsx',
    "const renderDashboard = (onAddAutomation = vi.fn(), onOpenInstallation = vi.fn()) => {",
    "const renderDashboard = (\n  onAddAutomation = vi.fn(),\n  onOpenInstallation = vi.fn(),\n  onOpenSettings = vi.fn()\n) => {"
)
replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard.test.tsx',
    '    onOpenInstallation,\n    ...render(',
    '    onOpenInstallation,\n    onOpenSettings,\n    queryClient,\n    ...render('
)
replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard.test.tsx',
    '            onOpenInstallation={onOpenInstallation}\n          />',
    '            onOpenInstallation={onOpenInstallation}\n            onOpenSettings={onOpenSettings}\n          />'
)

replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard.test.tsx',
    "    expect(await screen.findByText('Działa')).toBeVisible();\n    expect(screen.getAllByText('ON').length).toBeGreaterThanOrEqual(1);\n    expect(screen.getByText('19°C / 20°C')).toBeVisible();\n    expect(screen.getByRole('tab', { name: 'Klimat' })).toHaveAttribute(\n      'aria-selected',\n      'true'\n    );\n    expect(screen.getByRole('tab', { name: 'Czas' })).toBeDisabled();\n    expect(screen.getByRole('button', { name: 'Szczegóły' })).toBeVisible();",
    "    expect(screen.queryByText('Działa')).toBeNull();\n    expect(screen.getAllByText('ON').length).toBeGreaterThanOrEqual(1);\n    expect(screen.getByText('19°C / 20°C')).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Klimat' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n    const timeNav = screen.getByRole('button', { name: 'Czas' });\n    expect(timeNav).toBeEnabled();\n    fireEvent.click(timeNav);\n    expect(screen.getByText('Brak automatyzacji')).toBeVisible();\n    fireEvent.click(screen.getByRole('button', { name: 'Klimat' }));\n    expect(screen.getByRole('button', { name: 'Ustawienia' })).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Szczegóły' })).toBeVisible();"
)

replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard.test.tsx',
    "    expect(screen.getByRole('tab', { name: 'Czas' })).toHaveAttribute(\n      'aria-selected',\n      'true'\n    );\n    expect(screen.getByRole('tab', { name: 'Klimat' })).toBeDisabled();",
    "    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n    const climateNav = screen.getByRole('button', { name: 'Klimat' });\n    expect(climateNav).toBeEnabled();\n    fireEvent.click(climateNav);\n    expect(screen.getByText('Brak automatyzacji')).toBeVisible();\n    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));"
)

replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard.test.tsx',
    "  it('uses effective runtime thresholds and recovers after a manual refresh', async () => {",
    "  it('uses effective runtime thresholds and recovers without a manual refresh control', async () => {"
)
replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard.test.tsx',
    '    renderDashboard();\n\n    expect(await screen.findByText(\'Wymaga uwagi\')).toBeVisible();\n    fireEvent.click(screen.getByRole(\'button\', { name: \'Odśwież\' }));\n\n    expect(await screen.findByText(\'Działa\')).toBeVisible();',
    "    const { queryClient } = renderDashboard();\n\n    expect(await screen.findByText('Wymaga uwagi')).toBeVisible();\n    expect(screen.queryByRole('button', { name: 'Odśwież' })).toBeNull();\n    await queryClient.refetchQueries({\n      predicate: (query) => query.queryKey[0] === 'installed-automation-diagnostics'\n    });\n\n    expect(screen.queryByText('Wymaga uwagi')).toBeNull();"
)

# Controls test: master switch must route through the same hardened run/pause action.
replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx',
    "    const manual = screen.getByRole('button', { name: 'MANUAL' });\n    const auto = screen.getByRole('button', { name: 'AUTO' });",
    "    const master = screen.getByRole('switch', { name: 'Wznów automatykę' });\n    const manual = screen.getByRole('button', { name: 'MANUAL' });\n    const auto = screen.getByRole('button', { name: 'AUTO' });"
)
replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx',
    "    expect(manual).toHaveAttribute('aria-pressed', 'true');",
    "    expect(master).toHaveAttribute('aria-checked', 'false');\n    expect(manual).toHaveAttribute('aria-pressed', 'true');"
)
replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx',
    "    fireEvent.click(auto);\n    expect(runtimeMocks.mutate).toHaveBeenCalledWith('auto');",
    "    fireEvent.click(master);\n    expect(runtimeMocks.mutate).toHaveBeenCalledWith('auto');\n\n    fireEvent.click(auto);\n    expect(runtimeMocks.mutate).toHaveBeenCalledWith('auto');"
)

print('dashboard final v1 applied')

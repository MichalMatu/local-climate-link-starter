import type {
  ClimateInstalledAutomation,
  InstalledAutomation
} from '../flows/installations/model.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import { installedAutomationHealth } from '../flows/installations/runtimeDiagnostics.js';
import {
  formatInstallationMetric,
  installationHealthLabel,
  INSTALLATION_MODE_KEYS,
  installationThresholdSummary
} from '../flows/installations/presentation.js';
import { installedAutomationScriptMatch } from '../flows/installations/runtimeControl.js';
import {
  useInstalledAutomationActions,
  useInstalledAutomationControl,
  useInstalledAutomationDiagnostics
} from '../flows/installations/useInstalledAutomationRuntime.js';
import { useTranslation } from '../app/i18n.js';
import { RefreshIconButton } from '../components/RefreshIconButton.js';
import { TimeAutomationCard } from './TimeAutomationCard.js';

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
  const manualControl = controlsVerified && controlStatus?.automationMode === 'manual';
  const relayState =
    controlStatus?.relayOn ??
    snapshot?.plug?.relayState ??
    snapshot?.diagnostics.relayState;

  const refresh = () => {
    void Promise.all([query.refetch(), control.refetch()]);
  };

  return (
    <article className="automation-card">
      <header className="automation-card__header">
        <div className="automation-card__identity">
          <div className="automation-status-row">
            {controlsVerified && controlStatus?.automationMode === 'manual' ? (
              <span className="automation-health automation-health--paused">
                {t('dashboard.health.paused')}
              </span>
            ) : controlMatch !== null && controlMatch !== 'matched' ? (
              <span className="automation-health automation-health--attention">
                {t('dashboard.health.attention')}
              </span>
            ) : query.isError ? (
              control.isPending ? (
                <span className="automation-health automation-health--unknown">
                  {t('dashboard.health.loading')}
                </span>
              ) : control.isError ? (
                <span className="automation-health automation-health--offline">
                  {t('dashboard.health.offline')}
                </span>
              ) : (
                <span className="automation-health automation-health--attention">
                  {t('dashboard.health.attention')}
                </span>
              )
            ) : query.isPending ? (
              <span className="automation-health automation-health--unknown">
                {t('dashboard.health.loading')}
              </span>
            ) : (
              <span
                className={`automation-health automation-health--${health ?? 'unknown'}`}
              >
                {installationHealthLabel(health ?? 'unknown', t)}
              </span>
            )}
            <span className="automation-status-mode">
              {t(INSTALLATION_MODE_KEYS[installation.config.rule.mode])}
            </span>
          </div>
          <h2>{installation.shelly.name}</h2>
        </div>
        <RefreshIconButton
          busy={query.isFetching || control.isFetching}
          label={t('common.refresh')}
          onRefresh={refresh}
        />
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
          <dt>{t('dashboard.output')}</dt>
          <dd>{relayState == null ? '—' : relayState ? 'ON' : 'OFF'}</dd>
        </div>
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
        <span>
          {query.isError
            ? t('dashboard.readFailed')
            : query.isFetching
              ? t('dashboard.refreshing')
              : t('dashboard.liveFromShelly')}
        </span>
        <div className="automation-card__actions">
          <div className="automation-card__controls">
            <div
              className="automation-control-group"
              role="group"
              aria-label={t('detail.automation')}
            >
              <button
                className="automation-control-button"
                type="button"
                aria-pressed={
                  controlsVerified && controlStatus?.automationMode === 'auto'
                }
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
              className="automation-control-group"
              role="group"
              aria-label={t('dashboard.output')}
            >
              <button
                className="automation-control-button"
                type="button"
                aria-pressed={manualControl && controlStatus?.relayOn === true}
                disabled={action.isPending || !manualControl}
                onClick={() => {
                  if (!controlStatus?.relayOn) action.mutate('on');
                }}
              >
                ON
              </button>
              <button
                className="automation-control-button"
                type="button"
                aria-pressed={manualControl && controlStatus?.relayOn === false}
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
            className="secondary-action"
            type="button"
            onClick={() => onOpen(installation.id)}
          >
            {t('dashboard.openSystem')}
          </button>
        </div>
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
};

export const AutomationDashboardScreen = ({
  onAddAutomation,
  onOpenInstallation
}: AutomationDashboardScreenProps) => {
  const { t } = useTranslation();
  const installations = useInstalledAutomationStore((state) => state.installations);

  return (
    <main className="demo-shell dashboard-shell">
      <header className="demo-header dashboard-header">
        <div>
          <h1>{t('dashboard.title')}</h1>
        </div>
        <button
          className="primary-action dashboard-add-action"
          type="button"
          onClick={onAddAutomation}
        >
          {t('dashboard.addAutomation')}
        </button>
      </header>

      <section className="dashboard-grid" aria-label={t('dashboard.systemsLabel')}>
        {installations.map((installation) => (
          <AutomationCard
            key={installation.id}
            installation={installation}
            onOpen={onOpenInstallation}
          />
        ))}
      </section>
    </main>
  );
};

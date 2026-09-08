import type { InstalledAutomation } from '../flows/installations/model.js';
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
  useInstalledAutomationControl,
  useInstalledAutomationDiagnostics
} from '../flows/installations/useInstalledAutomationRuntime.js';
import { useTranslation } from '../app/i18n.js';

type AutomationCardProps = {
  installation: InstalledAutomation;
  onOpen(installationId: string): void;
};

const AutomationCard = ({ installation, onOpen }: AutomationCardProps) => {
  const { t } = useTranslation();
  const query = useInstalledAutomationDiagnostics(installation);
  const controlFallback = useInstalledAutomationControl(installation, {
    enabled: query.isError
  });

  const snapshot = query.data;
  const health = snapshot ? installedAutomationHealth(snapshot) : null;
  const relayState = snapshot?.plug?.relayState ?? snapshot?.diagnostics.relayState;

  return (
    <article className="automation-card">
      <header className="automation-card__header">
        <div>
          <p className="automation-card__eyebrow">
            {t(INSTALLATION_MODE_KEYS[installation.config.rule.mode])}
          </p>
          <h2>{installation.shelly.name}</h2>
        </div>
        {query.isError ? (
          controlFallback.data &&
          installedAutomationScriptMatch(installation, controlFallback.data) ===
            'matched' &&
          controlFallback.data.automationMode === 'manual' ? (
            <span className="automation-health automation-health--paused">
              {t('dashboard.health.paused')}
            </span>
          ) : controlFallback.data ? (
            <span className="automation-health automation-health--attention">
              {t('dashboard.health.attention')}
            </span>
          ) : controlFallback.isPending ? (
            <span className="automation-health automation-health--unknown">
              {t('dashboard.health.loading')}
            </span>
          ) : (
            <span className="automation-health automation-health--offline">
              {t('dashboard.health.offline')}
            </span>
          )
        ) : query.isPending ? (
          <span className="automation-health automation-health--unknown">
            {t('dashboard.health.loading')}
          </span>
        ) : (
          <span className={`automation-health automation-health--${health ?? 'unknown'}`}>
            {installationHealthLabel(health ?? 'unknown', t)}
          </span>
        )}
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
          <button
            className="secondary-action"
            type="button"
            onClick={() => onOpen(installation.id)}
          >
            {t('dashboard.openSystem')}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('common.refresh')}
          </button>
        </div>
      </footer>
    </article>
  );
};

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
          <p className="demo-kicker">Local Climate Link</p>
          <h1>{t('dashboard.title')}</h1>
          <p>{t('dashboard.description')}</p>
        </div>
        <button className="primary-action" type="button" onClick={onAddAutomation}>
          {t('dashboard.addAutomation')}
        </button>
      </header>

      {installations.length === 0 ? (
        <section className="demo-panel dashboard-empty">
          <h2>{t('dashboard.emptyTitle')}</h2>
          <p>{t('dashboard.emptyDescription')}</p>
          <div className="action-row">
            <button className="primary-action" type="button" onClick={onAddAutomation}>
              {t('dashboard.configureFirst')}
            </button>
          </div>
        </section>
      ) : (
        <section className="dashboard-grid" aria-label={t('dashboard.systemsLabel')}>
          {installations.map((installation) => (
            <AutomationCard
              key={installation.id}
              installation={installation}
              onOpen={onOpenInstallation}
            />
          ))}
        </section>
      )}
    </main>
  );
};

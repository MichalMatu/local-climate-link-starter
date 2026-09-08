import { useQuery } from '@tanstack/react-query';
import type { RulePresetId } from '@lcl/automation-core';
import type { InstalledAutomation } from '../flows/installations/model.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import {
  fetchInstalledAutomationDiagnostics,
  installedAutomationHealth,
  type InstalledAutomationHealth
} from '../flows/installations/runtimeDiagnostics.js';
import { useTranslation, type Translate, type TranslationKey } from '../app/i18n.js';

const MODE_KEYS: Record<RulePresetId, TranslationKey> = {
  heating: 'hardware.rule.preset.heating',
  cooling: 'hardware.rule.preset.cooling',
  humidifying: 'hardware.rule.preset.humidifying',
  dehumidifying: 'hardware.rule.preset.dehumidifying'
};

const healthLabel = (health: InstalledAutomationHealth, t: Translate): string => {
  switch (health) {
    case 'ok':
      return t('dashboard.health.ok');
    case 'stale':
      return t('dashboard.health.stale');
    case 'unknown':
      return t('dashboard.health.unknown');
  }
};

const metricValue = (
  value: number | null | undefined,
  unit: string,
  digits = 1
): string =>
  value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(digits)}${unit}`;

const thresholdSummary = (
  installation: InstalledAutomation,
  effectiveOnThreshold?: number | null,
  effectiveOffThreshold?: number | null
): string => {
  const { metric, onThreshold, offThreshold } = installation.config.rule.control;
  const unit = metric === 'humidity' ? '%' : '°C';
  const activeOnThreshold =
    effectiveOnThreshold != null && Number.isFinite(effectiveOnThreshold)
      ? effectiveOnThreshold
      : onThreshold;
  const activeOffThreshold =
    effectiveOffThreshold != null && Number.isFinite(effectiveOffThreshold)
      ? effectiveOffThreshold
      : offThreshold;
  return `${activeOnThreshold}${unit} / ${activeOffThreshold}${unit}`;
};

type AutomationCardProps = {
  installation: InstalledAutomation;
};

const AutomationCard = ({ installation }: AutomationCardProps) => {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: [
      'installed-automation-diagnostics',
      installation.id,
      installation.shelly.baseUrl,
      installation.script.id,
      installation.script.hash,
      installation.updatedAtMs
    ],
    queryFn: () => fetchInstalledAutomationDiagnostics(installation),
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false
  });

  const snapshot = query.data;
  const health = snapshot ? installedAutomationHealth(snapshot) : null;
  const relayState = snapshot?.plug?.relayState ?? snapshot?.diagnostics.relayState;

  return (
    <article className="automation-card">
      <header className="automation-card__header">
        <div>
          <p className="automation-card__eyebrow">
            {t(MODE_KEYS[installation.config.rule.mode])}
          </p>
          <h2>{installation.shelly.name}</h2>
        </div>
        {query.isError ? (
          <span className="automation-health automation-health--offline">
            {t('dashboard.health.offline')}
          </span>
        ) : query.isPending ? (
          <span className="automation-health automation-health--unknown">
            {t('dashboard.health.loading')}
          </span>
        ) : (
          <span className={`automation-health automation-health--${health ?? 'unknown'}`}>
            {healthLabel(health ?? 'unknown', t)}
          </span>
        )}
      </header>

      <div className="automation-metrics" aria-label={t('dashboard.currentValues')}>
        <div>
          <span>{t('dashboard.temperature')}</span>
          <strong>{metricValue(snapshot?.diagnostics.lastTemp, '°C')}</strong>
        </div>
        <div>
          <span>{t('dashboard.humidity')}</span>
          <strong>{metricValue(snapshot?.diagnostics.lastHumidity, '%')}</strong>
        </div>
        <div>
          <span>{t('dashboard.vpd')}</span>
          <strong>{metricValue(snapshot?.diagnostics.lastVpd, ' kPa', 2)}</strong>
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
            {thresholdSummary(
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
        <button
          className="secondary-action"
          type="button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t('common.refresh')}
        </button>
      </footer>
    </article>
  );
};

type AutomationDashboardScreenProps = {
  onAddAutomation(): void;
};

export const AutomationDashboardScreen = ({
  onAddAutomation
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
            <AutomationCard key={installation.id} installation={installation} />
          ))}
        </section>
      )}
    </main>
  );
};

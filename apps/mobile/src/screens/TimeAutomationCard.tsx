import type { TimeInstalledAutomation } from '../flows/installations/model.js';
import { useTimeAutomationRuntime } from '../flows/time-automation/useTimeAutomationRuntime.js';
import { useTranslation } from '../app/i18n.js';

type TimeAutomationCardProps = {
  installation: TimeInstalledAutomation;
  onOpen(installationId: string): void;
};

const healthClass = (state: 'running' | 'paused' | 'attention' | 'offline' | 'loading') =>
  `automation-health automation-health--${
    state === 'running'
      ? 'ok'
      : state === 'paused'
        ? 'paused'
        : state === 'offline'
          ? 'offline'
          : state === 'loading'
            ? 'unknown'
            : 'attention'
  }`;

export const TimeAutomationCard = ({ installation, onOpen }: TimeAutomationCardProps) => {
  const { t } = useTranslation();
  const query = useTimeAutomationRuntime(installation);
  const state = query.isPending
    ? 'loading'
    : query.isError
      ? 'offline'
      : (query.data?.scheduleState ?? 'attention');
  const stateLabel =
    state === 'running'
      ? t('dashboard.health.ok')
      : state === 'paused'
        ? t('dashboard.health.paused')
        : state === 'offline'
          ? t('dashboard.health.offline')
          : state === 'loading'
            ? t('dashboard.health.loading')
            : t('dashboard.health.attention');

  return (
    <article className="automation-card">
      <header className="automation-card__header">
        <div>
          <p className="automation-card__eyebrow">{t('time.family')}</p>
          <h2>{installation.shelly.name}</h2>
        </div>
        <span className={healthClass(state)}>{stateLabel}</span>
      </header>

      <div className="automation-metrics" aria-label={t('time.scheduleSummary')}>
        <div>
          <span>{t('time.onTime')}</span>
          <strong>{installation.config.onTime}</strong>
        </div>
        <div>
          <span>{t('time.offTime')}</span>
          <strong>{installation.config.offTime}</strong>
        </div>
        <div>
          <span>{t('dashboard.output')}</span>
          <strong>{query.data ? (query.data.relayOn ? 'ON' : 'OFF') : '—'}</strong>
        </div>
      </div>

      <dl className="automation-summary">
        <div>
          <dt>{t('time.clock')}</dt>
          <dd>{query.data?.clock.localTime ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('time.owner')}</dt>
          <dd>{t('time.nativeSchedule')}</dd>
        </div>
      </dl>

      <footer className="automation-card__footer">
        <span>
          {query.isError
            ? t('dashboard.readFailed')
            : query.isFetching
              ? t('dashboard.refreshing')
              : t('time.liveFromShelly')}
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

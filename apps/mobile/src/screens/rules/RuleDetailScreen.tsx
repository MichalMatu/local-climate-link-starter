import { Modal } from '@lcl/ui';
import { useState } from 'react';
import { useTranslation } from '../../app/i18n.js';
import { useSensorStore } from '../../flows/registry/devicesAndRules.js';
import { useRuleRuntime, type RuleAction } from '../../flows/rules/useRuleRuntime.js';
import { RuleRuntimeControls } from './RuleRuntimeControls.js';
import {
  ruleContextKey,
  ruleScheduleSummary,
  ruleThresholdSummary
} from './rulePresentation.js';
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
      return snapshot.mode === 'auto'
        ? 'AUTO'
        : snapshot.mode === 'manual'
          ? 'MANUAL'
          : t('common.unknown');
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

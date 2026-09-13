import {
  IconAlertTriangle,
  IconClock,
  IconDotsVertical,
  IconTemperature
} from '@tabler/icons-react';
import { useTranslation } from '../../app/i18n.js';
import type { AutomationRule } from '../../flows/rules/model.js';
import { useRuleRuntime } from '../../flows/rules/useRuleRuntime.js';
import {
  ruleContextKey,
  ruleScheduleSummary,
  ruleThresholdSummary
} from './rulePresentation.js';

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
      return {
        label: t('dashboard.health.loading'),
        tone: 'loading'
      } satisfies RuleCardStatus;
    }
    if (runtime.isError) {
      return {
        label: t('dashboard.health.offline'),
        tone: 'offline'
      } satisfies RuleCardStatus;
    }
    if (!snapshot) {
      return {
        label: t('dashboard.health.unknown'),
        tone: 'unknown'
      } satisfies RuleCardStatus;
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
        ? ({
            label: t('dashboard.health.paused'),
            tone: 'paused'
          } satisfies RuleCardStatus)
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
          <dt>
            {rule.kind === 'climate' ? t('dashboard.sensor') : t('time.scheduleSummary')}
          </dt>
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
        <div
          className={`automation-card__status automation-card__status--${status.tone}`}
        >
          {(status.tone === 'attention' || status.tone === 'offline') && (
            <IconAlertTriangle aria-hidden="true" />
          )}
          <span>{action.isPending ? t('detail.changingState') : status.label}</span>
        </div>
      </footer>
    </article>
  );
};

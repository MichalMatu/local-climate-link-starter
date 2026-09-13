import { useTranslation } from '../../app/i18n.js';
import type { AutomationRule } from '../../flows/rules/model.js';
import type { RuleRuntimeSnapshot } from '../../flows/rules/lifecycle.js';
import type { RuleAction } from '../../flows/rules/useRuleRuntime.js';

type RuleRuntimeControlsProps = {
  rule: AutomationRule;
  snapshot: RuleRuntimeSnapshot | undefined;
  busy: boolean;
  onAction(action: RuleAction): void;
  onRefresh(): void;
};

export const RuleRuntimeControls = ({
  rule,
  snapshot,
  busy,
  onAction,
  onRefresh
}: RuleRuntimeControlsProps) => {
  const { t } = useTranslation();

  if (!rule.deployment) {
    return (
      <button
        className="primary-action"
        type="button"
        disabled={busy}
        onClick={() => onAction('deploy')}
      >
        {t('common.send')}
      </button>
    );
  }

  if (rule.kind === 'climate') {
    if (rule.deployment.safetyTest.status !== 'verified') {
      return (
        <button
          className="primary-action"
          type="button"
          disabled={busy}
          onClick={() => onAction('verify')}
        >
          {busy ? t('common.testing') : t('common.test')}
        </button>
      );
    }
    if (!snapshot || !('mode' in snapshot)) {
      return (
        <button
          className="secondary-action"
          type="button"
          disabled={busy}
          onClick={onRefresh}
        >
          {t('common.refresh')}
        </button>
      );
    }
    const exact = snapshot.scriptMatch === 'matched' && snapshot.modeSupported;
    return (
      <>
        <div
          className="automation-control-group"
          role="group"
          aria-label={t('detail.automation')}
        >
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={exact && snapshot.mode === 'auto'}
            disabled={busy || !exact || snapshot.mode !== 'manual'}
            onClick={() => onAction('resume')}
          >
            AUTO
          </button>
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={exact && snapshot.mode === 'manual'}
            disabled={busy || !exact || snapshot.mode !== 'auto'}
            onClick={() => onAction('pause')}
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
            aria-pressed={snapshot.relayOn}
            disabled={busy || !exact || snapshot.mode !== 'manual'}
            onClick={() => onAction('relay-on')}
          >
            ON
          </button>
          <button
            className="automation-relay-button"
            type="button"
            aria-pressed={!snapshot.relayOn}
            disabled={busy || !exact || snapshot.mode !== 'manual'}
            onClick={() => onAction('relay-off')}
          >
            OFF
          </button>
        </div>
      </>
    );
  }

  if (!snapshot || !('scheduleState' in snapshot)) {
    return (
      <button
        className="secondary-action"
        type="button"
        disabled={busy}
        onClick={onRefresh}
      >
        {t('common.refresh')}
      </button>
    );
  }
  if (snapshot.scheduleState === 'attention' || snapshot.scheduleState === 'undeployed') {
    return (
      <button
        className="primary-action"
        type="button"
        disabled={busy}
        onClick={() => onAction('recover')}
      >
        {t('common.refresh')}
      </button>
    );
  }
  return snapshot.scheduleState === 'running' ? (
    <button
      className="secondary-action"
      type="button"
      disabled={busy}
      onClick={() => onAction('pause')}
    >
      {t('detail.pause')}
    </button>
  ) : (
    <button
      className="primary-action"
      type="button"
      disabled={busy}
      onClick={() => onAction('resume')}
    >
      {t('detail.resume')}
    </button>
  );
};

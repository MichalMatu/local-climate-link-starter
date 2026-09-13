import { useTranslation } from '../../app/i18n.js';
import type { SetupIntent } from '../../flows/setup-intent.js';
import { useRuleEditorFlow } from '../../flows/rules/useRuleEditorFlow.js';
import { RuleIdentityFields } from './editor/RuleIdentityFields.js';
import { RuleScheduleFields } from './editor/RuleScheduleFields.js';
import { RuleThresholdFields } from './editor/RuleThresholdFields.js';

type RuleEditorScreenProps = {
  intent?: SetupIntent;
  ruleId?: string;
  onCancel(): void;
  onComplete(ruleId: string): void;
};

export const RuleEditorScreen = ({
  intent,
  ruleId,
  onCancel,
  onComplete
}: RuleEditorScreenProps) => {
  const { t } = useTranslation();
  const flow = useRuleEditorFlow({
    ...(intent ? { intent } : {}),
    ...(ruleId ? { ruleId } : {})
  });

  if (!flow.intent || (ruleId && !flow.existing)) {
    return (
      <main className="demo-shell hardware-shell app-bottom-nav-shell">
        <header className="demo-header app-page-header">
          <h1>{t('detail.notFoundTitle')}</h1>
        </header>
        <button className="secondary-action" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </main>
    );
  }

  const save = async () => {
    try {
      const rule = await flow.save.mutateAsync();
      onComplete(rule.id);
    } catch {
      // Mutation state keeps the failure visible and the draft editable.
    }
  };

  return (
    <main className="demo-shell hardware-shell app-bottom-nav-shell">
      <div className="setup-context">
        <button className="setup-context__back" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <strong>{t(`intent.${flow.intent}.context`)}</strong>
      </div>

      <section className="demo-panel" aria-label={t('hardware.nav.ruleTitle')}>
        <RuleIdentityFields
          intent={flow.intent}
          state={flow.state}
          errors={flow.errors}
          plugs={flow.plugs}
          sensors={flow.sensors}
          update={flow.update}
          setPreset={flow.setPreset}
        />

        {flow.intent !== 'time' && (
          <RuleThresholdFields
            state={flow.state}
            errors={flow.errors}
            update={flow.update}
          />
        )}

        <RuleScheduleFields
          intent={flow.intent}
          state={flow.state}
          errors={flow.errors}
          update={flow.update}
          toggleDay={flow.toggleDay}
        />

        {flow.save.isError && (
          <p className="field__error">{t('common.operationFailed')}</p>
        )}

        <div className="action-row">
          <button
            className="primary-action"
            type="button"
            disabled={!flow.canSubmit}
            aria-busy={flow.save.isPending}
            onClick={() => void save()}
          >
            {flow.save.isPending
              ? t('common.sending')
              : flow.existing
                ? t('time.detail.save')
                : flow.intent === 'time'
                  ? t('time.install')
                  : t('common.send')}
          </button>
        </div>
      </section>
    </main>
  );
};

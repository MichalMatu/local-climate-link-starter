import type { RuleSetupFlow } from '../pageContracts.js';
import { useTranslation } from '../../../app/i18n.js';
import {
  DEFAULT_RULE_ADVANCED_SETTINGS,
  RULE_ADVANCED_LIMITS,
  validateRuleAdvancedSettings
} from '../../../flows/hardware-setup/ruleAdvancedSettings.js';

export const RuleAdvancedSettingsInline = ({ flow }: { flow: RuleSetupFlow }) => {
  const { t } = useTranslation();
  const validation = validateRuleAdvancedSettings({
    vpdAssistEnabled: flow.vpdAssistEnabled,
    vpdTargetInput: flow.vpdTargetInput,
    rssiMinInput: flow.rssiMinInput,
    staleTimeoutMinInput: flow.staleTimeoutMinInput,
    minChangeMinInput: flow.minChangeMinInput,
    maxOnHoursInput: flow.maxOnHoursInput
  });

  const resetDefaults = () => {
    flow.setRssiMinInput(DEFAULT_RULE_ADVANCED_SETTINGS.rssiMinInput);
    flow.setStaleTimeoutMinInput(DEFAULT_RULE_ADVANCED_SETTINGS.staleTimeoutMinInput);
    flow.setMinChangeMinInput(DEFAULT_RULE_ADVANCED_SETTINGS.minChangeMinInput);
    flow.setMaxOnHoursInput(DEFAULT_RULE_ADVANCED_SETTINGS.maxOnHoursInput);
  };

  return (
    <div className="rule-progressive-disclosure__body rule-advanced-inline">
      <p>{t('hardware.rule.advancedDisclosureHint')}</p>
      <div className="rule-advanced-inline__grid">
        <label
          className={`rule-advanced-inline__field ${
            validation.isMinChangeMinValid ? '' : 'field--invalid'
          }`}
        >
          <span>{t('hardware.rule.minChangeLabel')}</span>
          <input
            aria-describedby={
              validation.isMinChangeMinValid ? undefined : 'advanced-min-change-error'
            }
            aria-invalid={!validation.isMinChangeMinValid}
            max={RULE_ADVANCED_LIMITS.minChangeMinMax}
            min={RULE_ADVANCED_LIMITS.minChangeMinMin}
            step="0.25"
            type="number"
            value={flow.minChangeMinInput}
            onChange={(event) => flow.setMinChangeMinInput(event.currentTarget.value)}
          />
          {!validation.isMinChangeMinValid && (
            <span
              className="field__error rule-advanced-inline__error"
              id="advanced-min-change-error"
            >
              {t('hardware.rule.range.minChange')}
            </span>
          )}
        </label>
        <label
          className={`rule-advanced-inline__field ${
            validation.isMaxOnHoursValid ? '' : 'field--invalid'
          }`}
        >
          <span>{t('hardware.rule.maxOnHoursLabel')}</span>
          <input
            aria-describedby={
              validation.isMaxOnHoursValid ? undefined : 'advanced-max-on-error'
            }
            aria-invalid={!validation.isMaxOnHoursValid}
            max={RULE_ADVANCED_LIMITS.maxOnHoursMax}
            min={RULE_ADVANCED_LIMITS.maxOnHoursMin}
            step="0.25"
            type="number"
            value={flow.maxOnHoursInput}
            onChange={(event) => flow.setMaxOnHoursInput(event.currentTarget.value)}
          />
          {!validation.isMaxOnHoursValid && (
            <span
              className="field__error rule-advanced-inline__error"
              id="advanced-max-on-error"
            >
              {t('hardware.rule.range.maxOn')}
            </span>
          )}
        </label>
      </div>
      <div className="advanced-settings__readonly rule-advanced-inline__readonly">
        <span>{t('hardware.rule.bootBehavior')}</span>
        <strong>{t('hardware.rule.bootBehaviorValue')}</strong>
      </div>
      <div className="rule-advanced-inline__grid rule-advanced-inline__grid--resilience">
        <label
          className={`rule-advanced-inline__field ${
            validation.isStaleTimeoutValid ? '' : 'field--invalid'
          }`}
        >
          <span>{t('hardware.rule.staleTimeoutLabel')}</span>
          <input
            aria-describedby={
              validation.isStaleTimeoutValid ? undefined : 'advanced-stale-error'
            }
            aria-invalid={!validation.isStaleTimeoutValid}
            max={RULE_ADVANCED_LIMITS.staleTimeoutMinMax}
            min={RULE_ADVANCED_LIMITS.staleTimeoutMinMin}
            step="1"
            type="number"
            value={flow.staleTimeoutMinInput}
            onChange={(event) => flow.setStaleTimeoutMinInput(event.currentTarget.value)}
          />
          {!validation.isStaleTimeoutValid && (
            <span
              className="field__error rule-advanced-inline__error"
              id="advanced-stale-error"
            >
              {t('hardware.rule.range.stale')}
            </span>
          )}
        </label>
        <label
          className={`rule-advanced-inline__field ${
            validation.isRssiMinValid ? '' : 'field--invalid'
          }`}
        >
          <span>{t('hardware.rule.rssiMinLabel')}</span>
          <input
            aria-describedby={
              validation.isRssiMinValid ? undefined : 'advanced-rssi-error'
            }
            aria-invalid={!validation.isRssiMinValid}
            max={RULE_ADVANCED_LIMITS.rssiMinMax}
            min={RULE_ADVANCED_LIMITS.rssiMinMin}
            step="1"
            type="number"
            value={flow.rssiMinInput}
            onChange={(event) => flow.setRssiMinInput(event.currentTarget.value)}
          />
          {!validation.isRssiMinValid && (
            <span
              className="field__error rule-advanced-inline__error"
              id="advanced-rssi-error"
            >
              {t('hardware.rule.range.rssi')}
            </span>
          )}
        </label>
      </div>
      <button
        className="rule-advanced-defaults-link"
        type="button"
        title={t('hardware.rule.advancedDefaultsTitle')}
        onClick={resetDefaults}
      >
        {t('common.default')}
      </button>
    </div>
  );
};

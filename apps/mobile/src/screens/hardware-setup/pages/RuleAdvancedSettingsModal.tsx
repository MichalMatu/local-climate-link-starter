import { Modal } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';
import {
  RULE_ADVANCED_LIMITS,
  type RuleAdvancedSettingsInput,
  validateRuleAdvancedSettings
} from '../../../flows/hardware-setup/ruleAdvancedSettings.js';

type RuleAdvancedSettingsModalProps = {
  draft: RuleAdvancedSettingsInput;
  open: boolean;
  onApply: () => void;
  onChange: (patch: Partial<RuleAdvancedSettingsInput>) => void;
  onClose: () => void;
  onReset: () => void;
};

export const RuleAdvancedSettingsModal = ({
  draft,
  open,
  onApply,
  onChange,
  onClose,
  onReset
}: RuleAdvancedSettingsModalProps) => {
  const { t } = useTranslation();
  const validation = validateRuleAdvancedSettings(draft);

  return (
    <Modal
      actions={
        <>
          <button
            className="secondary-action"
            type="button"
            title={t('hardware.rule.advancedDefaultsTitle')}
            onClick={onReset}
          >
            {t('common.default')}
          </button>
          <button
            className="primary-action"
            type="button"
            disabled={!validation.isValid}
            title={t('hardware.rule.advancedApplyTitle')}
            onClick={onApply}
          >
            {t('common.apply')}
          </button>
        </>
      }
      closeLabel={t('common.close')}
      open={open}
      title={t('hardware.rule.advancedTitle')}
      onClose={onClose}
    >
      <div className="advanced-settings">
        <section className="advanced-settings__section">
          <div className="field-row">
            <label
              className={`field ${validation.isMinChangeMinValid ? '' : 'field--invalid'}`}
            >
              {t('hardware.rule.minChangeLabel')}
              <input
                aria-describedby={
                  validation.isMinChangeMinValid ? undefined : 'advanced-min-change-error'
                }
                aria-invalid={!validation.isMinChangeMinValid}
                max={RULE_ADVANCED_LIMITS.minChangeMinMax}
                min={RULE_ADVANCED_LIMITS.minChangeMinMin}
                step="0.25"
                type="number"
                value={draft.minChangeMinInput}
                onChange={(event) =>
                  onChange({ minChangeMinInput: event.currentTarget.value })
                }
              />
              {!validation.isMinChangeMinValid && (
                <span className="field__error" id="advanced-min-change-error">
                  {t('hardware.rule.range.minChange')}
                </span>
              )}
            </label>
            <label
              className={`field ${validation.isMaxOnHoursValid ? '' : 'field--invalid'}`}
            >
              {t('hardware.rule.maxOnHoursLabel')}
              <input
                aria-describedby={
                  validation.isMaxOnHoursValid ? undefined : 'advanced-max-on-error'
                }
                aria-invalid={!validation.isMaxOnHoursValid}
                max={RULE_ADVANCED_LIMITS.maxOnHoursMax}
                min={RULE_ADVANCED_LIMITS.maxOnHoursMin}
                step="0.25"
                type="number"
                value={draft.maxOnHoursInput}
                onChange={(event) =>
                  onChange({ maxOnHoursInput: event.currentTarget.value })
                }
              />
              {!validation.isMaxOnHoursValid && (
                <span className="field__error" id="advanced-max-on-error">
                  {t('hardware.rule.range.maxOn')}
                </span>
              )}
            </label>
          </div>
          <div className="advanced-settings__readonly">
            <span>{t('hardware.rule.bootBehavior')}</span>
            <strong>{t('hardware.rule.bootBehaviorValue')}</strong>
          </div>
        </section>

        <section className="advanced-settings__section">
          <div className="field-row">
            <label
              className={`field ${validation.isStaleTimeoutValid ? '' : 'field--invalid'}`}
            >
              {t('hardware.rule.staleTimeoutLabel')}
              <input
                aria-describedby={
                  validation.isStaleTimeoutValid ? undefined : 'advanced-stale-error'
                }
                aria-invalid={!validation.isStaleTimeoutValid}
                max={RULE_ADVANCED_LIMITS.staleTimeoutMinMax}
                min={RULE_ADVANCED_LIMITS.staleTimeoutMinMin}
                step="1"
                type="number"
                value={draft.staleTimeoutMinInput}
                onChange={(event) =>
                  onChange({ staleTimeoutMinInput: event.currentTarget.value })
                }
              />
              {!validation.isStaleTimeoutValid && (
                <span className="field__error" id="advanced-stale-error">
                  {t('hardware.rule.range.stale')}
                </span>
              )}
            </label>
            <label
              className={`field ${validation.isRssiMinValid ? '' : 'field--invalid'}`}
            >
              {t('hardware.rule.rssiMinLabel')}
              <input
                aria-describedby={
                  validation.isRssiMinValid ? undefined : 'advanced-rssi-error'
                }
                aria-invalid={!validation.isRssiMinValid}
                max={RULE_ADVANCED_LIMITS.rssiMinMax}
                min={RULE_ADVANCED_LIMITS.rssiMinMin}
                step="1"
                type="number"
                value={draft.rssiMinInput}
                onChange={(event) =>
                  onChange({ rssiMinInput: event.currentTarget.value })
                }
              />
              {!validation.isRssiMinValid && (
                <span className="field__error" id="advanced-rssi-error">
                  {t('hardware.rule.range.rssi')}
                </span>
              )}
            </label>
          </div>
        </section>
      </div>
    </Modal>
  );
};

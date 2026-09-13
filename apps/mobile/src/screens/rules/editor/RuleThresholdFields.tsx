import type { RulePresetId } from '@lcl/automation-core';
import { useTranslation, type TranslationKey } from '../../../app/i18n.js';
import type { RuleEditorErrors, RuleEditorState } from '../../../flows/rules/editor.js';

const thresholdCopy: Record<RulePresetId, { on: TranslationKey; off: TranslationKey }> = {
  heating: {
    on: 'hardware.rule.thresholdOnBelowC',
    off: 'hardware.rule.thresholdOffAboveC'
  },
  cooling: {
    on: 'hardware.rule.thresholdOnAboveC',
    off: 'hardware.rule.thresholdOffBelowC'
  },
  humidifying: {
    on: 'hardware.rule.thresholdOnBelowPct',
    off: 'hardware.rule.thresholdOffAbovePct'
  },
  dehumidifying: {
    on: 'hardware.rule.thresholdOnAbovePct',
    off: 'hardware.rule.thresholdOffBelowPct'
  }
};

export const RuleThresholdFields = ({
  state,
  errors,
  update
}: {
  state: RuleEditorState;
  errors: RuleEditorErrors;
  update<K extends keyof RuleEditorState>(key: K, value: RuleEditorState[K]): void;
}) => {
  const { t } = useTranslation();
  const copy = thresholdCopy[state.preset];
  return (
    <div className="field-row">
      <label className={errors.thresholds ? 'field field--invalid' : 'field'}>
        {t(copy.on)}
        <input
          type="number"
          step="0.1"
          value={state.onThresholdInput}
          aria-invalid={Boolean(errors.thresholds)}
          onChange={(event) => update('onThresholdInput', event.currentTarget.value)}
        />
      </label>
      <label className={errors.thresholds ? 'field field--invalid' : 'field'}>
        {t(copy.off)}
        <input
          type="number"
          step="0.1"
          value={state.offThresholdInput}
          aria-invalid={Boolean(errors.thresholds)}
          onChange={(event) => update('offThresholdInput', event.currentTarget.value)}
        />
        {errors.thresholds && (
          <span className="field__error">{t('hardware.rule.thresholdInvalid')}</span>
        )}
      </label>
    </div>
  );
};

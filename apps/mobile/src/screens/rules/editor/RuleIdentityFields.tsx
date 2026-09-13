import type { RulePresetId } from '@lcl/automation-core';
import { useTranslation, type TranslationKey } from '../../../app/i18n.js';
import type { SavedPlug } from '../../../flows/devices/plugs/model.js';
import type { SavedSensor } from '../../../flows/devices/sensors/model.js';
import {
  rulePresetsForSetupIntent,
  type SetupIntent
} from '../../../flows/setup-intent.js';
import type { RuleEditorErrors, RuleEditorState } from '../../../flows/rules/editor.js';

const presetLabel: Record<RulePresetId, TranslationKey> = {
  heating: 'hardware.rule.preset.heating',
  cooling: 'hardware.rule.preset.cooling',
  humidifying: 'hardware.rule.preset.humidifying',
  dehumidifying: 'hardware.rule.preset.dehumidifying'
};

type RuleIdentityFieldsProps = {
  intent: SetupIntent;
  state: RuleEditorState;
  errors: RuleEditorErrors;
  plugs: readonly SavedPlug[];
  sensors: readonly SavedSensor[];
  update<K extends keyof RuleEditorState>(key: K, value: RuleEditorState[K]): void;
  setPreset(preset: RulePresetId): void;
};

export const RuleIdentityFields = ({
  intent,
  state,
  errors,
  plugs,
  sensors,
  update,
  setPreset
}: RuleIdentityFieldsProps) => {
  const { t } = useTranslation();
  return (
    <>
      <label className={errors.name ? 'field field--invalid' : 'field'}>
        {t('hardware.shelly.nameLabel')}
        <input
          value={state.name}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => update('name', event.currentTarget.value)}
        />
        {errors.name && <span className="field__error">{t('common.missing')}</span>}
      </label>

      <label className={errors.plug ? 'field field--invalid' : 'field'}>
        {t('hardware.rule.selectedShelly')}
        <span className="select-control">
          <select
            value={state.plugId}
            aria-invalid={Boolean(errors.plug)}
            onChange={(event) => update('plugId', event.currentTarget.value)}
          >
            <option value="">{t('time.noDevice')}</option>
            {plugs.map((plug) => (
              <option key={plug.id} value={plug.id}>
                {plug.name}
              </option>
            ))}
          </select>
        </span>
        {errors.plug && (
          <span className="field__error">{t('common.operationFailed')}</span>
        )}
      </label>

      {intent !== 'time' && (
        <>
          <label className={errors.sensor ? 'field field--invalid' : 'field'}>
            {t('hardware.rule.selectedSensor')}
            <span className="select-control">
              <select
                value={state.sensorId}
                aria-invalid={Boolean(errors.sensor)}
                onChange={(event) => update('sensorId', event.currentTarget.value)}
              >
                <option value="">{t('hardware.flow.noSelectedSensor')}</option>
                {sensors.map((sensor) => (
                  <option key={sensor.id} value={sensor.id}>
                    {sensor.name}
                  </option>
                ))}
              </select>
            </span>
            {errors.sensor && <span className="field__error">{t('common.missing')}</span>}
          </label>

          <label className="field">
            {t('hardware.rule.ruleMode')}
            <span className="select-control">
              <select
                value={state.preset}
                onChange={(event) => setPreset(event.currentTarget.value as RulePresetId)}
              >
                {rulePresetsForSetupIntent(intent).map((preset) => (
                  <option key={preset} value={preset}>
                    {t(presetLabel[preset])}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </>
      )}
    </>
  );
};

import type { ShellyPlugsUiLedMode } from '@lcl/shelly-client';
import { SelectField } from '@lcl/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import { deviceLedCopy } from '../../../app/locales/deviceLed.js';
import {
  buildPlugLedSettingsPatch,
  createPlugLedSettingsDraft,
  type PlugLedSettingsDraft
} from '../data/plugLedSettingsForm.js';
import type { PlugLedSettingsTarget } from '../data/plugLedSettings.js';
import { usePlugLedSettingsFlow } from '../flows/usePlugLedSettingsFlow.js';
import { PlugLedColorEditor } from './PlugLedColorEditor.js';
import './PlugSettingsSurface.css';

export type PlugLedSettingsCardProps = {
  target: PlugLedSettingsTarget;
};

const percentValue = (value: string): number =>
  Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 0));

const ON_DEFAULT_RGB: [number, number, number] = [0, 100, 0];
const OFF_DEFAULT_RGB: [number, number, number] = [100, 0, 0];

export const PlugLedSettingsCard = ({ target }: PlugLedSettingsCardProps) => {
  const { locale, t } = useTranslation();
  const copy = deviceLedCopy[locale];
  const { query, updateMutation } = usePlugLedSettingsFlow(target);
  const settings = query.data;
  const config = settings?.supported ? settings.config.leds : null;
  const capabilities = settings?.supported ? settings.capabilities : null;
  const [baseline, setBaseline] = useState(config);
  const [draft, setDraft] = useState<PlugLedSettingsDraft | null>(() =>
    config ? createPlugLedSettingsDraft(config) : null
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const patch = useMemo(() => {
    if (!baseline || !capabilities || !draft) return null;
    return buildPlugLedSettingsPatch({ original: baseline, draft, capabilities });
  }, [baseline, capabilities, draft]);
  const dirty = patch !== null;

  useEffect(() => {
    if (!config || dirty) return;
    setBaseline(config);
    setDraft(createPlugLedSettingsDraft(config));
  }, [config, dirty]);

  const updateDraft = (
    update: (current: PlugLedSettingsDraft) => PlugLedSettingsDraft
  ) => {
    setFeedback(null);
    setDraft((current) => (current ? update(current) : current));
  };

  const save = () => {
    if (!patch) {
      setFeedback(copy.noChanges);
      return;
    }
    setFeedback(null);
    updateMutation.mutate(patch, {
      onSuccess: (confirmed) => {
        if (confirmed.supported) {
          setBaseline(confirmed.config.leds);
          setDraft(createPlugLedSettingsDraft(confirmed.config.leds));
        }
        setFeedback(copy.saved);
      },
      onError: () => setFeedback(copy.actionFailed)
    });
  };

  if (query.isPending) {
    return (
      <section className="plug-settings-section installation-detail-device-led">
        <h2>{copy.title}</h2>
        <div className="plug-detail-loading" role="status">
          <span className="plug-detail-loading__spinner" aria-hidden="true" />
          <span>{copy.loading}</span>
        </div>
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className="plug-settings-section installation-detail-device-led">
        <h2>{copy.title}</h2>
        <p className="plug-settings-feedback plug-settings-feedback--warning">
          {copy.unavailable}
        </p>
      </section>
    );
  }
  if (!settings?.supported || !config || !capabilities || !draft) {
    return (
      <section className="plug-settings-section installation-detail-device-led">
        <h2>{copy.title}</h2>
        <p className="plug-settings-feedback">{copy.unsupported}</p>
      </section>
    );
  }

  const setMode = (mode: ShellyPlugsUiLedMode) =>
    updateDraft((current) => ({ ...current, mode }));
  const setPercent = (field: keyof PlugLedSettingsDraft, value: string) =>
    updateDraft((current) => ({ ...current, [field]: percentValue(value) }));
  const setNightModeEnabled = (nightModeEnabled: boolean) =>
    updateDraft((current) => ({ ...current, nightModeEnabled }));
  const setNightTime = (field: 'nightStart' | 'nightEnd', value: string) =>
    updateDraft((current) => ({ ...current, [field]: value }));

  return (
    <section className="plug-settings-section installation-detail-device-led">
      <div className="plug-settings-section__heading">
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>

      <div className="field">
        <span>{copy.currentMode}</span>
        <SelectField<ShellyPlugsUiLedMode>
          ariaLabel={copy.currentMode}
          value={draft.mode}
          options={[
            { value: 'power', label: copy.power },
            { value: 'switch', label: copy.switch },
            { value: 'off', label: copy.off }
          ]}
          onChange={setMode}
        />
      </div>

      {capabilities.powerBrightness && draft.mode === 'power' && (
        <label className="field">
          <span>{copy.powerBrightness}</span>
          <span className="field-unit-control">
            <input
              aria-label={copy.powerBrightness}
              inputMode="numeric"
              max="100"
              min="0"
              type="number"
              value={draft.powerBrightness}
              onChange={(event) => setPercent('powerBrightness', event.target.value)}
            />
            <span className="field-unit-control__unit" aria-hidden="true">
              %
            </span>
          </span>
        </label>
      )}

      {capabilities.switchColors && draft.mode === 'switch' && (
        <div className="plug-led-state-stack">
          {(['on', 'off'] as const).map((state) => {
            const isOn = state === 'on';
            const rgb = isOn ? draft.switchOnRgb : draft.switchOffRgb;
            const brightness = isOn
              ? draft.switchOnBrightness
              : draft.switchOffBrightness;
            const stateLabel = isOn ? copy.onState : copy.offState;
            const colorField = isOn ? 'switchOnRgb' : 'switchOffRgb';
            return (
              <fieldset className="plug-led-state" key={state}>
                <legend>{stateLabel}</legend>
                <PlugLedColorEditor
                  ariaPrefix={stateLabel}
                  colorLabel={copy.color}
                  defaultLabel={copy.defaultColor}
                  customLabel={copy.customColor}
                  customTitle={copy.customColorTitle}
                  hueLabel={copy.hue}
                  saturationLabel={copy.saturation}
                  lightnessLabel={copy.lightness}
                  applyLabel={copy.applyColor}
                  cancelLabel={t('common.cancel')}
                  fallbackValue={isOn ? ON_DEFAULT_RGB : OFF_DEFAULT_RGB}
                  value={rgb}
                  onChange={(nextRgb) =>
                    updateDraft((current) => ({ ...current, [colorField]: nextRgb }))
                  }
                />

                <label className="field">
                  <span>{copy.brightness}</span>
                  <span className="field-unit-control">
                    <input
                      aria-label={`${stateLabel} ${copy.brightness}`}
                      inputMode="numeric"
                      max="100"
                      min="0"
                      type="number"
                      value={brightness}
                      onChange={(event) =>
                        setPercent(
                          isOn ? 'switchOnBrightness' : 'switchOffBrightness',
                          event.target.value
                        )
                      }
                    />
                    <span className="field-unit-control__unit" aria-hidden="true">
                      %
                    </span>
                  </span>
                </label>
              </fieldset>
            );
          })}
        </div>
      )}

      {capabilities.nightMode && (
        <fieldset className="plug-night-mode">
          <legend>{copy.nightMode}</legend>
          <label className="plug-settings-check-row">
            <span>{copy.nightModeEnabled}</span>
            <input
              aria-label={copy.nightModeEnabled}
              checked={draft.nightModeEnabled}
              type="checkbox"
              onChange={(event) => setNightModeEnabled(event.currentTarget.checked)}
            />
          </label>
          <label className="field">
            <span>{copy.nightBrightness}</span>
            <span className="field-unit-control">
              <input
                aria-label={copy.nightBrightness}
                disabled={!draft.nightModeEnabled}
                inputMode="numeric"
                max="100"
                min="0"
                type="number"
                value={draft.nightBrightness}
                onChange={(event) => setPercent('nightBrightness', event.target.value)}
              />
              <span className="field-unit-control__unit" aria-hidden="true">
                %
              </span>
            </span>
          </label>
          <div className="time-schedule-grid plug-night-mode__times">
            <label className="field">
              <span>{copy.nightStart}</span>
              <input
                className="plug-time-input"
                aria-label={copy.nightStart}
                disabled={!draft.nightModeEnabled}
                type="time"
                value={draft.nightStart}
                onChange={(event) =>
                  setNightTime('nightStart', event.currentTarget.value)
                }
              />
            </label>
            <label className="field">
              <span>{copy.nightEnd}</span>
              <input
                className="plug-time-input"
                aria-label={copy.nightEnd}
                disabled={!draft.nightModeEnabled}
                type="time"
                value={draft.nightEnd}
                onChange={(event) => setNightTime('nightEnd', event.currentTarget.value)}
              />
            </label>
          </div>
        </fieldset>
      )}

      {feedback && (
        <p role="status" className="plug-settings-feedback">
          {feedback}
        </p>
      )}

      <button
        className="primary-action plug-settings-save"
        type="button"
        disabled={!patch || updateMutation.isPending}
        onClick={save}
      >
        {updateMutation.isPending ? copy.saving : copy.save}
      </button>
    </section>
  );
};

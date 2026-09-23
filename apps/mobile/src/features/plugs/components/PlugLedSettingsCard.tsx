import type { ShellyPlugsUiLedMode } from '@lcl/shelly-client';
import { SelectField, ToggleSwitch } from '@lcl/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import { deviceLedCopy } from '../../../app/locales/deviceLed.js';
import {
  buildPlugLedSettingsPatch,
  createPlugLedSettingsDraft
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
  const { locale } = useTranslation();
  const copy = deviceLedCopy[locale];
  const { query, updateMutation } = usePlugLedSettingsFlow(target);
  const settings = query.data;
  const config = settings?.supported ? settings.config.leds : null;
  const capabilities = settings?.supported ? settings.capabilities : null;
  const [draft, setDraft] = useState(() =>
    config ? createPlugLedSettingsDraft(config) : null
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    setDraft(createPlugLedSettingsDraft(config));
  }, [config]);

  const patch = useMemo(() => {
    if (!config || !capabilities || !draft) return null;
    return buildPlugLedSettingsPatch({ original: config, draft, capabilities });
  }, [capabilities, config, draft]);

  const save = () => {
    if (!patch) {
      setFeedback(copy.noChanges);
      return;
    }
    setFeedback(null);
    updateMutation.mutate(patch, {
      onSuccess: () => setFeedback(copy.saved),
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

  const setMode = (mode: ShellyPlugsUiLedMode) => {
    setFeedback(null);
    setDraft((current) => current && { ...current, mode });
  };
  const setPercent = (field: keyof typeof draft, value: string) =>
    setDraft((current) => current && { ...current, [field]: percentValue(value) });

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
          <input
            aria-label={copy.powerBrightness}
            inputMode="numeric"
            type="number"
            min="0"
            max="100"
            value={draft.powerBrightness}
            onChange={(event) => setPercent('powerBrightness', event.target.value)}
          />
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
                <ToggleSwitch
                  checked={rgb !== null}
                  onChange={(checked) =>
                    setDraft(
                      (current) =>
                        current && {
                          ...current,
                          [colorField]: checked
                            ? isOn
                              ? ON_DEFAULT_RGB
                              : OFF_DEFAULT_RGB
                            : null
                        }
                    )
                  }
                >
                  {copy.customColor}
                </ToggleSwitch>

                {rgb !== null && (
                  <PlugLedColorEditor
                    ariaPrefix={stateLabel}
                    colorLabel={copy.color}
                    value={rgb}
                    onChange={(nextRgb) =>
                      setDraft(
                        (current) => current && { ...current, [colorField]: nextRgb }
                      )
                    }
                  />
                )}

                <label className="field">
                  <span>{copy.brightness}</span>
                  <input
                    aria-label={`${stateLabel} ${copy.brightness}`}
                    inputMode="numeric"
                    type="number"
                    min="0"
                    max="100"
                    value={brightness}
                    onChange={(event) =>
                      setPercent(
                        isOn ? 'switchOnBrightness' : 'switchOffBrightness',
                        event.target.value
                      )
                    }
                  />
                </label>
              </fieldset>
            );
          })}
        </div>
      )}

      {capabilities.nightMode && (
        <fieldset className="plug-night-mode">
          <legend>{copy.nightMode}</legend>
          <ToggleSwitch
            checked={draft.nightModeEnabled}
            onChange={(checked) =>
              setDraft((current) => current && { ...current, nightModeEnabled: checked })
            }
          >
            {copy.nightModeEnabled}
          </ToggleSwitch>
          <label className="field">
            <span>{copy.nightBrightness}</span>
            <input
              aria-label={copy.nightBrightness}
              inputMode="numeric"
              type="number"
              min="0"
              max="100"
              value={draft.nightBrightness}
              onChange={(event) => setPercent('nightBrightness', event.target.value)}
            />
          </label>
          <div className="time-schedule-grid plug-night-mode__times">
            <label className="field">
              <span>{copy.nightStart}</span>
              <input
                className="plug-time-input"
                aria-label={copy.nightStart}
                type="time"
                value={draft.nightStart}
                onChange={(event) =>
                  setDraft(
                    (current) => current && { ...current, nightStart: event.target.value }
                  )
                }
              />
            </label>
            <label className="field">
              <span>{copy.nightEnd}</span>
              <input
                className="plug-time-input"
                aria-label={copy.nightEnd}
                type="time"
                value={draft.nightEnd}
                onChange={(event) =>
                  setDraft(
                    (current) => current && { ...current, nightEnd: event.target.value }
                  )
                }
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
        disabled={updateMutation.isPending}
        onClick={save}
      >
        {updateMutation.isPending ? copy.saving : copy.save}
      </button>
    </section>
  );
};

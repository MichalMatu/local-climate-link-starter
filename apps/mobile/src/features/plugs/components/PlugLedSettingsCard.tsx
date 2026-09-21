import {
  createLedOffPatch,
  createRelayStateLedPatch,
  type ShellyPlugsUiLedMode
} from '@lcl/shelly-client';
import { SelectField } from '@lcl/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import { deviceLedCopy } from '../../../app/locales/deviceLed.js';
import {
  buildPlugLedSettingsPatch,
  createPlugLedSettingsDraft
} from '../data/plugLedSettingsForm.js';
import { plugLedHexToRgb, plugLedRgbToHex } from '../data/plugLedColor.js';
import type { PlugLedSettingsTarget } from '../data/plugLedSettings.js';
import { usePlugLedSettingsFlow } from '../flows/usePlugLedSettingsFlow.js';

export type PlugLedSettingsCardProps = {
  target: PlugLedSettingsTarget;
};

const percentValue = (value: string): number =>
  Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 0));

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

  const applyPreset = (preset: 'relay' | 'off') => {
    setFeedback(null);
    updateMutation.mutate(
      preset === 'relay' ? createRelayStateLedPatch() : createLedOffPatch(),
      {
        onSuccess: () =>
          setFeedback(preset === 'relay' ? copy.relayPresetSuccess : copy.offSuccess),
        onError: () => setFeedback(copy.actionFailed)
      }
    );
  };

  if (query.isPending) {
    return (
      <article className="automation-card installation-detail-device-led">
        <h2>{copy.title}</h2>
        <p className="time-schedule-note">{copy.loading}</p>
      </article>
    );
  }
  if (query.isError) {
    return (
      <article className="automation-card installation-detail-device-led">
        <h2>{copy.title}</h2>
        <p className="installation-detail-note">{copy.unavailable}</p>
      </article>
    );
  }
  if (!settings?.supported || !config || !capabilities || !draft) {
    return (
      <article className="automation-card installation-detail-device-led">
        <h2>{copy.title}</h2>
        <p className="time-schedule-note">{copy.unsupported}</p>
      </article>
    );
  }

  const setMode = (mode: ShellyPlugsUiLedMode) =>
    setDraft((current) => current && { ...current, mode });
  const setPercent = (field: keyof typeof draft, value: string) =>
    setDraft((current) => current && { ...current, [field]: percentValue(value) });

  return (
    <article className="automation-card installation-detail-device-led">
      <div className="installation-section-heading">
        <div>
          <p className="automation-card__eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
      </div>

      <div className="field-stack">
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
        <label className="field-stack">
          <span>{copy.powerBrightness}</span>
          <input
            aria-label={copy.powerBrightness}
            type="number"
            min="0"
            max="100"
            value={draft.powerBrightness}
            onChange={(event) => setPercent('powerBrightness', event.target.value)}
          />
        </label>
      )}

      {capabilities.switchColors && draft.mode === 'switch' && (
        <div className="time-schedule-grid">
          {(['on', 'off'] as const).map((state) => {
            const isOn = state === 'on';
            const rgb = isOn ? draft.switchOnRgb : draft.switchOffRgb;
            const brightness = isOn
              ? draft.switchOnBrightness
              : draft.switchOffBrightness;
            const stateLabel = isOn ? copy.onState : copy.offState;
            return (
              <fieldset className="field-stack" key={state}>
                <legend>{stateLabel}</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={rgb !== null}
                    onChange={(event) =>
                      setDraft(
                        (current) =>
                          current && {
                            ...current,
                            [isOn ? 'switchOnRgb' : 'switchOffRgb']: event.target.checked
                              ? ([0, 0, 0] as [number, number, number])
                              : null
                          }
                      )
                    }
                  />{' '}
                  {copy.customColor}
                </label>
                <label className="field-stack">
                  <span>{copy.color}</span>
                  <input
                    aria-label={`${stateLabel} ${copy.color}`}
                    type="color"
                    disabled={rgb === null}
                    value={plugLedRgbToHex(rgb)}
                    onChange={(event) =>
                      setDraft(
                        (current) =>
                          current && {
                            ...current,
                            [isOn ? 'switchOnRgb' : 'switchOffRgb']: plugLedHexToRgb(
                              event.target.value
                            )
                          }
                      )
                    }
                  />
                </label>
                <label className="field-stack">
                  <span>{copy.brightness}</span>
                  <input
                    aria-label={`${stateLabel} ${copy.brightness}`}
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
        <fieldset className="field-stack">
          <legend>{copy.nightMode}</legend>
          <label>
            <input
              type="checkbox"
              checked={draft.nightModeEnabled}
              onChange={(event) =>
                setDraft(
                  (current) =>
                    current && { ...current, nightModeEnabled: event.target.checked }
                )
              }
            />{' '}
            {copy.nightModeEnabled}
          </label>
          <label className="field-stack">
            <span>{copy.nightBrightness}</span>
            <input
              aria-label={copy.nightBrightness}
              type="number"
              min="0"
              max="100"
              value={draft.nightBrightness}
              onChange={(event) => setPercent('nightBrightness', event.target.value)}
            />
          </label>
          <div className="time-schedule-grid">
            <label className="field-stack">
              <span>{copy.nightStart}</span>
              <input
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
            <label className="field-stack">
              <span>{copy.nightEnd}</span>
              <input
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

      <div className="installation-detail-actions">
        <button
          className="primary-action"
          type="button"
          disabled={updateMutation.isPending}
          onClick={save}
        >
          {updateMutation.isPending ? copy.saving : copy.save}
        </button>
        <button
          className="secondary-action"
          type="button"
          disabled={updateMutation.isPending}
          onClick={() => applyPreset('relay')}
        >
          {copy.relayPreset}
        </button>
        <button
          className="secondary-action"
          type="button"
          disabled={updateMutation.isPending || draft.mode === 'off'}
          onClick={() => applyPreset('off')}
        >
          {copy.turnOff}
        </button>
      </div>
      <p className="time-schedule-note">{copy.relayPresetHint}</p>
      {feedback && (
        <p role="status" className="installation-detail-note">
          {feedback}
        </p>
      )}
    </article>
  );
};

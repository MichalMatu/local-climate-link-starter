import type { ShellyPlugsUiButtonInputMode } from '@lcl/shelly-client';
import { SelectField } from '@lcl/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import { deviceButtonModeCopy } from '../../../app/locales/deviceButtonMode.js';
import type { PlugButtonModeSettingsTarget } from '../data/plugButtonModeSettings.js';
import './PlugSettingsSurface.css';
import { usePlugButtonModeSettingsFlow } from '../flows/usePlugButtonModeSettingsFlow.js';

export type PlugButtonModeSettingsCardProps = {
  target: PlugButtonModeSettingsTarget;
};

export const PlugButtonModeSettingsCard = ({
  target
}: PlugButtonModeSettingsCardProps) => {
  const { locale } = useTranslation();
  const copy = deviceButtonModeCopy[locale];
  const { query, updateMutation } = usePlugButtonModeSettingsFlow(target);
  const settings = query.data;
  const mode = settings?.supported ? settings.mode : null;
  const [draft, setDraft] = useState<ShellyPlugsUiButtonInputMode | null>(mode);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!mode) return;
    setDraft(mode);
  }, [mode]);

  const save = () => {
    if (!draft || draft === mode) {
      setFeedback(copy.noChanges);
      return;
    }
    setFeedback(null);
    updateMutation.mutate(draft, {
      onSuccess: () => setFeedback(copy.saved),
      onError: () => setFeedback(copy.actionFailed)
    });
  };

  if (query.isPending) {
    return (
      <section className="plug-settings-section installation-detail-device-button">
        <h2>{copy.title}</h2>
        <p className="plug-settings-feedback">{copy.loading}</p>
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className="plug-settings-section installation-detail-device-button">
        <h2>{copy.title}</h2>
        <p className="plug-settings-feedback plug-settings-feedback--warning">
          {copy.unavailable}
        </p>
      </section>
    );
  }
  if (!settings?.supported || !draft) {
    return (
      <section className="plug-settings-section installation-detail-device-button">
        <h2>{copy.title}</h2>
        <p className="plug-settings-feedback">{copy.unsupported}</p>
      </section>
    );
  }

  return (
    <section className="plug-settings-section installation-detail-device-button">
      <div className="plug-settings-section__heading">
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>

      <div className="field">
        <span>{copy.currentMode}</span>
        <SelectField<ShellyPlugsUiButtonInputMode>
          ariaLabel={copy.currentMode}
          value={draft}
          options={[
            { value: 'momentary', label: copy.momentary },
            { value: 'detached', label: copy.detached }
          ]}
          onChange={(value) => {
            setFeedback(null);
            setDraft(value);
          }}
        />
      </div>

      <p className="plug-settings-feedback">
        {draft === 'momentary' ? copy.momentaryHint : copy.detachedHint}
      </p>

      <div className="plug-settings-actions">
        <button
          className="primary-action"
          type="button"
          disabled={updateMutation.isPending}
          onClick={save}
        >
          {updateMutation.isPending ? copy.saving : copy.save}
        </button>
      </div>

      {feedback && (
        <p role="status" className="plug-settings-feedback">
          {feedback}
        </p>
      )}
    </section>
  );
};

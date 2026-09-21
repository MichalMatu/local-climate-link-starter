import type { ShellyPlugsUiButtonInputMode } from '@lcl/shelly-client';
import { SelectField } from '@lcl/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import { deviceButtonModeCopy } from '../../../app/locales/deviceButtonMode.js';
import type { PlugButtonModeSettingsTarget } from '../data/plugButtonModeSettings.js';
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
      <article className="automation-card installation-detail-device-button">
        <h2>{copy.title}</h2>
        <p className="time-schedule-note">{copy.loading}</p>
      </article>
    );
  }
  if (query.isError) {
    return (
      <article className="automation-card installation-detail-device-button">
        <h2>{copy.title}</h2>
        <p className="installation-detail-note">{copy.unavailable}</p>
      </article>
    );
  }
  if (!settings?.supported || !draft) {
    return (
      <article className="automation-card installation-detail-device-button">
        <h2>{copy.title}</h2>
        <p className="time-schedule-note">{copy.unsupported}</p>
      </article>
    );
  }

  return (
    <article className="automation-card installation-detail-device-button">
      <div className="installation-section-heading">
        <div>
          <p className="automation-card__eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
      </div>

      <div className="field-stack">
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

      <p className="time-schedule-note">
        {draft === 'momentary' ? copy.momentaryHint : copy.detachedHint}
      </p>

      <div className="installation-detail-actions">
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
        <p role="status" className="installation-detail-note">
          {feedback}
        </p>
      )}
    </article>
  );
};

import { useEffect, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import { deviceCloudCopy } from '../../../app/locales/deviceCloud.js';
import type { PlugCloudSettingsTarget } from '../data/plugCloudSettings.js';
import { usePlugCloudSettingsFlow } from '../flows/usePlugCloudSettingsFlow.js';

export type PlugCloudSettingsCardProps = {
  target: PlugCloudSettingsTarget;
};

export const PlugCloudSettingsCard = ({ target }: PlugCloudSettingsCardProps) => {
  const { locale } = useTranslation();
  const copy = deviceCloudCopy[locale];
  const { query, updateMutation } = usePlugCloudSettingsFlow(target);
  const settings = query.data;
  const enabled = settings?.supported ? settings.enabled : null;
  const [draft, setDraft] = useState<boolean | null>(enabled);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (enabled === null) return;
    setDraft(enabled);
  }, [enabled]);

  const save = () => {
    if (draft === null || draft === enabled) {
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
      <article className="automation-card installation-detail-device-cloud">
        <h2>{copy.title}</h2>
        <p className="time-schedule-note">{copy.loading}</p>
      </article>
    );
  }
  if (query.isError) {
    return (
      <article className="automation-card installation-detail-device-cloud">
        <h2>{copy.title}</h2>
        <p className="installation-detail-note">{copy.unavailable}</p>
      </article>
    );
  }
  if (!settings?.supported || draft === null) {
    return (
      <article className="automation-card installation-detail-device-cloud">
        <h2>{copy.title}</h2>
        <p className="time-schedule-note">{copy.unsupported}</p>
      </article>
    );
  }

  return (
    <article className="automation-card installation-detail-device-cloud">
      <div className="installation-section-heading">
        <div>
          <p className="automation-card__eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
      </div>

      <label className="toggle-row">
        <input
          aria-label={copy.enable}
          type="checkbox"
          checked={draft}
          onChange={(event) => {
            setFeedback(null);
            setDraft(event.currentTarget.checked);
          }}
        />
        <span>{copy.enable}</span>
      </label>

      <p className="time-schedule-note">{draft ? copy.enabledHint : copy.disabledHint}</p>
      <p className="installation-detail-note">
        {copy.connection}: {settings.connected ? copy.connected : copy.disconnected}
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

import { useEffect, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import { deviceCloudCopy } from '../../../app/locales/deviceCloud.js';
import type { PlugCloudSettingsTarget } from '../data/plugCloudSettings.js';
import './PlugSettingsSurface.css';
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
  const [baseline, setBaseline] = useState<boolean | null>(enabled);
  const [draft, setDraft] = useState<boolean | null>(enabled);
  const [feedback, setFeedback] = useState<string | null>(null);
  const hasChanges = draft !== null && baseline !== null && draft !== baseline;

  useEffect(() => {
    if (enabled === null || hasChanges) return;
    setBaseline(enabled);
    setDraft(enabled);
  }, [enabled, hasChanges]);

  const save = () => {
    if (draft === null || draft === baseline) {
      setFeedback(copy.noChanges);
      return;
    }
    setFeedback(null);
    updateMutation.mutate(draft, {
      onSuccess: (confirmed) => {
        if (confirmed.supported) {
          setBaseline(confirmed.enabled);
          setDraft(confirmed.enabled);
        }
        setFeedback(copy.saved);
      },
      onError: () => setFeedback(copy.actionFailed)
    });
  };

  if (query.isPending) {
    return (
      <section className="plug-settings-section installation-detail-device-cloud">
        <h2>{copy.title}</h2>
        <p className="plug-settings-feedback">{copy.loading}</p>
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className="plug-settings-section installation-detail-device-cloud">
        <h2>{copy.title}</h2>
        <p className="plug-settings-feedback plug-settings-feedback--warning">
          {copy.unavailable}
        </p>
      </section>
    );
  }
  if (!settings?.supported || draft === null) {
    return (
      <section className="plug-settings-section installation-detail-device-cloud">
        <h2>{copy.title}</h2>
        <p className="plug-settings-feedback">{copy.unsupported}</p>
      </section>
    );
  }

  return (
    <section className="plug-settings-section installation-detail-device-cloud">
      <div className="plug-settings-section__heading">
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>

      <label className="plug-settings-check-row">
        <span>{copy.enable}</span>
        <input
          aria-label={copy.enable}
          checked={draft}
          type="checkbox"
          onChange={(event) => {
            setFeedback(null);
            setDraft(event.currentTarget.checked);
          }}
        />
      </label>

      <p className="plug-settings-feedback">
        {draft ? copy.enabledHint : copy.disabledHint}
      </p>
      <p className="plug-settings-feedback">
        {copy.connection}: {settings.connected ? copy.connected : copy.disconnected}
      </p>

      <div className="plug-settings-actions">
        <button
          className="primary-action"
          type="button"
          disabled={!hasChanges || updateMutation.isPending}
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

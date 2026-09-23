import { ToggleSwitch } from '@lcl/ui';
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

      <ToggleSwitch
        checked={draft}
        onChange={(checked) => {
          setFeedback(null);
          setDraft(checked);
        }}
      >
        {copy.enable}
      </ToggleSwitch>

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

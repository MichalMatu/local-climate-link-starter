import { useTranslation } from '../../../app/i18n.js';
import { useTimeAutomationSetupFlow } from '../../../flows/time-automation/useTimeAutomationSetupFlow.js';
import { mutationError, type HardwarePageProps } from '../helpers.js';

type TimeScheduleSetupPageProps = HardwarePageProps & {
  onInstalled?(): void;
};

export const TimeScheduleSetupPage = ({
  flow,
  onInstalled
}: TimeScheduleSetupPageProps) => {
  const { t } = useTranslation();
  const timeFlow = useTimeAutomationSetupFlow(flow.selectedShelly);

  const install = async () => {
    try {
      await timeFlow.installMutation.mutateAsync();
      onInstalled?.();
    } catch {
      // Mutation state renders the actionable error below.
    }
  };

  return (
    <section className="demo-panel time-schedule-panel">
      <div className="installation-section-heading">
        <div>
          <p className="automation-card__eyebrow">{t('time.eyebrow')}</p>
          <h1>{t('time.title')}</h1>
          <p>{t('time.description')}</p>
        </div>
      </div>

      <div className="time-schedule-device">
        <span>{t('time.device')}</span>
        <strong>{flow.selectedShelly?.name ?? t('time.noDevice')}</strong>
        {flow.selectedShelly && <small>{flow.selectedShelly.baseUrl}</small>}
      </div>

      <div className="time-schedule-grid">
        <label className="field-stack">
          <span>{t('time.onTime')}</span>
          <input
            type="time"
            value={timeFlow.onTime}
            onChange={(event) => timeFlow.setOnTime(event.target.value)}
          />
        </label>
        <label className="field-stack">
          <span>{t('time.offTime')}</span>
          <input
            type="time"
            value={timeFlow.offTime}
            onChange={(event) => timeFlow.setOffTime(event.target.value)}
          />
        </label>
      </div>

      <p className="time-schedule-note">{t('time.localClockHint')}</p>
      <p className="time-schedule-note time-schedule-note--ownership">
        {t('time.ownershipHint')}
      </p>

      {timeFlow.installMutation.isError && (
        <p className="feedback-panel feedback-panel--warning" role="alert">
          {mutationError(timeFlow.installMutation.error)}
        </p>
      )}

      <div className="time-schedule-actions">
        <button
          className="primary-action"
          type="button"
          disabled={
            !flow.selectedShelly ||
            !timeFlow.configState.ok ||
            timeFlow.installMutation.isPending
          }
          onClick={() => void install()}
        >
          {timeFlow.installMutation.isPending ? t('time.installing') : t('time.install')}
        </button>
      </div>
    </section>
  );
};

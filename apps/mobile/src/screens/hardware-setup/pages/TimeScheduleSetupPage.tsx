import type { TimeScheduleSetupFlow } from '../pageContracts.js';
import { FeedbackPanel, Modal } from '@lcl/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import { useTimeAutomationSetupFlow } from '../../../flows/time-automation/useTimeAutomationSetupFlow.js';
import { mutationError, type HardwarePageProps } from '../helpers.js';

type TimeScheduleSetupPageProps = HardwarePageProps<TimeScheduleSetupFlow> & {
  onInstalled?(): void;
};

export const TimeScheduleSetupPage = ({
  flow,
  onInstalled
}: TimeScheduleSetupPageProps) => {
  const { t } = useTranslation();
  const timeFlow = useTimeAutomationSetupFlow(flow.selectedShelly);
  const [isInstallErrorOpen, setIsInstallErrorOpen] = useState(false);

  useEffect(() => {
    if (timeFlow.installMutation.isError) {
      setIsInstallErrorOpen(true);
    }
  }, [timeFlow.installMutation.isError]);

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
      </div>

      <div className="time-schedule-grid">
        <label className="field-stack">
          <span>{t('time.onTime')}</span>
          <input
            className="time-schedule-time-input"
            type="time"
            value={timeFlow.onTime}
            onClick={(event) => event.currentTarget.showPicker?.()}
            onChange={(event) => timeFlow.setOnTime(event.target.value)}
          />
        </label>
        <label className="field-stack">
          <span>{t('time.offTime')}</span>
          <input
            className="time-schedule-time-input"
            type="time"
            value={timeFlow.offTime}
            onClick={(event) => event.currentTarget.showPicker?.()}
            onChange={(event) => timeFlow.setOffTime(event.target.value)}
          />
        </label>
      </div>

      <p className="time-schedule-note">{t('time.localClockHint')}</p>
      <p className="time-schedule-note time-schedule-note--ownership">
        {t('time.ownershipHint')}
      </p>

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

      <Modal
        closeLabel={t('common.close')}
        open={isInstallErrorOpen && timeFlow.installMutation.isError}
        title={t('common.operationFailed')}
        onClose={() => {
          setIsInstallErrorOpen(false);
          timeFlow.installMutation.reset();
        }}
      >
        {timeFlow.installMutation.isError && (
          <FeedbackPanel tone="danger" title={t('common.operationFailed')}>
            {mutationError(timeFlow.installMutation.error)}
          </FeedbackPanel>
        )}
      </Modal>
    </section>
  );
};

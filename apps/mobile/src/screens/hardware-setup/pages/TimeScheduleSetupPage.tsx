import type { TimeScheduleSetupFlow } from '../pageContracts.js';
import { FeedbackPanel, Modal } from '@lcl/ui';
import { useEffect, useState, type UIEvent } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import { useTimeAutomationSetupFlow } from '../../../flows/time-automation/useTimeAutomationSetupFlow.js';
import { mutationError, type HardwarePageProps } from '../helpers.js';

type TimeScheduleSetupPageProps = HardwarePageProps<TimeScheduleSetupFlow> & {
  onInstalled?(): void;
};

type TimePickerTarget = 'on' | 'off';
type WheelKind = 'hour' | 'minute';

const HOUR_VALUES = Array.from({ length: 24 }, (_, value) =>
  String(value).padStart(2, '0')
);
const MINUTE_VALUES = Array.from({ length: 60 }, (_, value) =>
  String(value).padStart(2, '0')
);

const splitTime = (value: string): [string, string] => {
  const [hour = '00', minute = '00'] = value.split(':');
  return [hour.padStart(2, '0').slice(-2), minute.padStart(2, '0').slice(-2)];
};

const centerWheelOption = (
  kind: WheelKind,
  value: string,
  behavior: ScrollBehavior = 'auto'
) => {
  const option = document.querySelector<HTMLElement>(`[data-wheel-${kind}="${value}"]`);
  const wheel = option?.closest<HTMLElement>('.time-wheel-column');
  if (!option || !wheel || typeof wheel.scrollTo !== 'function') {
    return;
  }
  wheel.scrollTo({
    top: option.offsetTop - (wheel.clientHeight - option.clientHeight) / 2,
    behavior
  });
};

export const TimeScheduleSetupPage = ({
  flow,
  onInstalled
}: TimeScheduleSetupPageProps) => {
  const { t } = useTranslation();
  const timeFlow = useTimeAutomationSetupFlow(flow.selectedShelly);
  const [isInstallErrorOpen, setIsInstallErrorOpen] = useState(false);
  const [editingTime, setEditingTime] = useState<TimePickerTarget | null>(null);
  const [draftHour, setDraftHour] = useState('00');
  const [draftMinute, setDraftMinute] = useState('00');

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

  const openTimePicker = (target: TimePickerTarget) => {
    const value = target === 'on' ? timeFlow.onTime : timeFlow.offTime;
    const [hour, minute] = splitTime(value);
    setDraftHour(hour);
    setDraftMinute(minute);
    setEditingTime(target);
    window.requestAnimationFrame(() => {
      centerWheelOption('hour', hour);
      centerWheelOption('minute', minute);
    });
  };

  const updateFromWheel = (kind: WheelKind, event: UIEvent<HTMLDivElement>) => {
    const wheel = event.currentTarget;
    const wheelRect = wheel.getBoundingClientRect();
    const center = wheelRect.top + wheelRect.height / 2;
    let closest: HTMLButtonElement | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const option of wheel.querySelectorAll<HTMLButtonElement>(
      '.time-wheel-option'
    )) {
      const rect = option.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - center);
      if (distance < closestDistance) {
        closest = option;
        closestDistance = distance;
      }
    }

    const value = closest?.dataset.wheelValue;
    if (!value) {
      return;
    }
    if (kind === 'hour') {
      setDraftHour(value);
    } else {
      setDraftMinute(value);
    }
  };

  const chooseWheelOption = (kind: WheelKind, value: string) => {
    if (kind === 'hour') {
      setDraftHour(value);
    } else {
      setDraftMinute(value);
    }
    centerWheelOption(kind, value, 'smooth');
  };

  const applyTime = () => {
    if (!editingTime) {
      return;
    }
    const value = `${draftHour}:${draftMinute}`;
    if (editingTime === 'on') {
      timeFlow.setOnTime(value);
    } else {
      timeFlow.setOffTime(value);
    }
    setEditingTime(null);
  };

  const renderWheel = (kind: WheelKind, values: string[], selectedValue: string) => (
    <div className="time-wheel-column-shell">
      <span className="time-wheel-column-label" aria-hidden="true">
        {kind === 'hour' ? 'HH' : 'MM'}
      </span>
      <div
        aria-label={kind === 'hour' ? 'HH' : 'MM'}
        className="time-wheel-column"
        data-wheel-column={kind}
        onScroll={(event) => updateFromWheel(kind, event)}
      >
        {values.map((value) => (
          <button
            aria-label={`${kind === 'hour' ? 'HH' : 'MM'} ${value}`}
            aria-pressed={selectedValue === value}
            className="time-wheel-option"
            data-selected={selectedValue === value ? 'true' : undefined}
            data-wheel-hour={kind === 'hour' ? value : undefined}
            data-wheel-minute={kind === 'minute' ? value : undefined}
            data-wheel-value={value}
            key={`${kind}-${value}`}
            type="button"
            onClick={() => chooseWheelOption(kind, value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );

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
        <div className="field-stack">
          <span>{t('time.onTime')}</span>
          <button
            aria-expanded={editingTime === 'on'}
            aria-haspopup="dialog"
            aria-label={`${t('time.onTime')}: ${timeFlow.onTime}`}
            className="time-schedule-time-input time-schedule-time-button"
            type="button"
            onClick={() => openTimePicker('on')}
          >
            {timeFlow.onTime}
          </button>
        </div>
        <div className="field-stack">
          <span>{t('time.offTime')}</span>
          <button
            aria-expanded={editingTime === 'off'}
            aria-haspopup="dialog"
            aria-label={`${t('time.offTime')}: ${timeFlow.offTime}`}
            className="time-schedule-time-input time-schedule-time-button"
            type="button"
            onClick={() => openTimePicker('off')}
          >
            {timeFlow.offTime}
          </button>
        </div>
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
        actions={
          <button className="primary-action" type="button" onClick={applyTime}>
            {t('common.select')}
          </button>
        }
        closeLabel={t('common.cancel')}
        open={editingTime !== null}
        size="task"
        title={editingTime === 'off' ? t('time.offTime') : t('time.onTime')}
        onClose={() => setEditingTime(null)}
      >
        <div className="time-wheel-picker" data-time-wheel-picker>
          {renderWheel('hour', HOUR_VALUES, draftHour)}
          {renderWheel('minute', MINUTE_VALUES, draftMinute)}
        </div>
      </Modal>

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

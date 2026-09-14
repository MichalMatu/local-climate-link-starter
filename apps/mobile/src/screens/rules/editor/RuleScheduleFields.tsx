import { useState, type UIEvent } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { SetupIntent } from '../../../flows/setup-intent.js';
import {
  ALL_WEEKDAYS,
  type RuleEditorErrors,
  type RuleEditorState
} from '../../../flows/rules/editor.js';

type TimePickerTarget = 'start' | 'end';
type WheelKind = 'hour' | 'minute';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
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

const centerWheelOption = (kind: WheelKind, value: string) => {
  const option = document.querySelector<HTMLElement>(
    `[data-rule-wheel-${kind}="${value}"]`
  );
  const wheel = option?.closest<HTMLElement>('.time-wheel-column');
  if (!option || !wheel || typeof wheel.scrollTo !== 'function') return;
  const optionRect = option.getBoundingClientRect();
  const wheelRect = wheel.getBoundingClientRect();
  wheel.scrollTo({
    top:
      wheel.scrollTop +
      optionRect.top -
      wheelRect.top -
      (wheel.clientHeight - optionRect.height) / 2,
    behavior: 'smooth'
  });
};

export const RuleScheduleFields = ({
  intent,
  state,
  errors,
  update,
  toggleDay
}: {
  intent: SetupIntent;
  state: RuleEditorState;
  errors: RuleEditorErrors;
  update<K extends keyof RuleEditorState>(key: K, value: RuleEditorState[K]): void;
  toggleDay(day: RuleEditorState['days'][number]): void;
}) => {
  const { t } = useTranslation();
  const enabled = intent === 'time' || state.scheduleEnabled;
  const [editingTime, setEditingTime] = useState<TimePickerTarget | null>(null);
  const [draftHour, setDraftHour] = useState('00');
  const [draftMinute, setDraftMinute] = useState('00');

  const openTimePicker = (target: TimePickerTarget) => {
    const [hour, minute] = splitTime(target === 'start' ? state.start : state.end);
    setDraftHour(hour);
    setDraftMinute(minute);
    setEditingTime(target);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        centerWheelOption('hour', hour);
        centerWheelOption('minute', minute);
      });
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
    if (!value) return;
    if (kind === 'hour') setDraftHour(value);
    else setDraftMinute(value);
  };

  const chooseWheelOption = (kind: WheelKind, value: string) => {
    if (kind === 'hour') setDraftHour(value);
    else setDraftMinute(value);
    centerWheelOption(kind, value);
  };

  const applyTime = () => {
    if (!editingTime) return;
    update(editingTime, `${draftHour}:${draftMinute}`);
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
        onScroll={(event) => updateFromWheel(kind, event)}
      >
        {values.map((value) => (
          <button
            aria-label={`${kind === 'hour' ? 'HH' : 'MM'} ${value}`}
            aria-pressed={selectedValue === value}
            className="time-wheel-option"
            data-selected={selectedValue === value ? 'true' : undefined}
            data-rule-wheel-hour={kind === 'hour' ? value : undefined}
            data-rule-wheel-minute={kind === 'minute' ? value : undefined}
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
    <section className="field-stack rule-schedule-fields">
      {intent !== 'time' && (
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={state.scheduleEnabled}
            onChange={(event) => update('scheduleEnabled', event.currentTarget.checked)}
          />
          <span>{t('time.scheduleSummary')}</span>
        </label>
      )}

      {enabled && (
        <>
          <div className="rule-weekdays" aria-label={t('time.scheduleSummary')}>
            {ALL_WEEKDAYS.map((day, index) => (
              <button
                key={day}
                className="rule-weekday"
                type="button"
                aria-pressed={state.days.includes(day)}
                onClick={() => toggleDay(day)}
              >
                {WEEKDAY_LABELS[index]}
              </button>
            ))}
          </div>

          <div className="rule-time-row">
            <label className={errors.schedule ? 'field field--invalid' : 'field'}>
              {t('time.onTime')}
              <button
                className="rule-time-button"
                type="button"
                aria-expanded={editingTime === 'start'}
                aria-label={`${t('time.onTime')}: ${state.start}`}
                onClick={() => openTimePicker('start')}
              >
                {state.start}
              </button>
            </label>
            <label className={errors.schedule ? 'field field--invalid' : 'field'}>
              {t('time.offTime')}
              <button
                className="rule-time-button"
                type="button"
                aria-expanded={editingTime === 'end'}
                aria-label={`${t('time.offTime')}: ${state.end}`}
                onClick={() => openTimePicker('end')}
              >
                {state.end}
              </button>
            </label>
          </div>

          {editingTime && (
            <div
              className="rule-inline-time-picker"
              role="group"
              aria-label={editingTime === 'start' ? t('time.onTime') : t('time.offTime')}
            >
              <div className="time-wheel-picker" data-time-wheel-picker>
                {renderWheel('hour', HOUR_VALUES, draftHour)}
                {renderWheel('minute', MINUTE_VALUES, draftMinute)}
              </div>
              <div className="rule-inline-time-picker__actions">
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => setEditingTime(null)}
                >
                  {t('common.cancel')}
                </button>
                <button className="primary-action" type="button" onClick={applyTime}>
                  {t('common.apply')}
                </button>
              </div>
            </div>
          )}

          {errors.schedule && (
            <span className="field__error">{t('time.validation.invalidTimes')}</span>
          )}
        </>
      )}
    </section>
  );
};

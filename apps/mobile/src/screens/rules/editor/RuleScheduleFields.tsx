import { useTranslation } from '../../../app/i18n.js';
import type { SetupIntent } from '../../../flows/setup-intent.js';
import {
  ALL_WEEKDAYS,
  type RuleEditorErrors,
  type RuleEditorState
} from '../../../flows/rules/editor.js';

const weekdayLabel = (day: RuleEditorState['days'][number]): string =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(
    new Date(Date.UTC(2026, 0, 4 + day))
  );

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
  return (
    <section className="field-stack">
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
          <div className="action-row" aria-label={t('time.scheduleSummary')}>
            {ALL_WEEKDAYS.map((day) => (
              <button
                key={day}
                className="secondary-action"
                type="button"
                aria-pressed={state.days.includes(day)}
                onClick={() => toggleDay(day)}
              >
                {weekdayLabel(day)}
              </button>
            ))}
          </div>
          <div className="field-row">
            <label className={errors.schedule ? 'field field--invalid' : 'field'}>
              {t('time.onTime')}
              <input
                type="time"
                value={state.start}
                aria-invalid={Boolean(errors.schedule)}
                onChange={(event) => update('start', event.currentTarget.value)}
              />
            </label>
            <label className={errors.schedule ? 'field field--invalid' : 'field'}>
              {t('time.offTime')}
              <input
                type="time"
                value={state.end}
                aria-invalid={Boolean(errors.schedule)}
                onChange={(event) => update('end', event.currentTarget.value)}
              />
            </label>
          </div>
          {errors.schedule && (
            <span className="field__error">{t('time.validation.invalidTimes')}</span>
          )}
        </>
      )}
    </section>
  );
};

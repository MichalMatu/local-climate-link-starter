#!/usr/bin/env bash
set -euo pipefail

REPO="/Users/michal/agent-workspace/repos/local-climate-link-starter/work"
BRANCH="work/device-rule-decoupling-20260913"
EXPECTED_HEAD="1594e3621d87c8879619f75125e51c17bf0dfc72"
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]]
[[ -z "$(git status --porcelain)" ]]

cat > apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx <<'EOF'
import { useEffect, useState, type UIEvent } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { SetupIntent } from '../../../flows/setup-intent.js';
import type {
  RuleEditorErrors,
  RuleEditorState
} from '../../../flows/rules/editor.js';

type Weekday = RuleEditorState['days'][number];
type TimeTarget = 'start' | 'end';
type WheelKind = 'hour' | 'minute';

const DISPLAY_WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: 'Su',
  1: 'Mo',
  2: 'Tu',
  3: 'We',
  4: 'Th',
  5: 'Fr',
  6: 'Sa'
};
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
    behavior
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
  toggleDay(day: Weekday): void;
}) => {
  const { t } = useTranslation();
  const enabled = intent === 'time' || state.scheduleEnabled;
  const [editingTime, setEditingTime] = useState<TimeTarget | null>(null);
  const [draftHour, setDraftHour] = useState('00');
  const [draftMinute, setDraftMinute] = useState('00');

  useEffect(() => {
    if (!editingTime) return;
    const frame = window.requestAnimationFrame(() => {
      centerWheelOption('hour', draftHour);
      centerWheelOption('minute', draftMinute);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingTime]);

  const openTimePicker = (target: TimeTarget) => {
    const [hour, minute] = splitTime(target === 'start' ? state.start : state.end);
    setDraftHour(hour);
    setDraftMinute(minute);
    setEditingTime(target);
  };

  const updateFromWheel = (kind: WheelKind, event: UIEvent<HTMLDivElement>) => {
    const wheel = event.currentTarget;
    const wheelRect = wheel.getBoundingClientRect();
    const center = wheelRect.top + wheelRect.height / 2;
    let closest: HTMLButtonElement | null = null;
    let distance = Number.POSITIVE_INFINITY;

    for (const option of wheel.querySelectorAll<HTMLButtonElement>('.time-wheel-option')) {
      const rect = option.getBoundingClientRect();
      const candidateDistance = Math.abs(rect.top + rect.height / 2 - center);
      if (candidateDistance < distance) {
        closest = option;
        distance = candidateDistance;
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
    centerWheelOption(kind, value, 'smooth');
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
            key={`${kind}-${value}`}
            aria-label={`${kind === 'hour' ? 'HH' : 'MM'} ${value}`}
            aria-pressed={selectedValue === value}
            className="time-wheel-option"
            data-selected={selectedValue === value ? 'true' : undefined}
            data-rule-wheel-hour={kind === 'hour' ? value : undefined}
            data-rule-wheel-minute={kind === 'minute' ? value : undefined}
            data-wheel-value={value}
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
          <div className="rule-schedule-days" aria-label={t('time.scheduleSummary')}>
            {DISPLAY_WEEKDAYS.map((day) => (
              <button
                key={day}
                className="rule-schedule-day"
                type="button"
                aria-pressed={state.days.includes(day)}
                onClick={() => toggleDay(day)}
              >
                {WEEKDAY_LABELS[day]}
              </button>
            ))}
          </div>

          <div className="rule-schedule-time-grid">
            <div className={errors.schedule ? 'field field--invalid' : 'field'}>
              <span>{t('time.onTime')}</span>
              <button
                className="rule-schedule-time-button"
                type="button"
                aria-expanded={editingTime === 'start'}
                aria-label={`${t('time.onTime')}: ${state.start}`}
                onClick={() => openTimePicker('start')}
              >
                {state.start}
              </button>
            </div>
            <div className={errors.schedule ? 'field field--invalid' : 'field'}>
              <span>{t('time.offTime')}</span>
              <button
                className="rule-schedule-time-button"
                type="button"
                aria-expanded={editingTime === 'end'}
                aria-label={`${t('time.offTime')}: ${state.end}`}
                onClick={() => openTimePicker('end')}
              >
                {state.end}
              </button>
            </div>
          </div>

          {editingTime && (
            <div className="rule-schedule-wheel-panel">
              <div className="rule-schedule-wheel-heading">
                <strong>
                  {editingTime === 'start' ? t('time.onTime') : t('time.offTime')}
                </strong>
                <span>{`${draftHour}:${draftMinute}`}</span>
              </div>
              <div className="time-wheel-picker" data-time-wheel-picker>
                {renderWheel('hour', HOUR_VALUES, draftHour)}
                {renderWheel('minute', MINUTE_VALUES, draftMinute)}
              </div>
              <div className="rule-schedule-wheel-actions">
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
EOF

cat >> apps/mobile/src/theme/theme.css <<'EOF'

/* Compact rule schedule editor */
.rule-schedule-fields {
  gap: var(--lcl-spacing-md);
}

.rule-schedule-days {
  display: grid;
  gap: var(--lcl-spacing-xs);
  grid-template-columns: repeat(7, minmax(0, 1fr));
  width: 100%;
}

.rule-schedule-day {
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text-muted);
  cursor: pointer;
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-bold);
  min-height: var(--lcl-size-compact-control-min-height);
  min-width: 0;
  padding: 0;
}

.rule-schedule-day[aria-pressed='true'] {
  background: var(--lcl-color-accent);
  border-color: var(--lcl-color-accent);
  color: var(--lcl-color-accent-contrast);
}

.rule-schedule-time-grid {
  display: grid;
  gap: var(--lcl-spacing-md);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.rule-schedule-time-button {
  appearance: none;
  background: var(--lcl-color-surface);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text);
  cursor: pointer;
  font-size: var(--lcl-font-size-2xl);
  font-variant-numeric: tabular-nums;
  font-weight: var(--lcl-font-weight-bold);
  min-height: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-md));
  padding: 0 var(--lcl-spacing-md);
  text-align: center;
  width: 100%;
}

.rule-schedule-time-button[aria-expanded='true'] {
  border-color: var(--lcl-color-accent);
  box-shadow: 0 0 0 var(--lcl-border-width-sm) var(--lcl-color-accent);
}

.rule-schedule-wheel-panel {
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-lg);
  display: grid;
  gap: var(--lcl-spacing-md);
  padding: var(--lcl-spacing-md);
}

.rule-schedule-wheel-heading {
  align-items: baseline;
  display: flex;
  gap: var(--lcl-spacing-md);
  justify-content: space-between;
}

.rule-schedule-wheel-heading span {
  color: var(--lcl-color-accent);
  font-size: var(--lcl-font-size-xl);
  font-variant-numeric: tabular-nums;
  font-weight: var(--lcl-font-weight-bold);
}

.rule-schedule-wheel-actions {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.rule-schedule-wheel-actions > button {
  width: 100%;
}
EOF

pnpm exec prettier --write apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx apps/mobile/src/theme/theme.css
pnpm exec eslint apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx
pnpm --filter @lcl/mobile typecheck

git add apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx apps/mobile/src/theme/theme.css
git commit -m "Polish schedule time controls"
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD="$(git rev-parse "origin/$BRANCH")"
[[ "$FINAL_HEAD" == "$(git rev-parse HEAD)" ]]
printf 'FINAL_HEAD=%s\n' "$FINAL_HEAD"

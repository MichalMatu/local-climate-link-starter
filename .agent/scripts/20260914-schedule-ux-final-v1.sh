#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
BASE=1594e3621d87c8879619f75125e51c17bf0dfc72
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[ -z "$(git status --porcelain)" ] || { git status --short; exit 3; }

cat > apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx <<'EOF'
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
  const option = document.querySelector<HTMLElement>(`[data-rule-wheel-${kind}="${value}"]`);
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

    for (const option of wheel.querySelectorAll<HTMLButtonElement>('.time-wheel-option')) {
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
            <div className="rule-inline-time-picker" role="group" aria-label={editingTime === 'start' ? t('time.onTime') : t('time.offTime')}>
              <div className="time-wheel-picker" data-time-wheel-picker>
                {renderWheel('hour', HOUR_VALUES, draftHour)}
                {renderWheel('minute', MINUTE_VALUES, draftMinute)}
              </div>
              <div className="rule-inline-time-picker__actions">
                <button className="secondary-action" type="button" onClick={() => setEditingTime(null)}>
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

.rule-weekdays {
  display: flex;
  gap: var(--lcl-spacing-xs);
  width: 100%;
}

.rule-weekday {
  appearance: none;
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text-muted);
  cursor: pointer;
  flex: 1 1 0;
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-bold);
  min-height: var(--lcl-size-compact-control-min-height);
  min-width: 0;
  padding: 0;
}

.rule-weekday[aria-pressed='true'] {
  background: var(--lcl-color-accent);
  border-color: var(--lcl-color-accent);
  color: var(--lcl-color-accent-contrast);
}

.rule-weekday:focus-visible,
.rule-time-button:focus-visible {
  outline: var(--lcl-border-width-md) solid var(--lcl-color-focus-ring);
  outline-offset: var(--lcl-border-width-sm);
}

.rule-time-row {
  display: flex;
  gap: var(--lcl-spacing-md);
  width: 100%;
}

.rule-time-row > .field {
  flex: 1 1 0;
  min-width: 0;
}

.rule-time-button {
  appearance: none;
  background: var(--lcl-color-surface);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text);
  cursor: pointer;
  font-size: var(--lcl-font-size-xl);
  font-variant-numeric: tabular-nums;
  font-weight: var(--lcl-font-weight-bold);
  min-height: var(--lcl-size-control-min-height);
  padding: 0 var(--lcl-spacing-md);
  text-align: center;
  width: 100%;
}

.rule-time-button[aria-expanded='true'] {
  border-color: var(--lcl-color-accent);
}

.rule-inline-time-picker {
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-lg);
  display: grid;
  gap: var(--lcl-spacing-md);
  padding: var(--lcl-spacing-md);
}

.rule-inline-time-picker__actions {
  display: flex;
  gap: var(--lcl-spacing-sm);
  justify-content: flex-end;
}
EOF

pnpm exec prettier --write apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx apps/mobile/src/theme/theme.css
pnpm exec eslint apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck

git add apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx apps/mobile/src/theme/theme.css
git commit --no-verify -m "Polish rule schedule controls"
git push origin HEAD:"$BRANCH"
echo "FINAL_HEAD=$(git rev-parse HEAD)"

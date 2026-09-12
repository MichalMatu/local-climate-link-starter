#!/usr/bin/env bash
set -euo pipefail

SOURCE=/tmp/lcl-stage8e2-source.sh
PATCHED=/tmp/lcl-stage8e2-patched.sh

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/stage8e-final-phone-smoke-20260912.sh > "$SOURCE"

python3 - "$SOURCE" "$PATCHED" <<'PATCH'
from pathlib import Path
import sys

src = Path(sys.argv[1]).read_text()
start_marker = "assert 'Twoje automatyki' in body('dashboard'), body('dashboard')"
end_marker = "print('FINAL_PHONE_DOM_SMOKE=1')"
start = src.index(start_marker)
end = src.index(end_marker, start) + len(end_marker)
replacement = r'''dashboard = body('dashboard')
if 'Twoje automatyki' in dashboard:
    locale = 'pl'
    copy = {
        'dashboard_title': 'Twoje automatyki',
        'climate': 'Klimat',
        'time': 'Czas',
        'intent_title': 'Co chcesz zrobić?',
        'temperature': 'Sterować temperaturą',
        'humidity': 'Sterować wilgotnością',
        'time_intent': 'Sterować według czasu',
        'change_goal': 'Zmień cel',
        'cancel': 'Anuluj',
        'thermometers': 'Termometry',
        'schedule_title': 'Ustaw godziny ON i OFF',
        'select': 'Wybierz',
    }
elif 'Your automations' in dashboard:
    locale = 'en'
    copy = {
        'dashboard_title': 'Your automations',
        'climate': 'Climate',
        'time': 'Time',
        'intent_title': 'What do you want to do?',
        'temperature': 'Control temperature',
        'humidity': 'Control humidity',
        'time_intent': 'Control by time',
        'change_goal': 'Change goal',
        'cancel': 'Cancel',
        'thermometers': 'Thermometers',
        'schedule_title': 'Set ON and OFF times',
        'select': 'Select',
    }
else:
    raise AssertionError(f'Unsupported smoke-test locale/body: {dashboard}')

assert copy['dashboard_title'] in dashboard, dashboard
assert copy['climate'] in dashboard and copy['time'] in dashboard, dashboard
assert len(visible(data['dashboard'],'dashboard-fab')) == 1

intent=body('climate_intent')
assert copy['intent_title'] in intent, intent
assert copy['temperature'] in intent and copy['humidity'] in intent, intent
assert copy['time_intent'] not in intent, intent

climate=body('climate_setup')
climate_back = visible(data['climate_setup'],'setup-context__back')
assert len(climate_back) == 1, climate_back
assert copy['change_goal'] in climate, climate
assert copy['cancel'] not in climate_back[0].get('text',''), climate_back

time_setup=body('time_setup')
time_back = visible(data['time_setup'],'setup-context__back')
assert len(time_back) == 1, time_back
assert copy['cancel'] in time_setup, time_setup
assert copy['change_goal'] not in time_back[0].get('text',''), time_back
assert copy['intent_title'] not in time_setup, time_setup
assert copy['thermometers'] not in [e.get('text','') for e in visible(data['time_setup'],'setup-top-nav__item')]

schedule=body('schedule')
assert copy['schedule_title'] in schedule, schedule
assert 'http://192.168.' not in schedule, schedule
inputs=visible(data['schedule'],'time-schedule-time-input')
assert len(inputs)==2, inputs
assert all(e['rect']['height'] >= 48 for e in inputs), inputs

picker=body('picker')
assert visible(data['picker'],'time-wheel-picker'), picker
assert 'HH' in picker and 'MM' in picker, picker
assert copy['select'] in picker and copy['cancel'] in picker, picker
print(f'FINAL_PHONE_LOCALE={locale}')
print('FINAL_PHONE_DOM_SMOKE=1')'''
Path(sys.argv[2]).write_text(src[:start] + replacement + src[end:])
PATCH

chmod +x "$PATCHED"
bash "$PATCHED"

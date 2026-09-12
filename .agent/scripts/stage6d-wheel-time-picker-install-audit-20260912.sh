#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=060d5990ca5e68709ab883e6a83137754e34fa22
APP_ID=link.localclimate.app
EXPECTED_MODEL=SM-S906B
APK=apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
ARTIFACT_ID=20260912-stage6d-wheel-time-picker-audit
ARTIFACT_DIR=.agent/artifacts/$ARTIFACT_ID
TMP_DIR="$(mktemp -d /tmp/lcl-stage6d.XXXXXX)"
CONTROL_DIR="$(mktemp -d /tmp/lcl-stage6d-control.XXXXXX)"
PORT=9229
cleanup() {
  adb forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
  git worktree remove --force "$CONTROL_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$CONTROL_DIR"
}
trap cleanup EXIT INT TERM

git fetch --prune origin "$BRANCH" agent-control >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

cat > apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx <<'EOF'
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

    for (const option of wheel.querySelectorAll<HTMLButtonElement>('.time-wheel-option')) {
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
EOF

cat >> apps/mobile/src/theme/theme.css <<'EOF'

/* Stage 6D: lightweight in-app wheel picker avoids Android's radial clock dialog. */
.time-schedule-time-button {
  appearance: none;
  line-height: 1;
}

.time-wheel-picker {
  display: grid;
  gap: var(--lcl-spacing-md);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0 auto;
  max-width: 22rem;
  width: 100%;
}

.time-wheel-column-shell {
  display: grid;
  gap: var(--lcl-spacing-xs);
  min-width: 0;
}

.time-wheel-column-label {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-bold);
  text-align: center;
}

.time-wheel-column {
  -webkit-overflow-scrolling: touch;
  height: 15rem;
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 24%,
    black 76%,
    transparent 100%
  );
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-block: 6rem;
  scrollbar-width: none;
  scroll-snap-type: y mandatory;
}

.time-wheel-column::-webkit-scrollbar {
  display: none;
}

.time-wheel-option {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text-muted);
  cursor: pointer;
  display: flex;
  font-variant-numeric: tabular-nums;
  font-size: var(--lcl-font-size-xl);
  height: 3rem;
  justify-content: center;
  margin: 0;
  padding: 0 var(--lcl-spacing-sm);
  scroll-snap-align: center;
  scroll-snap-stop: always;
  width: 100%;
}

.time-wheel-option[data-selected='true'] {
  background: var(--lcl-color-surface-muted);
  color: var(--lcl-color-text);
  font-size: var(--lcl-font-size-2xl);
  font-weight: var(--lcl-font-weight-bold);
}

.time-wheel-option:focus-visible {
  outline: var(--lcl-border-width-md) solid var(--lcl-color-focus-ring);
  outline-offset: calc(-1 * var(--lcl-border-width-md));
}
EOF

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx \
  apps/mobile/src/theme/theme.css
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile test -- --run
pnpm check

grep -q 'data-time-wheel-picker' apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
grep -q 'time-wheel-column' apps/mobile/src/theme/theme.css
! grep -q 'type="time"' apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
CHANGED="$(git diff --name-only)"
EXPECTED="apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
apps/mobile/src/theme/theme.css"
test "$CHANGED" = "$EXPECTED"

git add $CHANGED
git commit -m "Use wheel picker for schedule times" >/dev/null
CANDIDATE="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = "$BASE"
git push origin "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$CANDIDATE"
test -z "$(git status --porcelain)"
printf 'STAGE6D_SHA=%s\n' "$CANDIDATE"
printf 'STAGE6D_PARENT=%s\n' "$BASE"
printf 'STAGE6D_CHECKS=1\n'

command -v adb >/dev/null 2>&1
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" -eq 1
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "$EXPECTED_MODEL"

SDK_ROOT=""
if [ -d "$HOME/Library/Android/sdk/platforms" ] && [ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]; then
  SDK_ROOT="$HOME/Library/Android/sdk"
else
  ADB_BIN="$(command -v adb)"
  ADB_REAL="$(python3 - "$ADB_BIN" <<'PY'
import os,sys
print(os.path.realpath(sys.argv[1]))
PY
)"
  CAND="$(cd "$(dirname "$ADB_REAL")/.." && pwd -P)"
  if [ -d "$CAND/platforms" ] && [ -d "$CAND/build-tools" ]; then SDK_ROOT="$CAND"; fi
fi
test -n "$SDK_ROOT"
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
printf 'sdk.dir=%s\n' "$SDK_ROOT" > apps/mobile/android/local.properties

pnpm --filter @lcl/mobile build
(
  cd apps/mobile
  pnpm exec cap sync android
  cd android
  ./gradlew assembleDebug
)
test -f "$APK"
adb -s "$SERIAL" install -r "$APK" >/dev/null
adb -s "$SERIAL" shell am force-stop "$APP_ID"
adb -s "$SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 2
test -n "$(adb -s "$SERIAL" shell pm path "$APP_ID" | tr -d '\r')"
test "$(git rev-parse HEAD)" = "$CANDIDATE"
test -z "$(git status --porcelain)"
printf 'INSTALLED_CANDIDATE_SHA=%s\n' "$CANDIDATE"
printf 'ANDROID_DEVICE_MODEL=%s\n' "$MODEL"
printf 'STAGE6D_ANDROID_INSTALL=1\n'

# Reuse the verified CDP helper.
git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/capture-stage5-major-screens-cdp-20260912.sh > "$TMP_DIR/source.sh"
python3 - "$TMP_DIR/source.sh" "$TMP_DIR/cdp.mjs" <<'PY'
import sys
source=open(sys.argv[1], encoding='utf-8').read()
marker="cat > \"$TMP_DIR/cdp.mjs\" <<'JS'\n"
body=source.split(marker,1)[1].split('\nJS\n',1)[0]
open(sys.argv[2],'w',encoding='utf-8').write(body+'\n')
PY

PID="$(adb -s "$SERIAL" shell pidof "$APP_ID" | tr -d '\r' | awk '{print $1}')"
test -n "$PID"
SOCKET="$(adb -s "$SERIAL" shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | awk '{print $NF}' | sed 's/^@//' | grep "webview_devtools_remote_${PID}$" | head -n 1 || true)"
test -n "$SOCKET"
adb -s "$SERIAL" forward "tcp:$PORT" "localabstract:$SOCKET" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:$PORT/json" > "$TMP_DIR/targets.json"
WS_URL="$(python3 - "$TMP_DIR/targets.json" <<'PY'
import json,sys
for t in json.load(open(sys.argv[1],encoding='utf-8')):
    if t.get('type')=='page' and t.get('webSocketDebuggerUrl'):
        print(t['webSocketDebuggerUrl']); break
PY
)"
test -n "$WS_URL"
cdp() { node "$TMP_DIR/cdp.mjs" "$WS_URL" "$@"; }
wait_selector() { cdp wait-selector "$1" >/dev/null; }
click_selector() { cdp click-selector "$1" "${2:-0}" >/dev/null; sleep 0.55; }
capture() {
  name="$1"
  cdp dump > "$TMP_DIR/$name.json"
  adb -s "$SERIAL" exec-out screencap -p > "$TMP_DIR/$name.png"
  sips -Z 780 -s format jpeg -s formatOptions 68 "$TMP_DIR/$name.png" --out "$TMP_DIR/$name-thumb.jpg" >/dev/null
  sips -Z 320 -s format jpeg -s formatOptions 50 "$TMP_DIR/$name.png" --out "$TMP_DIR/$name-nano.jpg" >/dev/null
  test -s "$TMP_DIR/$name-thumb.jpg"
  test -s "$TMP_DIR/$name-nano.jpg"
}

wait_selector '.dashboard-shell'
click_selector '[data-dashboard-kind="time"]'
wait_selector '.dashboard-shell'
click_selector '.dashboard-fab'
wait_selector '.intent-shell'
click_selector '.intent-choice' 2
wait_selector '.hardware-shell'
click_selector '.setup-top-nav__item' 1
wait_selector '.time-schedule-grid'
wait_selector '.time-schedule-time-input'
capture schedule-before-wheel

click_selector '.time-schedule-time-input' 0
wait_selector '[data-time-wheel-picker]'
sleep 0.5
capture wheel-open
adb -s "$SERIAL" shell uiautomator dump /sdcard/lcl-stage6d-wheel.xml >/dev/null 2>&1 || true
adb -s "$SERIAL" shell cat /sdcard/lcl-stage6d-wheel.xml 2>/dev/null | tr -d '\r' > "$TMP_DIR/wheel-native.xml" || true
! grep -q 'android.widget.TimePicker' "$TMP_DIR/wheel-native.xml"
adb -s "$SERIAL" shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | head -n 4 > "$TMP_DIR/wheel-window.txt" || true
grep -q "$APP_ID" "$TMP_DIR/wheel-window.txt"

click_selector '[data-wheel-hour="09"]'
click_selector '[data-wheel-minute="30"]'
click_selector '.lcl-modal__footer .primary-action'
wait_selector '.time-schedule-grid'
sleep 0.4
capture schedule-after-wheel

python3 - "$TMP_DIR/schedule-before-wheel.json" "$TMP_DIR/wheel-open.json" "$TMP_DIR/schedule-after-wheel.json" <<'PY'
import json,sys
before,wheel,after=[json.load(open(p,encoding='utf-8')) for p in sys.argv[1:]]
def visible(d,cls):
    return [e for e in d['elements'] if e.get('visible') and cls in (e.get('className') or '').split()]
inputs=visible(before,'time-schedule-time-input')
assert len(inputs)==2,inputs
inputs=sorted(inputs,key=lambda e:e['rect']['x'])
a,b=inputs
assert abs(a['rect']['y']-b['rect']['y'])<=2,(a['rect'],b['rect'])
assert a['rect']['width']>=130 and b['rect']['width']>=130,(a['rect'],b['rect'])
assert 'http://192.168.' not in before['bodyText'],before['bodyText']
assert 'Wybierz' in wheel['bodyText'],wheel['bodyText']
assert 'HH' in wheel['bodyText'] and 'MM' in wheel['bodyText'],wheel['bodyText']
assert any(e.get('visible') and 'time-wheel-option' in (e.get('className') or '') for e in wheel['elements'])
after_inputs=visible(after,'time-schedule-time-input')
assert len(after_inputs)==2,after_inputs
texts=[e.get('text') for e in sorted(after_inputs,key=lambda e:e['rect']['x'])]
assert texts[0]=='09:30',texts
print('STAGE6D_DOM_AUDIT=1')
print('TIME_BUTTONS='+json.dumps(texts,separators=(',',':')))
PY

printf 'MODEL=%s\nCANDIDATE=%s\nAPP_PID=%s\nSOCKET=%s\nWS_URL=%s\n' "$MODEL" "$CANDIDATE" "$PID" "$SOCKET" "$WS_URL" > "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm size >> "$TMP_DIR/meta.txt"
adb -s "$SERIAL" shell wm density >> "$TMP_DIR/meta.txt"

# Publish read-only visual evidence on agent-control.
git fetch origin agent-control >/dev/null
rm -rf "$CONTROL_DIR"
git worktree add --detach "$CONTROL_DIR" origin/agent-control >/dev/null
mkdir -p "$CONTROL_DIR/$ARTIFACT_DIR"
cp "$TMP_DIR"/*.json "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-thumb.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/*-nano.jpg "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/wheel-native.xml "$CONTROL_DIR/$ARTIFACT_DIR/" 2>/dev/null || true
cp "$TMP_DIR"/wheel-window.txt "$CONTROL_DIR/$ARTIFACT_DIR/"
cp "$TMP_DIR"/meta.txt "$CONTROL_DIR/$ARTIFACT_DIR/meta.txt"
(
  cd "$CONTROL_DIR"
  git add "$ARTIFACT_DIR"
  git commit -m "Capture Stage 6D wheel time picker audit" >/dev/null
  if ! git push origin HEAD:agent-control >/dev/null 2>&1; then
    git fetch origin agent-control >/dev/null
    git rebase origin/agent-control >/dev/null
    git push origin HEAD:agent-control >/dev/null
  fi
  echo "AUDIT_CONTROL_SHA=$(git rev-parse HEAD)"
)

echo STAGE6D_WHEEL_PICKER_AUDIT=1

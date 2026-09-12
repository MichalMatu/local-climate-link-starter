#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=a7b08d97f88750247823d8393ed53a26c90034d9

git fetch --prune origin "$BRANCH" agent-control
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

python3 <<'PY'
from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text()
    if s.count(old) != 1:
        raise SystemExit(f'{path}: expected exactly one match, got {s.count(old)}')
    p.write_text(s.replace(old, new, 1))

# Time setup must not expose climate-only BLE discovery.
replace_once(
    'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx',
    "      {activeTab === 'shelly' && <ShellySetupPage flow={flow} />}",
    "      {activeTab === 'shelly' && (\n        <ShellySetupPage flow={flow} enableBleDiscovery={setupIntent !== 'time'} />\n      )}",
)

shelly = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace_once(
    shelly,
    "} from '@lcl/ui';\nimport { useEffect, useId, useRef, useState } from 'react';",
    "} from '@lcl/ui';\nimport { IconPlus } from '@tabler/icons-react';\nimport { useEffect, useId, useRef, useState } from 'react';",
)
replace_once(
    shelly,
    "export const ShellySetupPage = ({ flow }: HardwarePageProps<ShellySetupFlow>) => {",
    "type ShellySetupPageProps = HardwarePageProps<ShellySetupFlow> & {\n  enableBleDiscovery?: boolean;\n};\n\nexport const ShellySetupPage = ({\n  flow,\n  enableBleDiscovery = true\n}: ShellySetupPageProps) => {",
)
replace_once(
    shelly,
    "      <div className=\"action-row add-device-action-row\">\n        <button\n          className=\"secondary-action\"\n          type=\"button\"\n          aria-label={t('hardware.shelly.add')}\n          title={t('hardware.shelly.addTitle')}\n          onClick={openAddShellyModal}\n        >\n          {t('hardware.shelly.add')}\n        </button>\n      </div>",
    "      <button\n        className=\"primary-action setup-add-fab\"\n        type=\"button\"\n        aria-label={t('hardware.shelly.add')}\n        title={t('hardware.shelly.addTitle')}\n        onClick={openAddShellyModal}\n      >\n        <IconPlus className=\"setup-add-fab__icon\" aria-hidden=\"true\" />\n      </button>",
)
replace_once(
    shelly,
    "            onBleScan={openBleScanModal}",
    "            onBleScan={enableBleDiscovery ? openBleScanModal : undefined}",
)

presentation = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx'
replace_once(
    presentation,
    "  onBleScan: (device: ShellyDraftDevice) => void;",
    "  onBleScan?: (device: ShellyDraftDevice) => void;",
)
replace_once(
    presentation,
    "      <button\n        className=\"shelly-ble-action\"\n        type=\"button\"\n        disabled={isControlBusy}\n        title={t('hardware.shelly.scanBleViaShellyTitle')}\n        onClick={() => onBleScan(device)}\n      >\n        <IconBluetooth className=\"icon-action__svg\" aria-hidden=\"true\" />\n        <span>{t('hardware.shelly.scanBleViaShellyTitle')}</span>\n      </button>",
    "      {onBleScan && (\n        <button\n          className=\"shelly-ble-action\"\n          type=\"button\"\n          disabled={isControlBusy}\n          title={t('hardware.shelly.scanBleViaShellyTitle')}\n          onClick={() => onBleScan(device)}\n        >\n          <IconBluetooth className=\"icon-action__svg\" aria-hidden=\"true\" />\n          <span>{t('hardware.shelly.scanBleViaShellyTitle')}</span>\n        </button>\n      )}",
)

sensor = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
replace_once(
    sensor,
    "import { IconClock, IconPencil, IconTrash } from '@tabler/icons-react';",
    "import { IconClock, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';",
)
replace_once(
    sensor,
    "      <div className=\"action-row add-device-action-row\">\n        <button\n          className=\"secondary-action\"\n          type=\"button\"\n          aria-label={t('hardware.sensor.add')}\n          title={t('hardware.sensor.addTitle')}\n          onClick={openAddSensorModal}\n        >\n          {t('hardware.sensor.add')}\n        </button>\n      </div>",
    "      <button\n        className=\"primary-action setup-add-fab\"\n        type=\"button\"\n        aria-label={t('hardware.sensor.add')}\n        title={t('hardware.sensor.addTitle')}\n        onClick={openAddSensorModal}\n      >\n        <IconPlus className=\"setup-add-fab__icon\" aria-hidden=\"true\" />\n      </button>",
)

time_page = 'apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx'
replace_once(
    time_page,
    "        {flow.selectedShelly && <small>{flow.selectedShelly.baseUrl}</small>}\n",
    "",
)
replace_once(
    time_page,
    "          <input\n            type=\"time\"\n            value={timeFlow.onTime}\n            onChange={(event) => timeFlow.setOnTime(event.target.value)}\n          />",
    "          <input\n            className=\"time-schedule-time-input\"\n            type=\"time\"\n            value={timeFlow.onTime}\n            onClick={(event) => event.currentTarget.showPicker?.()}\n            onChange={(event) => timeFlow.setOnTime(event.target.value)}\n          />",
)
replace_once(
    time_page,
    "          <input\n            type=\"time\"\n            value={timeFlow.offTime}\n            onChange={(event) => timeFlow.setOffTime(event.target.value)}\n          />",
    "          <input\n            className=\"time-schedule-time-input\"\n            type=\"time\"\n            value={timeFlow.offTime}\n            onClick={(event) => event.currentTarget.showPicker?.()}\n            onChange={(event) => timeFlow.setOffTime(event.target.value)}\n          />",
)

css = 'apps/mobile/src/theme/theme.css'
replace_once(
    css,
    ".add-device-action-row {\n  justify-content: flex-end;\n}\n",
    ".add-device-action-row {\n  justify-content: flex-end;\n}\n\n.hardware-shell .setup-add-fab {\n  border-radius: var(--lcl-radius-round);\n  bottom: calc(\n    var(--app-bottom-nav-height) + var(--lcl-spacing-md) + env(safe-area-inset-bottom)\n  );\n  height: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-md));\n  padding: 0;\n  position: fixed;\n  right: var(--lcl-fluid-shell-padding);\n  width: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-md));\n  z-index: var(--lcl-z-index-header);\n}\n\n.setup-add-fab__icon {\n  height: var(--lcl-size-control-icon-size);\n  width: var(--lcl-size-control-icon-size);\n}\n",
)
replace_once(
    css,
    ".time-schedule-grid {\n  display: grid;\n  gap: var(--lcl-spacing-md);\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n}\n",
    ".time-schedule-grid {\n  display: grid;\n  gap: var(--lcl-spacing-md);\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n\n.time-schedule-grid .field-stack {\n  align-items: stretch;\n  gap: var(--lcl-spacing-sm);\n  min-width: 0;\n  text-align: center;\n}\n\n.time-schedule-time-input {\n  background: var(--lcl-color-surface-muted);\n  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  border-radius: var(--lcl-radius-lg);\n  color: var(--lcl-color-text);\n  cursor: pointer;\n  font-size: calc(var(--lcl-font-size-2xl) + var(--lcl-spacing-xs));\n  font-variant-numeric: tabular-nums;\n  font-weight: var(--lcl-font-weight-bold);\n  min-height: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-xl));\n  padding: var(--lcl-spacing-md);\n  text-align: center;\n  width: 100%;\n}\n\n.time-schedule-time-input::-webkit-datetime-edit {\n  padding: 0;\n  text-align: center;\n}\n\n.time-schedule-time-input::-webkit-datetime-edit-fields-wrapper {\n  justify-content: center;\n}\n\n.time-schedule-time-input:focus-visible {\n  border-color: var(--lcl-color-accent);\n  outline: var(--lcl-border-width-md) solid var(--lcl-color-focus-ring);\n  outline-offset: var(--lcl-border-width-sm);\n}\n",
)
PY

if ! pnpm exec prettier --version >/dev/null 2>&1; then
  pnpm install --frozen-lockfile
fi

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx \
  apps/mobile/src/theme/theme.css

pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile test -- --run
pnpm --filter @lcl/mobile build
pnpm check

CHANGED="$(git diff --name-only | sort)"
printf '%s\n' "$CHANGED"
EXPECTED="apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx
apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx
apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
apps/mobile/src/theme/theme.css"
test "$CHANGED" = "$EXPECTED"

git diff --check
git add $CHANGED
git diff --cached --check
git commit -m "Polish add actions and time controls"
git push origin "$BRANCH"

SHA="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = "$BASE"
test -z "$(git status --porcelain)"
printf 'STAGE6B_SHA=%s\n' "$SHA"
printf 'STAGE6B_PARENT=%s\n' "$(git rev-parse HEAD^)"

# Install the exact verified commit on the connected Samsung phone.
pnpm --filter @lcl/mobile exec cap sync android
(
  cd apps/mobile/android
  ./gradlew installDebug
)
adb start-server >/dev/null
SERIALS="$(adb devices -l | awk 'NR>1 && $2==\"device\" {print $1}')"
COUNT="$(printf '%s\n' "$SERIALS" | sed '/^$/d' | wc -l | tr -d ' ')"
test "$COUNT" -eq 1
SERIAL="$(printf '%s\n' "$SERIALS" | sed -n '1p')"
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
test "$MODEL" = "SM-S906B"
adb -s "$SERIAL" shell am force-stop link.localclimate.app
adb -s "$SERIAL" shell monkey -p link.localclimate.app -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 2
FOCUS="$(adb -s "$SERIAL" shell dumpsys window | grep -m1 'mCurrentFocus' || true)"
printf 'ANDROID_DEVICE_MODEL=%s\n' "$MODEL"
printf 'ANDROID_FOCUS=%s\n' "$FOCUS"
printf 'STAGE6B_ANDROID_INSTALL=1\n'

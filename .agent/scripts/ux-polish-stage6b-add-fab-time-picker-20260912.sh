#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=a7b08d97f88750247823d8393ed53a26c90034d9

git fetch --prune origin "$BRANCH" agent-control
git checkout "$BRANCH"
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
test "$(git rev-parse HEAD)" = "$BASE"

# The previous Stage 6 attempt failed before formatting/tests and left only its
# deterministic UI patch in the worker. Discard exactly that failed attempt and
# rebuild the revised pass from the known Stage 5 SHA.
if test -n "$(git status --porcelain)"; then
  STATUS="$(git status --porcelain)"
  printf '%s\n' "$STATUS"
  printf '%s\n' "$STATUS" | grep -q 'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx'
  printf '%s\n' "$STATUS" | grep -q 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
  printf '%s\n' "$STATUS" | grep -q 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx'
  printf '%s\n' "$STATUS" | grep -q 'apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx'
  printf '%s\n' "$STATUS" | grep -q 'apps/mobile/src/theme/theme.css'
  test "$(printf '%s\n' "$STATUS" | wc -l | tr -d ' ')" -eq 5
  git reset --hard "$BASE"
  git clean -fd
fi

test -z "$(git status --porcelain)"

python3 <<'PY'
from pathlib import Path

# Time setup: remove technical URL from the human surface, make the two time
# controls deliberately styled tappable fields, and keep behavior native.
p = Path('apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx')
s = p.read_text()
s = s.replace("        {flow.selectedShelly && <small>{flow.selectedShelly.baseUrl}</small>}\n", "")
s = s.replace(
"""          <input
            type=\"time\"
            value={timeFlow.onTime}""",
"""          <input
            className=\"time-schedule-input\"
            type=\"time\"
            value={timeFlow.onTime}""",
1)
s = s.replace(
"""          <input
            type=\"time\"
            value={timeFlow.offTime}""",
"""          <input
            className=\"time-schedule-input\"
            type=\"time\"
            value={timeFlow.offTime}""",
1)
p.write_text(s)

# Time setup has no sensor dependency: suppress the BLE discovery action from
# the shared Shelly card only for that intent.
p = Path('apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx')
s = p.read_text()
old = "      {activeTab === 'shelly' && <ShellySetupPage flow={flow} />}"
new = """      {activeTab === 'shelly' && (
        <ShellySetupPage flow={flow} enableBleDiscovery={setupIntent !== 'time'} />
      )}"""
if old not in s:
    raise SystemExit('HardwareSetupScreen Shelly mount pattern missing')
s = s.replace(old, new, 1)
p.write_text(s)

p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = p.read_text()
if "import { IconPlus } from '@tabler/icons-react';" not in s:
    s = s.replace(
        "import { useEffect, useId, useRef, useState } from 'react';\n",
        "import { useEffect, useId, useRef, useState } from 'react';\nimport { IconPlus } from '@tabler/icons-react';\n",
        1,
    )
old = "export const ShellySetupPage = ({ flow }: HardwarePageProps<ShellySetupFlow>) => {"
new = """type ShellySetupPageProps = HardwarePageProps<ShellySetupFlow> & {
  enableBleDiscovery?: boolean;
};

export const ShellySetupPage = ({
  flow,
  enableBleDiscovery = true
}: ShellySetupPageProps) => {"""
if old not in s:
    raise SystemExit('ShellySetupPage signature pattern missing')
s = s.replace(old, new, 1)
old = """      <div className=\"action-row add-device-action-row\">
        <button
          className=\"secondary-action\"
          type=\"button\"
          aria-label={t('hardware.shelly.add')}
          title={t('hardware.shelly.addTitle')}
          onClick={openAddShellyModal}
        >
          {t('hardware.shelly.add')}
        </button>
      </div>"""
new = """      <button
        className=\"setup-device-fab\"
        type=\"button\"
        aria-label={t('hardware.shelly.add')}
        title={t('hardware.shelly.addTitle')}
        onClick={openAddShellyModal}
      >
        <IconPlus className=\"setup-device-fab__icon\" aria-hidden=\"true\" />
      </button>"""
if old not in s:
    raise SystemExit('Shelly add action block missing')
s = s.replace(old, new, 1)
s = s.replace("            onBleScan={openBleScanModal}\n", "            onBleScan={enableBleDiscovery ? openBleScanModal : undefined}\n", 1)
p.write_text(s)

p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx')
s = p.read_text()
s = s.replace(
    "  onBleScan: (device: ShellyDraftDevice) => void;\n",
    "  onBleScan?: (device: ShellyDraftDevice) => void;\n",
    1,
)
old = """      <button
        className=\"shelly-ble-action\"
        type=\"button\"
        disabled={isControlBusy}
        title={t('hardware.shelly.scanBleViaShellyTitle')}
        onClick={() => onBleScan(device)}
      >
        <IconBluetooth className=\"icon-action__svg\" aria-hidden=\"true\" />
        <span>{t('hardware.shelly.scanBleViaShellyTitle')}</span>
      </button>"""
new = """      {onBleScan && (
        <button
          className=\"shelly-ble-action\"
          type=\"button\"
          disabled={isControlBusy}
          title={t('hardware.shelly.scanBleViaShellyTitle')}
          onClick={() => onBleScan(device)}
        >
          <IconBluetooth className=\"icon-action__svg\" aria-hidden=\"true\" />
          <span>{t('hardware.shelly.scanBleViaShellyTitle')}</span>
        </button>
      )}"""
if old not in s:
    raise SystemExit('Saved Shelly BLE action block missing')
s = s.replace(old, new, 1)
p.write_text(s)

# Sensor add action uses the same + FAB language as Add automation.
p = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s = p.read_text()
s = s.replace(
    "import { IconClock, IconPencil, IconTrash } from '@tabler/icons-react';",
    "import { IconClock, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';",
    1,
)
old = """      <div className=\"action-row add-device-action-row\">
        <button
          className=\"secondary-action\"
          type=\"button\"
          aria-label={t('hardware.sensor.add')}
          title={t('hardware.sensor.addTitle')}
          onClick={openAddSensorModal}
        >
          {t('hardware.sensor.add')}
        </button>
      </div>"""
new = """      <button
        className=\"setup-device-fab\"
        type=\"button\"
        aria-label={t('hardware.sensor.add')}
        title={t('hardware.sensor.addTitle')}
        onClick={openAddSensorModal}
      >
        <IconPlus className=\"setup-device-fab__icon\" aria-hidden=\"true\" />
      </button>"""
if old not in s:
    raise SystemExit('Sensor add action block missing')
s = s.replace(old, new, 1)
p.write_text(s)

# CSS: same floating + geometry as dashboard, plus large centered time surfaces.
p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
s = s.replace(
""".time-schedule-grid {
  display: grid;
  gap: var(--lcl-spacing-md);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}""",
""".time-schedule-grid {
  display: grid;
  gap: var(--lcl-spacing-md);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}""",
1)
anchor = """.time-schedule-note {
"""
insert = """.time-schedule-grid .field-stack {
  align-items: stretch;
  gap: var(--lcl-spacing-sm);
  text-align: center;
}

.time-schedule-grid .field-stack > span {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-semibold);
}

.time-schedule-input {
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-lg);
  color: var(--lcl-color-text);
  font-size: calc(var(--lcl-font-size-2xl) + var(--lcl-spacing-xs));
  font-variant-numeric: tabular-nums;
  font-weight: var(--lcl-font-weight-bold);
  min-height: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-md));
  padding: 0 var(--lcl-spacing-md);
  text-align: center;
  width: 100%;
}

.time-schedule-input:focus-visible {
  border-color: var(--lcl-color-accent);
  outline: var(--lcl-border-width-md) solid var(--lcl-color-accent-soft);
  outline-offset: 0;
}

.time-schedule-input::-webkit-date-and-time-value {
  text-align: center;
}

.setup-device-fab {
  align-items: center;
  background: var(--lcl-color-accent);
  border: 0;
  border-radius: var(--lcl-radius-round);
  bottom: calc(
    var(--app-bottom-nav-height) + var(--lcl-spacing-md) + env(safe-area-inset-bottom)
  );
  box-shadow: var(--lcl-shadow-md);
  color: var(--lcl-color-accent-contrast);
  cursor: pointer;
  display: inline-flex;
  height: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-md));
  justify-content: center;
  padding: 0;
  position: fixed;
  right: var(--lcl-fluid-shell-padding);
  width: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-md));
  z-index: var(--lcl-z-index-header);
}

.setup-device-fab:hover,
.setup-device-fab:focus-visible {
  background: var(--lcl-color-accent-strong);
}

.setup-device-fab__icon {
  height: var(--lcl-size-control-icon-size);
  width: var(--lcl-size-control-icon-size);
}

"""
if anchor not in s:
    raise SystemExit('time schedule CSS anchor missing')
s = s.replace(anchor, insert + anchor, 1)
p.write_text(s)
PY

# Restore workspace dependencies if the worker was restarted between stages.
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
pnpm --filter @lcl/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile test -- --run
pnpm --filter @lcl/mobile build
pnpm check

CHANGED="$(git diff --name-only | sort)"
printf '%s\n' "$CHANGED"
EXPECTED="$(cat <<'EOF'
apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx
apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx
apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
apps/mobile/src/theme/theme.css
EOF
)"
test "$CHANGED" = "$EXPECTED"

grep -q 'className="setup-device-fab"' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
grep -q 'className="setup-device-fab"' apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
grep -q 'className="time-schedule-input"' apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
grep -q 'grid-template-columns: repeat(2, minmax(0, 1fr));' apps/mobile/src/theme/theme.css
grep -q "enableBleDiscovery={setupIntent !== 'time'}" apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx
! grep -q 'selectedShelly.baseUrl' apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx

git diff --check
git add $CHANGED
git diff --cached --check
git commit -m "Polish setup add actions and time fields"
git push origin "$BRANCH"

SHA="$(git rev-parse HEAD)"
printf 'STAGE6B_SHA=%s\n' "$SHA"
printf 'STAGE6B_PARENT=%s\n' "$(git rev-parse HEAD^)"
printf 'STAGE6B_BUILD=1\n'
test "$(git rev-parse HEAD^)" = "$BASE"
test -z "$(git status --porcelain)"

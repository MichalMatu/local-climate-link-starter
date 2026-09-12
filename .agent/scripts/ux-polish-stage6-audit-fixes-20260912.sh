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

# 1) Climate setup needs BLE discovery; time-only setup does not.
p = Path('apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx')
s = p.read_text()
old = """      {activeTab === 'shelly' && <ShellySetupPage flow={flow} />}"""
new = """      {activeTab === 'shelly' && (
        <ShellySetupPage flow={flow} enableBleDiscovery={setupIntent !== 'time'} />
      )}"""
if s.count(old) != 1:
    raise SystemExit('HardwareSetupScreen Shelly render anchor mismatch')
p.write_text(s.replace(old, new, 1))

# 2) Make Shelly BLE affordance optional for context-specific setup surfaces.
p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = p.read_text()
old = """export const ShellySetupPage = ({ flow }: HardwarePageProps<ShellySetupFlow>) => {"""
new = """type ShellySetupPageProps = HardwarePageProps<ShellySetupFlow> & {
  enableBleDiscovery?: boolean;
};

export const ShellySetupPage = ({
  flow,
  enableBleDiscovery = true
}: ShellySetupPageProps) => {"""
if s.count(old) != 1:
    raise SystemExit('ShellySetupPage props anchor mismatch')
s = s.replace(old, new, 1)
old = """            onBleScan={openBleScanModal}"""
new = """            onBleScan={enableBleDiscovery ? openBleScanModal : undefined}"""
if s.count(old) != 1:
    raise SystemExit('ShellySetupPage onBleScan anchor mismatch')
p.write_text(s.replace(old, new, 1))

# 3) Presentation layer omits the BLE action entirely when the caller does not offer it.
p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx')
s = p.read_text()
old = """  onBleScan: (device: ShellyDraftDevice) => void;"""
new = """  onBleScan?: (device: ShellyDraftDevice) => void;"""
if s.count(old) != 1:
    raise SystemExit('SavedShellyDeviceCard onBleScan prop anchor mismatch')
s = s.replace(old, new, 1)
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
if s.count(old) != 1:
    raise SystemExit('SavedShellyDeviceCard BLE button anchor mismatch')
p.write_text(s.replace(old, new, 1))

# 4) Time schedule is a user-facing task surface; keep the friendly device name,
#    not a repeated technical URL.
p = Path('apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx')
s = p.read_text()
old = """        {flow.selectedShelly && <small>{flow.selectedShelly.baseUrl}</small>}\n"""
if s.count(old) != 1:
    raise SystemExit('TimeSchedule baseUrl anchor mismatch')
p.write_text(s.replace(old, '', 1))

# 5) Fix the two-field schedule grid and keep add-device actions compact on phone.
p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
old = """.time-schedule-grid {
  display: grid;
  gap: var(--lcl-spacing-md);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}"""
new = """.time-schedule-grid {
  display: grid;
  gap: var(--lcl-spacing-md);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}"""
if s.count(old) != 1:
    raise SystemExit('time-schedule-grid anchor mismatch')
s = s.replace(old, new, 1)
old = """  .primary-action,
  .secondary-action {
    width: 100%;
  }

  .control-action-row {"""
new = """  .primary-action,
  .secondary-action {
    width: 100%;
  }

  .add-device-action-row .secondary-action {
    width: auto;
  }

  .control-action-row {"""
if s.count(old) != 1:
    raise SystemExit('mobile action width anchor mismatch')
p.write_text(s.replace(old, new, 1))
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx \
  apps/mobile/src/theme/theme.css

# Deterministic source guards for the audit findings.
grep -q "enableBleDiscovery={setupIntent !== 'time'}" apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx
grep -q "onBleScan={enableBleDiscovery ? openBleScanModal : undefined}" apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
grep -q "onBleScan?: (device: ShellyDraftDevice) => void" apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx
! grep -q "selectedShelly.baseUrl" apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
python3 <<'PY'
from pathlib import Path
s = Path('apps/mobile/src/theme/theme.css').read_text()
assert '.time-schedule-grid {\n  display: grid;\n  gap: var(--lcl-spacing-md);\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}' in s
assert '.add-device-action-row .secondary-action {\n    width: auto;\n  }' in s
PY

pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile test -- --run
pnpm --filter @lcl/mobile build
pnpm check

CHANGED=$(git diff --name-only | sort)
printf '%s\n' "$CHANGED"
for f in $CHANGED; do
  case "$f" in
    apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx|apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx|apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx|apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx|apps/mobile/src/theme/theme.css) ;;
    *) echo "Unexpected changed file: $f" >&2; exit 1 ;;
  esac
done

git add $CHANGED
git diff --cached --check
git commit -m "Polish remaining setup inconsistencies"
git push origin "$BRANCH"

SHA=$(git rev-parse HEAD)
printf 'STAGE6_SHA=%s\n' "$SHA"
printf 'STAGE6_PARENT=%s\n' "$(git rev-parse HEAD^)"
printf 'STAGE6_BUILD=1\n'
test "$(git rev-parse HEAD^)" = "$BASE"
test -z "$(git status --porcelain)"

#!/usr/bin/env sh
set -eu

BASE=0cd5b4ba20852bb53e9d10443be2aa16b6dc90a2
BRANCH=work/ux-polish-20260911

git fetch --prune origin "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "$BASE" >/dev/null
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

# Compact saved Shelly card.
p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx')
s = p.read_text()
s = replace_once(
    s,
    "import { IconRefresh, IconSettings } from '@tabler/icons-react';\nimport { useId } from 'react';",
    "import { IconBluetooth, IconInfoCircle, IconPencil, IconTrash } from '@tabler/icons-react';\nimport { useId, useState } from 'react';",
    'presentation imports'
)
start = s.find('type SavedShellyDeviceCardProps = {')
if start == -1:
    raise SystemExit('card props start not found')
new_card = r'''type SavedShellyDeviceCardProps = {
  device: ShellyDraftDevice;
  controlState: ShellyControlCardState | undefined;
  onRelayOn: (device: ShellyDraftDevice) => void;
  onRelayOff: (device: ShellyDraftDevice) => void;
  onAutomationAuto: (device: ShellyDraftDevice) => void;
  onAutomationManual: (device: ShellyDraftDevice) => void;
  onNameChange: (device: ShellyDraftDevice, value: string) => void;
  onInfoOpen: (device: ShellyDraftDevice) => void;
  onBleScan: (device: ShellyDraftDevice) => void;
  onRemove: (device: ShellyDraftDevice) => void;
};

export const SavedShellyDeviceCard = ({
  device,
  controlState,
  onRelayOn,
  onRelayOff,
  onAutomationAuto,
  onAutomationManual,
  onNameChange,
  onInfoOpen,
  onBleScan,
  onRemove
}: SavedShellyDeviceCardProps) => {
  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const controlStatus = controlState?.status ?? null;
  const pendingAction = controlState?.pendingAction ?? null;
  const isControlBusy = pendingAction !== null;
  const relayToggleLabel = controlStatus?.relayOn ? 'OFF' : 'ON';
  const relayToggleTitle =
    controlStatus === null
      ? t('hardware.shelly.relayUnknownTitle')
      : controlStatus.relayOn
        ? t('hardware.shelly.relayOnTitle')
        : t('hardware.shelly.relayOffTitle');
  const relayToggleClass =
    controlStatus === null
      ? 'secondary-action relay-toggle relay-toggle--unknown'
      : controlStatus.relayOn
        ? 'secondary-action relay-toggle relay-toggle--on'
        : 'secondary-action relay-toggle relay-toggle--off';
  const automationMode = controlStatus?.automationMode ?? null;
  const automationToggleLabel = automationMode === 'auto' ? 'MANUAL' : 'AUTO';
  const automationToggleTitle =
    automationMode === 'auto'
      ? t('hardware.shelly.automationAutoTitle')
      : automationMode === 'manual'
        ? t('hardware.shelly.automationManualTitle')
        : automationMode === 'missing'
          ? t('hardware.shelly.automationMissingTitle')
          : t('hardware.shelly.automationUnknownTitle');
  const automationToggleClass =
    automationMode === 'auto'
      ? 'secondary-action automation-toggle automation-toggle--auto'
      : automationMode === 'manual'
        ? 'secondary-action automation-toggle automation-toggle--manual'
        : automationMode === 'missing'
          ? 'secondary-action automation-toggle automation-toggle--missing'
          : 'secondary-action automation-toggle automation-toggle--unknown';
  const telemetry = controlStatus?.telemetry;
  const clock = controlStatus?.clock;

  return (
    <article
      className="saved-list__item shelly-saved-card"
      aria-busy={isControlBusy || undefined}
    >
      <div className="shelly-card-header">
        {isEditingName ? (
          <input
            autoFocus
            className="shelly-card-name-input"
            aria-label={t('hardware.shelly.deviceNameLabel')}
            type="text"
            value={device.name}
            onBlur={() => setIsEditingName(false)}
            onChange={(event) => onNameChange(device, event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          <div className="shelly-card-title-row">
            <h3>{device.name}</h3>
            <button
              className="icon-action rule-summary-icon-action"
              type="button"
              aria-label={t('hardware.shelly.deviceNameLabel')}
              title={t('hardware.shelly.deviceNameLabel')}
              onClick={() => setIsEditingName(true)}
            >
              <IconPencil className="icon-action__svg" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="shelly-card-actions">
          <button
            className="icon-action"
            type="button"
            aria-label={t('hardware.shelly.settings')}
            title={t('hardware.shelly.settings')}
            onClick={() => onInfoOpen(device)}
          >
            <IconInfoCircle className="icon-action__svg" aria-hidden="true" />
          </button>
          <button
            className="icon-action"
            type="button"
            disabled={isControlBusy}
            aria-label={t('hardware.shelly.scanBleViaShellyTitle')}
            title={t('hardware.shelly.scanBleViaShellyTitle')}
            onClick={() => onBleScan(device)}
          >
            <IconBluetooth className="icon-action__svg" aria-hidden="true" />
          </button>
          <button
            className="icon-action icon-action--danger"
            type="button"
            aria-label={t('hardware.shelly.deleteTitle')}
            title={t('hardware.shelly.deleteTitle')}
            onClick={() => onRemove(device)}
          >
            <IconTrash className="icon-action__svg" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="shelly-state-strip">
        <span>
          {t('hardware.metrics.relay')} <strong>{controlStatus ? (controlStatus.relayOn ? 'ON' : 'OFF') : t('common.missing')}</strong>
        </span>
        <span>
          {t('hardware.metrics.mode')} <strong>{formatAutomationMode(automationMode ?? undefined, t)}</strong>
        </span>
      </div>

      <div
        className="shelly-metrics-strip"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatPlugPower(telemetry?.powerW, t)}</span>
        <span>{formatPlugVoltage(telemetry?.voltageV, t)}</span>
        <span>{formatPlugEnergy(telemetry?.energyWh, t)}</span>
        <span>{formatShellyClock(clock, t)}</span>
      </div>

      <div
        className="control-action-row shelly-control-toolbar"
        aria-label={t('hardware.shelly.controlLabel', { name: device.name })}
      >
        <button
          className={automationToggleClass}
          type="button"
          disabled={isControlBusy}
          title={automationToggleTitle}
          onClick={() =>
            automationMode === 'auto'
              ? onAutomationManual(device)
              : onAutomationAuto(device)
          }
        >
          {automationToggleLabel}
        </button>
        <button
          className={relayToggleClass}
          type="button"
          disabled={isControlBusy}
          title={relayToggleTitle}
          onClick={() =>
            controlStatus?.relayOn ? onRelayOff(device) : onRelayOn(device)
          }
        >
          {relayToggleLabel}
        </button>
      </div>
    </article>
  );
};
'''
s = s[:start] + new_card
p.write_text(s)

# One technical info modal, no saved-device settings/clock/recheck submodals.
p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = p.read_text()
s = replace_once(
    s,
    "import { IconBluetooth, IconTrash } from '@tabler/icons-react';\n",
    '',
    'page icon imports'
)
s = replace_once(
    s,
    "type ShellyStatusModalSource = 'add' | 'recheck';\ntype ShellyDialogState =\n  | { kind: 'none' }\n  | { kind: 'add' }\n  | { kind: 'scan'; returnToAdd: boolean }\n  | {\n      kind: 'status';\n      address: string | null;\n      source: ShellyStatusModalSource;\n      returnSettingsId: string | null;\n    }\n  | { kind: 'ble'; device: ShellyDraftDevice }\n  | { kind: 'settings'; deviceId: string }\n  | { kind: 'clock'; deviceId: string }\n  | { kind: 'remove'; device: ShellyDraftDevice };",
    "type ShellyDialogState =\n  | { kind: 'none' }\n  | { kind: 'add' }\n  | { kind: 'scan'; returnToAdd: boolean }\n  | { kind: 'ble'; device: ShellyDraftDevice }\n  | { kind: 'info'; deviceId: string }\n  | { kind: 'remove'; device: ShellyDraftDevice };",
    'dialog union'
)
old_vars = r'''  const isAddShellyModalOpen = dialog.kind === 'add';
  const isStatusModalOpen = dialog.kind === 'status';
  const isScanModalOpen = dialog.kind === 'scan';
  const isBleScanModalOpen = dialog.kind === 'ble';
  const bleScanShelly = dialog.kind === 'ble' ? dialog.device : null;
  const settingsShellyId = dialog.kind === 'settings' ? dialog.deviceId : null;
  const clockShellyId = dialog.kind === 'clock' ? dialog.deviceId : null;
  const shellyDevicePendingRemoval = dialog.kind === 'remove' ? dialog.device : null;
  const statusModalAddress = dialog.kind === 'status' ? dialog.address : null;
  const statusModalSource = dialog.kind === 'status' ? dialog.source : 'add';
  const statusModalReturnSettingsId =
    dialog.kind === 'status' ? dialog.returnSettingsId : null;
  const returnToAddAfterScan = dialog.kind === 'scan' && dialog.returnToAdd;
  const settingsNameInputId = useId();
  const scanRangeErrorId = useId();
  const activeShellyMutation =
    statusModalSource === 'recheck'
      ? flow.recheckShellyMutation
      : flow.checkShellyMutation;
  const isCheckingShelly = activeShellyMutation.isPending;
  const shellyCheckError = activeShellyMutation.isError
    ? activeShellyMutation.error
    : null;
  const modalTitle = isCheckingShelly
    ? t('hardware.shelly.checkingModal')
    : shellyCheckError
      ? t('hardware.shelly.checkFailedTitle')
      : t('hardware.shelly.checkedModal');
  const statusModalShellyAddress = statusModalAddress ?? shellyAddress;
  const statusModalShellyHref = /^https?:\/\//.test(statusModalShellyAddress)
    ? statusModalShellyAddress
    : undefined;'''
new_vars = r'''  const isAddShellyModalOpen = dialog.kind === 'add';
  const isScanModalOpen = dialog.kind === 'scan';
  const isBleScanModalOpen = dialog.kind === 'ble';
  const bleScanShelly = dialog.kind === 'ble' ? dialog.device : null;
  const infoShellyId = dialog.kind === 'info' ? dialog.deviceId : null;
  const shellyDevicePendingRemoval = dialog.kind === 'remove' ? dialog.device : null;
  const returnToAddAfterScan = dialog.kind === 'scan' && dialog.returnToAdd;
  const scanRangeErrorId = useId();'''
s = replace_once(s, old_vars, new_vars, 'top modal vars')
old_state = r'''  const clockShelly =
    clockShellyId === null
      ? null
      : (shellyDevices.find((device) => device.id === clockShellyId) ?? null);
  const settingsShelly =
    settingsShellyId === null
      ? null
      : (shellyDevices.find((device) => device.id === settingsShellyId) ?? null);
  const clockControlState = clockShelly ? shellyControlStates[clockShelly.id] : undefined;
  const settingsControlState = settingsShelly
    ? shellyControlStates[settingsShelly.id]
    : undefined;
  const isSettingsControlBusy = settingsControlState?.pendingAction != null;
  const settingsStatus = settingsControlState?.status;
  const clockStatus = clockControlState?.status?.clock;
  const isClockRefreshPending = clockControlState?.pendingAction === 'status';'''
new_state = r'''  const infoShelly =
    infoShellyId === null
      ? null
      : (shellyDevices.find((device) => device.id === infoShellyId) ?? null);
  const infoControlState = infoShelly ? shellyControlStates[infoShelly.id] : undefined;
  const infoStatus = infoControlState?.status;'''
s = replace_once(s, old_state, new_state, 'saved device modal state')

# Remove obsolete closeStatusModal.
start = s.find('  const closeStatusModal = () => {')
end = s.find('  const openAddShellyModal = () => {', start)
if start == -1 or end == -1:
    raise SystemExit('closeStatusModal boundaries not found')
s = s[:start] + s[end:]

# Replace recheck/settings/clock helpers with one info helper.
start = s.find('  const recheckSavedShelly = (')
end = s.find('  const confirmRemoveSavedShelly = () => {', start)
if start == -1 or end == -1:
    raise SystemExit('saved Shelly helper boundaries not found')
new_helpers = r'''  const openInfoModal = (device: ShellyDraftDevice) => {
    flow.checkShellyMutation.reset();
    flow.recheckShellyMutation.reset();
    setDialog({ kind: 'info', deviceId: device.id });
    flow.recheckShellyMutation.mutate(device);
  };

  const closeInfoModal = () => {
    flow.recheckShellyMutation.reset();
    setDialog({ kind: 'none' });
  };

  const removeSavedShelly = (device: ShellyDraftDevice) => {
    setDialog({ kind: 'remove', device });
  };

'''
s = s[:start] + new_helpers + s[end:]

# Replace settings + clock + old status modals with one info modal.
start = s.find("      <Modal\n        closeLabel={t('common.close')}\n        description={settingsShelly?.name ?? ''}")
end = s.find("      <Modal\n        busy={isBleDiscoveryBusy}", start)
if start == -1 or end == -1:
    raise SystemExit('saved Shelly modal block boundaries not found')
info_modal = r'''      <Modal
        busy={flow.recheckShellyMutation.isPending}
        closeLabel={t('common.close')}
        description={infoShelly?.baseUrl ?? ''}
        open={infoShelly !== null}
        size="diagnostic"
        title={infoShelly?.name ?? t('hardware.shelly.settings')}
        onClose={closeInfoModal}
      >
        {infoShelly && (
          <div className="settings-modal-layout">
            {flow.recheckShellyMutation.isPending && (
              <p>{t('hardware.shelly.localRpcConnecting')}</p>
            )}
            {flow.recheckShellyMutation.isError && (
              <FeedbackPanel
                tone="warning"
                title={mutationError(flow.recheckShellyMutation.error)}
              >
                {t('hardware.shelly.checkFailedDetail')}
              </FeedbackPanel>
            )}
            <div className="status-stack">
              <DiagnosticRow
                href={infoShelly.baseUrl}
                label={t('hardware.shelly.addressSettings')}
                linkLabel={t('hardware.shelly.openPanelLabel', {
                  address: infoShelly.baseUrl
                })}
                value={infoShelly.baseUrl}
              />
              <DiagnosticRow
                label={t('common.firmware')}
                value={infoStatus?.firmwareId ?? t('common.missingData')}
              />
              <DiagnosticRow
                label={t('hardware.metrics.wifiRssi')}
                value={
                  infoStatus?.telemetry.wifiRssiDbm === undefined
                    ? t('common.missing')
                    : `${infoStatus.telemetry.wifiRssiDbm} dBm`
                }
              />
              <DiagnosticRow
                label={t('hardware.shelly.uptime')}
                value={formatClockUptime(infoStatus?.clock.uptimeSec, t)}
              />
              <DiagnosticRow
                label={t('hardware.shelly.clockSync')}
                value={formatClockSyncState(infoStatus?.clock, t)}
                tone={infoStatus?.clock.timeSynced ? 'normal' : 'warning'}
              />
              <DiagnosticRow
                label="NTP"
                value={formatClockTimestamp(
                  infoStatus?.clock.lastSyncUnixTimeSec,
                  locale,
                  t
                )}
              />
            </div>
            {!flow.recheckShellyMutation.isPending &&
              !flow.recheckShellyMutation.isError &&
              flow.setupStatus && (
                <ShellyCard
                  name={infoShelly.name}
                  model={`${flow.setupStatus.deviceInfo.model}, gen ${flow.setupStatus.deviceInfo.gen}`}
                  badgeLabel={compatibilityBadge.label}
                  badgeTone={compatibilityBadge.tone}
                  rows={[
                    {
                      label: 'Scripts',
                      value: formatComponentState(flow.setupStatus.status.scripts, t)
                    },
                    {
                      label: 'Bluetooth',
                      value: formatComponentState(flow.setupStatus.status.bluetooth, t)
                    },
                    {
                      label: t('hardware.shelly.matter'),
                      value: flow.setupStatus.status.matterEnabled
                        ? t('common.enabled')
                        : t('common.disabled')
                    }
                  ]}
                />
              )}
          </div>
        )}
      </Modal>

'''
s = s[:start] + info_modal + s[end:]

old_map = r'''            onAutomationAuto={flow.setAutomationAuto}
            onAutomationManual={flow.setAutomationManual}
            onClockOpen={openClockModal}
            onRefreshControl={flow.refreshShellyControl}
            onRelayOff={flow.turnRelayOff}
            onRelayOn={flow.turnRelayOn}
            onSettingsOpen={openSettingsModal}'''
new_map = r'''            onAutomationAuto={flow.setAutomationAuto}
            onAutomationManual={flow.setAutomationManual}
            onBleScan={openBleScanModal}
            onInfoOpen={openInfoModal}
            onNameChange={(savedDevice, value) =>
              flow.setShellyDeviceName(savedDevice.id, value)
            }
            onRelayOff={flow.turnRelayOff}
            onRelayOn={flow.turnRelayOn}
            onRemove={removeSavedShelly}'''
s = replace_once(s, old_map, new_map, 'saved card props')
p.write_text(s)

# Styling.
p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
s = replace_once(
    s,
    """.shelly-card-header {
  align-items: center;
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: minmax(0, 1fr) var(--lcl-size-control-min-height);
}""",
    """.shelly-card-header {
  align-items: center;
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: minmax(0, 1fr) auto;
}""",
    'shelly header grid'
)
s = replace_once(
    s,
    """.shelly-control-toolbar {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
  margin-left: 0;
  width: 100%;
}""",
    """.shelly-control-toolbar {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-left: 0;
  width: 100%;
}""",
    'shelly toolbar'
)
s += r'''

/* Compact saved Shelly cards: UX polish 2026-09-11 */
.shelly-saved-card {
  gap: var(--lcl-spacing-sm);
}

.shelly-card-title-row,
.shelly-card-actions {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-xs);
  min-width: 0;
}

.shelly-card-title-row h3 {
  min-width: 0;
}

.shelly-card-name-input {
  min-height: var(--lcl-size-compact-control-min-height);
  min-width: 0;
  width: 100%;
}

.shelly-state-strip {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--lcl-spacing-xs) var(--lcl-spacing-lg);
}

.shelly-state-strip span {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
}

.shelly-state-strip strong {
  color: var(--lcl-color-text);
  font-weight: var(--lcl-font-weight-bold);
}
'''
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/theme/theme.css
pnpm exec eslint \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
set +e
pnpm --filter @lcl/mobile test -- hardware-setup.test.tsx
TEST_EXIT=$?
set -e

echo SHELLY_STAGE3_DRAFT_TEST_EXIT=$TEST_EXIT
git diff --check
git status --short
exit $TEST_EXIT

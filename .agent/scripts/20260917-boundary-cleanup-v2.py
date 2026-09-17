from pathlib import Path

# SensorSetupPage: keep orchestration here; move card/form rendering to presentation.
p = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s = p.read_text()
marker = 'type SensorDialogState ='
assert marker in s
prefix = """import type { SensorSetupFlow } from '../pageContracts.js';
import { useToastQueue } from '../useToastQueue.js';
import { Modal, ToastViewport } from '@lcl/ui';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { HardwarePageProps } from '../helpers.js';
import { useSensorSetupFeedback } from './useSensorSetupFeedback.js';
import {
  formatSensorMetric,
  SavedSensorCard,
  SensorAddForm,
  sensorProfileDisplayLabels
} from './SensorSetupPresentation.js';

type SensorDraftDevice = SensorSetupFlow['sensorDevices'][number];

"""
s = prefix + s[s.index(marker):]
s = s.replace("  const { locale, t } = useTranslation();", "  const { t } = useTranslation();")
s = s.replace('formatNullableMetric', 'formatSensorMetric')
s = s.replace(
"""  const readingsForSensor = (device: SensorDraftDevice): SensorReadingSample[] =>
    flow.sensorSamplesById[device.id.toUpperCase()] ?? [];
""",
"""  const readingsForSensor = (device: SensorDraftDevice) =>
    flow.sensorSamplesById[device.id.toUpperCase()] ?? [];
"""
)
start = s.index('      <div className="saved-list" aria-label={t(\'hardware.sensor.savedListLabel\')}>')
end = s.index('    </section>\n  );\n};', start)
replacement = """      <div className="saved-list" aria-label={t('hardware.sensor.savedListLabel')}>
        {flow.sensorDevices.length === 0 && <p>{t('hardware.sensor.empty')}</p>}
        {flow.sensorDevices.map((device) => (
          <SavedSensorCard
            key={device.id}
            device={device}
            samples={readingsForSensor(device)}
            isEditing={editingSensorId === device.id}
            pvvxTimePending={flow.setPvvxTimeMutation.isPending}
            onEditStart={() => setEditingSensorId(device.id)}
            onEditEnd={() => setEditingSensorId(null)}
            onNameChange={(value) => flow.setSensorDeviceName(device.id, value)}
            onPvvxSetTime={() => flow.setPvvxTimeMutation.mutate(device)}
            onRemove={() => setDialog({ kind: 'remove', device })}
          />
        ))}
      </div>
"""
s = s[:start] + replacement + s[end:]
p.write_text(s)

# ShellySetupPage: keep dialog routing/lifecycle; move settings and BLE rendering out.
p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = p.read_text()
marker = 'type ShellyDialogState ='
assert marker in s
prefix = """import type { ShellySetupFlow } from '../pageContracts.js';
import { InfoTooltip, Modal, ToastViewport } from '@lcl/ui';
import { IconPlus } from '@tabler/icons-react';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { ShellySetupScanResult } from '../../../flows/hardware-setup/shellyRequests.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import {
  formatShellyScanEstimate,
  SavedShellyDeviceCard,
  ShellyAddForm
} from './ShellySetupPresentation.js';
import {
  countIpv4RangeScanAddresses,
  normalizeShellyUrl
} from '../../../flows/hardware-setup/validation.js';
import type { HardwarePageProps } from '../helpers.js';
import { useToastQueue } from '../useToastQueue.js';
import { ShellyBleDiscoveryModal } from './ShellyBleDiscoveryModal.js';
import { ShellySettingsModal } from './ShellySettingsModal.js';
import { useShellySetupFeedback } from './useShellySetupFeedback.js';

"""
s = prefix + s[s.index(marker):]
for block in [
"""  const bleDiscoveryCandidates = flow.bleDiscoverySnapshot?.candidates ?? [];
""",
"""  const didBleDiscoveryStartFail =
    flow.bleDiscoverySnapshot?.lastReason === 'ble-scan-start-failed';
""",
"""  const compatibilityBadge = shellyCompatibilityBadge(flow.setupStatus, t);
""",
"""  const infoControlState = infoShelly ? shellyControlStates[infoShelly.id] : undefined;
  const infoStatus = infoControlState?.status;
""",
"""  const shouldShowBleRestart = Boolean(
    flow.bleDiscoverySession && flow.bleDiscoverySnapshot?.running === false
  );
"""
]:
    assert block in s, block
    s = s.replace(block, '')
s = s.replace('  const shellyControlStates = flow.shellyControlStates;\n', '')
modal_start = s.index('      <Modal\n        busy={flow.recheckShellyMutation.isPending}')
list_start = s.index('      {!addOnly && !settingsOnlyDeviceId && (', modal_start)
modal_replacement = """      <ShellySettingsModal
        flow={flow}
        device={infoShelly}
        enableBleDiscovery={enableBleDiscovery}
        onClose={closeInfoModal}
        onBleScan={openBleScanModal}
        onRemove={removeSavedShelly}
      />

      <ShellyBleDiscoveryModal
        flow={flow}
        device={bleScanShelly}
        open={isBleScanModalOpen}
        onClose={closeBleScanModal}
        onRestart={restartBleDiscovery}
        onSaveCandidate={handleDiscoveredSensor}
      />

"""
s = s[:modal_start] + modal_replacement + s[list_start:]
s = s.replace('              onAutomationAuto={flow.setAutomationAuto}\n              onAutomationManual={flow.setAutomationManual}\n', '')
s = s.replace('              onRelayOff={flow.turnRelayOff}\n              onRelayOn={flow.turnRelayOn}\n', '')
p.write_text(s)

# Saved setup Shelly card is presentation-only; automation ownership belongs to InstalledAutomation.
p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx')
s = p.read_text()
start = s.index('type SavedShellyDeviceCardProps =')
replacement = """type SavedShellyDeviceCardProps = {
  device: ShellyDraftDevice;
  controlState: ShellyControlCardState | undefined;
  onNameChange: (device: ShellyDraftDevice, value: string) => void;
  onInfoOpen: (device: ShellyDraftDevice) => void;
  onBleScan?: (device: ShellyDraftDevice) => void;
  onRemove: (device: ShellyDraftDevice) => void;
};

export const SavedShellyDeviceCard = ({
  device,
  controlState,
  onNameChange,
  onInfoOpen,
  onBleScan,
  onRemove
}: SavedShellyDeviceCardProps) => {
  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const controlStatus = controlState?.status ?? null;
  const isControlBusy =
    controlState?.pendingAction !== null && controlState?.pendingAction !== undefined;
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

      <div
        className="shelly-metrics-strip"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatPlugPower(telemetry?.powerW, t)}</span>
        <span>{formatPlugVoltage(telemetry?.voltageV, t)}</span>
        <span>{formatPlugEnergy(telemetry?.energyWh, t)}</span>
        <span>{formatShellyClock(clock, t)}</span>
      </div>

      {onBleScan && (
        <button
          className="shelly-ble-action"
          type="button"
          disabled={isControlBusy}
          title={t('hardware.shelly.scanBleViaShellyTitle')}
          onClick={() => onBleScan(device)}
        >
          <IconBluetooth className="icon-action__svg" aria-hidden="true" />
          <span>{t('hardware.shelly.scanBleViaShellyTitle')}</span>
        </button>
      )}
    </article>
  );
};
"""
s = s[:start] + replacement
p.write_text(s)

# Remove obsolete Script.Start/Stop AUTO/MANUAL path from generic setup control.
p = Path('apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts')
s = p.read_text()
s = s.replace(
    "export type ShellyControlAction = 'status' | 'on' | 'off' | 'auto' | 'manual';",
    "export type ShellyControlAction = 'status' | 'on' | 'off';"
)
a = s.index('  const requireAutomationScript =')
b = s.index('  const refreshShellyControlMutation =', a)
s = s[:a] + s[b:]
a = s.index('  const setAutomationAutoMutation =')
b = s.index('  const refreshShellyControl =', a)
s = s[:a] + s[b:]
a = s.index('  const setAutomationAuto =')
b = s.index('  const acknowledgeShellyControlFeedback', a)
s = s[:a] + s[b:]
for line in [
    '    setAutomationAutoMutation,\n',
    '    setAutomationManualMutation,\n',
    '    setAutomationAuto,\n',
    '    setAutomationManual,\n'
]:
    s = s.replace(line, '')
p.write_text(s)

# Hardware facade no longer exposes direct runtime ownership/relay mutations.
p = Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s = p.read_text()
for line in [
    '    turnRelayOn,\n', '    turnRelayOff,\n',
    '    setAutomationAuto,\n', '    setAutomationManual,\n'
]:
    s = s.replace(line, '')
p.write_text(s)

# Narrow Shelly page contract accordingly.
p = Path('apps/mobile/src/screens/hardware-setup/pageContracts.ts')
s = p.read_text()
for field in [
    "  | 'setAutomationAuto'\n", "  | 'setAutomationManual'\n",
    "  | 'turnRelayOff'\n", "  | 'turnRelayOn'\n"
]:
    s = s.replace(field, '')
p.write_text(s)

# Remove CSS dedicated only to deleted legacy setup runtime controls.
p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
start = s.index('.shelly-runtime-controls {')
end = s.index("/* Stage 6D: lightweight in-app wheel picker avoids Android's radial clock dialog. */", start)
s = s[:start] + s[end:]
p.write_text(s)

# Guardrails: no old UI ownership path remains.
for path in [
    'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts',
    'apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts',
    'apps/mobile/src/screens/hardware-setup/pageContracts.ts',
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx'
]:
    text = Path(path).read_text()
    assert 'setAutomationAuto' not in text, path
    assert 'setAutomationManual' not in text, path

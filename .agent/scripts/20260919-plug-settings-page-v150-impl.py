from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'target not found in {path}: {old[:80]!r}')
    file.write_text(text.replace(old, new, 1))


content_path = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySettingsContent.tsx')
content_path.write_text("""import { DiagnosticRow, FeedbackPanel, StatusBadge } from '@lcl/ui';
import { IconBluetooth, IconTrash } from '@tabler/icons-react';
import { useTranslation } from '../../../app/i18n.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import { mutationError } from '../helpers.js';
import type { ShellySetupFlow } from '../pageContracts.js';
import {
  formatClockSyncState,
  formatClockTimestamp,
  formatClockUptime,
  formatComponentState,
  shellyCompatibilityBadge
} from './ShellySetupPresentation.js';

type ShellySettingsContentProps = {
  flow: ShellySetupFlow;
  device: ShellyDraftDevice;
  enableBleDiscovery: boolean;
  onBleScan(device: ShellyDraftDevice): void;
  onRemove(device: ShellyDraftDevice): void;
};

export const ShellySettingsContent = ({
  flow,
  device,
  enableBleDiscovery,
  onBleScan,
  onRemove
}: ShellySettingsContentProps) => {
  const { locale, t } = useTranslation();
  const controlState = flow.shellyControlStates[device.id];
  const status = controlState?.status;
  const compatibilityBadge = shellyCompatibilityBadge(flow.setupStatus, t);

  return (
    <div className="settings-modal-layout">
      {flow.recheckShellyMutation.isError && (
        <FeedbackPanel
          tone="warning"
          title={mutationError(flow.recheckShellyMutation.error)}
        >
          {t('hardware.shelly.checkFailedDetail')}
        </FeedbackPanel>
      )}
      <div className="status-stack">
        <div className="lcl-diagnostic-row">
          <span>{t('common.model')}</span>
          <div className="lcl-compact-device__meta">
            <strong>
              {(flow.setupStatus?.deviceInfo.model ?? device.model)
                ? `${flow.setupStatus?.deviceInfo.model ?? device.model}, gen ${flow.setupStatus?.deviceInfo.gen ?? device.gen ?? '?'}`
                : t('common.missingData')}
            </strong>
            <StatusBadge tone={compatibilityBadge.tone}>
              {compatibilityBadge.label}
            </StatusBadge>
          </div>
        </div>
        <DiagnosticRow
          href={device.baseUrl}
          label={t('hardware.shelly.addressSettings')}
          linkLabel={t('hardware.shelly.openPanelLabel', { address: device.baseUrl })}
          value={device.baseUrl}
        />
        <DiagnosticRow
          label={t('common.firmware')}
          value={status?.firmwareId ?? t('common.missingData')}
        />
        <DiagnosticRow
          label={t('hardware.metrics.wifiRssi')}
          value={
            status?.telemetry.wifiRssiDbm === undefined
              ? t('common.missing')
              : `${status.telemetry.wifiRssiDbm} dBm`
          }
        />
        <DiagnosticRow
          label={t('hardware.shelly.uptime')}
          value={formatClockUptime(status?.clock.uptimeSec, t)}
        />
        <DiagnosticRow
          label="NTP"
          value={
            status
              ? `${formatClockSyncState(status.clock, t)} · ${formatClockTimestamp(
                  status.clock.lastSyncUnixTimeSec,
                  locale,
                  t
                )}`
              : t('common.missingData')
          }
          tone={status?.clock.timeSynced ? 'normal' : 'warning'}
        />
        <DiagnosticRow
          label="Scripts"
          value={
            flow.setupStatus
              ? formatComponentState(flow.setupStatus.status.scripts, t)
              : t('common.missingData')
          }
        />
        <DiagnosticRow
          label="Bluetooth"
          value={
            flow.setupStatus
              ? formatComponentState(flow.setupStatus.status.bluetooth, t)
              : t('common.missingData')
          }
        />
        <DiagnosticRow
          label={t('hardware.shelly.matter')}
          value={
            flow.setupStatus
              ? flow.setupStatus.status.matterEnabled
                ? t('common.enabled')
                : t('common.disabled')
              : t('common.missingData')
          }
        />
      </div>
      <div className="action-row">
        {enableBleDiscovery && (
          <button
            className="secondary-action"
            type="button"
            title={t('hardware.shelly.scanBleViaShellyTitle')}
            onClick={() => onBleScan(device)}
          >
            <IconBluetooth className="icon-action__svg" aria-hidden="true" />
            <span>{t('hardware.shelly.scanBleViaShellyTitle')}</span>
          </button>
        )}
        <button
          className="secondary-action secondary-action--danger"
          type="button"
          title={t('hardware.shelly.deleteTitle')}
          onClick={() => onRemove(device)}
        >
          <IconTrash className="icon-action__svg" aria-hidden="true" />
          <span>{t('hardware.shelly.deleteTitle')}</span>
        </button>
      </div>
    </div>
  );
};
""")

Path('apps/mobile/src/screens/hardware-setup/pages/ShellySettingsModal.tsx').write_text("""import { Modal } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import type { ShellySetupFlow } from '../pageContracts.js';
import { ShellySettingsContent } from './ShellySettingsContent.js';

type ShellySettingsModalProps = {
  flow: ShellySetupFlow;
  device: ShellyDraftDevice | null;
  enableBleDiscovery: boolean;
  onClose(): void;
  onBleScan(device: ShellyDraftDevice): void;
  onRemove(device: ShellyDraftDevice): void;
};

export const ShellySettingsModal = ({
  flow,
  device,
  enableBleDiscovery,
  onClose,
  onBleScan,
  onRemove
}: ShellySettingsModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      busy={flow.recheckShellyMutation.isPending}
      closeLabel={t('common.close')}
      open={device !== null}
      title={device?.name ?? t('hardware.shelly.settings')}
      onClose={onClose}
    >
      {device && (
        <ShellySettingsContent
          flow={flow}
          device={device}
          enableBleDiscovery={enableBleDiscovery}
          onBleScan={onBleScan}
          onRemove={onRemove}
        />
      )}
    </Modal>
  );
};
""")

# Shelly setup: settingsOnly mode is page content; normal setup still keeps its existing modal.
path = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace_once(
    path,
    "import { ShellySettingsModal } from './ShellySettingsModal.js';\n",
    "import { ShellySettingsContent } from './ShellySettingsContent.js';\nimport { ShellySettingsModal } from './ShellySettingsModal.js';\n",
)
replace_once(
    path,
    """      <ShellySettingsModal
        flow={flow}
        device={infoShelly}
        enableBleDiscovery={enableBleDiscovery}
        onClose={closeInfoModal}
        onBleScan={openBleScanModal}
        onRemove={removeSavedShelly}
      />
""",
    """      {settingsOnlyDeviceId && infoShelly ? (
        <div className="plug-settings-page">
          <div className="installation-section-heading">
            <h1>{infoShelly.name}</h1>
          </div>
          <ShellySettingsContent
            flow={flow}
            device={infoShelly}
            enableBleDiscovery={enableBleDiscovery}
            onBleScan={openBleScanModal}
            onRemove={removeSavedShelly}
          />
        </div>
      ) : (
        <ShellySettingsModal
          flow={flow}
          device={infoShelly}
          enableBleDiscovery={enableBleDiscovery}
          onClose={closeInfoModal}
          onBleScan={openBleScanModal}
          onRemove={removeSavedShelly}
        />
      )}
""",
)

# Dedicated routed child page. ShellySetupPage owns the existing diagnostics/BLE/delete behavior.
Path('apps/mobile/src/screens/PlugSettingsScreen.tsx').write_text("""import { useTranslation } from '../app/i18n.js';
import { AppPageBack } from '../components/AppPageBack.js';
import { useHardwareSetupFlow } from '../flows/hardware-setup/useHardwareSetupFlow.js';
import { ShellySetupPage } from './hardware-setup/pages/ShellySetupPage.js';

type PlugSettingsScreenProps = {
  deviceId: string;
  onBack(): void;
};

export const PlugSettingsScreen = ({ deviceId, onBack }: PlugSettingsScreenProps) => {
  const { t } = useTranslation();
  const flow = useHardwareSetupFlow();

  return (
    <main className="demo-shell hardware-shell">
      <AppPageBack label={t('dashboard.climateTab')} onBack={onBack} />
      <ShellySetupPage
        flow={flow}
        settingsOnlyDeviceId={deviceId}
        onSettingsClose={onBack}
      />
    </main>
  );
};
""")

# Dashboard delegates settings navigation to AppRoutes rather than mounting a working modal itself.
path = 'apps/mobile/src/screens/AutomationDashboardScreen.tsx'
text = Path(path).read_text()
old_overlay = """const PlugSettingsOverlay = ({
  deviceId,
  onClose
}: {
  deviceId: string;
  onClose(): void;
}) => {
  const flow = useHardwareSetupFlow();
  return (
    <ShellySetupPage
      flow={flow}
      settingsOnlyDeviceId={deviceId}
      onSettingsClose={onClose}
    />
  );
};

"""
if old_overlay not in text:
    raise SystemExit('PlugSettingsOverlay block not found')
text = text.replace(old_overlay, '', 1)
text = text.replace("import { ShellySetupPage } from './hardware-setup/pages/ShellySetupPage.js';\n", '', 1)
old_props = """  onAddAutomation(kind: AppNavigationKind, shellyId?: string): void;
  onOpenInstallation(installationId: string): void;
  onOpenSettings?: () => void;
};
"""
new_props = """  onAddAutomation(kind: AppNavigationKind, shellyId?: string): void;
  onOpenInstallation(installationId: string): void;
  onOpenPlugSettings(deviceId: string): void;
};
"""
if old_props not in text:
    raise SystemExit('dashboard props block not found')
text = text.replace(old_props, new_props, 1)
old_args = """  onAddThermometer,
  onAddAutomation,
  onOpenInstallation
}: AutomationDashboardScreenProps) => {
"""
new_args = """  onAddThermometer,
  onAddAutomation,
  onOpenInstallation,
  onOpenPlugSettings
}: AutomationDashboardScreenProps) => {
"""
if old_args not in text:
    raise SystemExit('dashboard args block not found')
text = text.replace(old_args, new_args, 1)
text = text.replace(
"""  const [settingsDeviceId, setSettingsDeviceId] = useState<string | null>(null);
  const closePlugSettings = useCallback(() => setSettingsDeviceId(null), []);

""",
'',
1,
)
text = text.replace(
"onOpenSettings={() => setSettingsDeviceId(device.id)}",
"onOpenSettings={() => onOpenPlugSettings(device.id)}",
1,
)
old_render = """      {settingsDeviceId && (
        <PlugSettingsOverlay
          key={settingsDeviceId}
          deviceId={settingsDeviceId}
          onClose={closePlugSettings}
        />
      )}

"""
if old_render not in text:
    raise SystemExit('dashboard settings overlay render not found')
text = text.replace(old_render, '', 1)
if text.count('useCallback') == 1:
    text = text.replace('useCallback, ', '', 1)
Path(path).write_text(text)

# App route owns the saved-Plug child page.
path = 'apps/mobile/src/routes/AppRoutes.tsx'
replace_once(
    path,
    "import { InstallationScriptScreen } from '../screens/InstallationScriptScreen.js';\n",
    "import { InstallationScriptScreen } from '../screens/InstallationScriptScreen.js';\nimport { PlugSettingsScreen } from '../screens/PlugSettingsScreen.js';\n",
)
replace_once(
    path,
    """type PrimaryAppRoute =
  | DashboardRoute
  | DeviceAddRoute
""",
    """type PrimaryAppRoute =
  | DashboardRoute
  | DeviceAddRoute
  | { type: 'plug-settings'; deviceId: string }
""",
)
replace_once(
    path,
    """  if (route.type === 'installation') return route.kind;
  if (route.type === 'device-add') return route.sourceKind;
  return route.sourceKind;
""",
    """  if (route.type === 'installation') return route.kind;
  if (route.type === 'plug-settings') return 'climate';
  if (route.type === 'device-add') return route.sourceKind;
  return route.sourceKind;
""",
)
replace_once(
    path,
    """  if (route.type === 'device-add') return route.returnTo;
  if (route.type === 'setup') {
""",
    """  if (route.type === 'device-add') return route.returnTo;
  if (route.type === 'plug-settings') return { type: 'dashboard', kind: 'climate' };
  if (route.type === 'setup') {
""",
)
replace_once(
    path,
    """        onOpenInstallation={(installationId) =>
          navigate({
            type: 'installation',
            installationId,
            kind: 'climate',
            page: 'detail'
          })
        }
      />
""",
    """        onOpenInstallation={(installationId) =>
          navigate({
            type: 'installation',
            installationId,
            kind: 'climate',
            page: 'detail'
          })
        }
        onOpenPlugSettings={(deviceId) => navigate({ type: 'plug-settings', deviceId })}
      />
""",
)
replace_once(
    path,
    """  } else if (route.type === 'device-add') {
    content = (
""",
    """  } else if (route.type === 'plug-settings') {
    content = (
      <PlugSettingsScreen
        deviceId={route.deviceId}
        onBack={() => navigate({ type: 'dashboard', kind: 'climate' })}
      />
    );
  } else if (route.type === 'device-add') {
    content = (
""",
)

print('Plug settings child-page implementation applied')

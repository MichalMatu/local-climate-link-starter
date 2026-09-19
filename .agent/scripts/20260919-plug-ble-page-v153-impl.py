from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'target not found in {path}: {old[:90]!r}')
    file.write_text(text.replace(old, new, 1))


Path('apps/mobile/src/screens/hardware-setup/pages/ShellyBleDiscoveryContent.tsx').write_text("""import { FeedbackPanel } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { ShellySetupFlow } from '../pageContracts.js';
import {
  formatBleCandidateProfile,
  formatNullableMetric
} from './ShellySetupPresentation.js';

type ShellyBleDiscoveryContentProps = {
  flow: ShellySetupFlow;
  onSaveCandidate(candidate: BleDiscoveryCandidate): void;
};

export const ShellyBleDiscoveryContent = ({
  flow,
  onSaveCandidate
}: ShellyBleDiscoveryContentProps) => {
  const { t } = useTranslation();
  const candidates = flow.bleDiscoverySnapshot?.candidates ?? [];
  const didStartFail = flow.bleDiscoverySnapshot?.lastReason === 'ble-scan-start-failed';
  const shouldShowRestart = Boolean(
    flow.bleDiscoverySession && flow.bleDiscoverySnapshot?.running === false
  );

  return (
    <>
      {didStartFail && (
        <FeedbackPanel tone="warning" title={t('hardware.shelly.scanBleStartFailed')}>
          {t('hardware.shelly.scanBleStartFailedDetail')}
        </FeedbackPanel>
      )}
      {!didStartFail && candidates.length === 0 && !shouldShowRestart && (
        <div className="scan-loading-state">
          <span className="scan-loading-state__spinner" aria-hidden="true" />
          <strong>{t('hardware.shelly.scanningBle')}</strong>
          <p>{t('hardware.shelly.scanningBleSafeOff')}</p>
        </div>
      )}
      {candidates.length > 0 && (
        <div
          className="ble-candidate-list"
          aria-label={t('hardware.sensor.foundBleListLabel')}
        >
          {candidates.map((candidate) => {
            const hasTemperature = typeof candidate.temperatureC === 'number';
            const hasHumidity = typeof candidate.humidityPct === 'number';
            const isSavedSensor = flow.sensorDevices.some(
              (sensor) =>
                sensor.runtimeAddress.toUpperCase() ===
                candidate.runtimeAddress.toUpperCase()
            );

            return (
              <article key={candidate.runtimeAddress} className="ble-candidate-item">
                <div className="ble-candidate-main">
                  <strong>{candidate.runtimeAddress}</strong>
                  <span>{formatBleCandidateProfile(candidate.profileId)}</span>
                </div>
                <dl className="ble-candidate-metrics">
                  <div>
                    <dt>RSSI</dt>
                    <dd>
                      {formatNullableMetric(
                        candidate.rssi,
                        t('common.missing'),
                        ' dBm',
                        0
                      )}
                    </dd>
                  </div>
                  {hasTemperature && (
                    <div>
                      <dt>Temp.</dt>
                      <dd>
                        {formatNullableMetric(
                          candidate.temperatureC,
                          t('common.missing'),
                          '°C'
                        )}
                      </dd>
                    </div>
                  )}
                  {hasHumidity && (
                    <div>
                      <dt>{t('hardware.metrics.humidity')}</dt>
                      <dd>
                        {formatNullableMetric(
                          candidate.humidityPct,
                          t('common.missing'),
                          '%'
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
                <button
                  className="secondary-action ble-candidate-action"
                  type="button"
                  disabled={isSavedSensor}
                  title={
                    isSavedSensor
                      ? t('hardware.sensor.saveThermometerSavedTitle')
                      : t('hardware.sensor.saveThermometerTitle')
                  }
                  onClick={() => onSaveCandidate(candidate)}
                >
                  {isSavedSensor
                    ? t('hardware.sensor.saved')
                    : t('hardware.sensor.saveThermometer')}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
};
""")

Path('apps/mobile/src/screens/hardware-setup/pages/ShellyBleDiscoveryModal.tsx').write_text("""import { Modal } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import type { ShellySetupFlow } from '../pageContracts.js';
import { ShellyBleDiscoveryContent } from './ShellyBleDiscoveryContent.js';

type ShellyBleDiscoveryModalProps = {
  flow: ShellySetupFlow;
  device: ShellyDraftDevice | null;
  open: boolean;
  onClose(): void;
  onRestart(): void;
  onSaveCandidate(candidate: BleDiscoveryCandidate): void;
};

export const ShellyBleDiscoveryModal = ({
  flow,
  device,
  open,
  onClose,
  onRestart,
  onSaveCandidate
}: ShellyBleDiscoveryModalProps) => {
  const { t } = useTranslation();
  const busy =
    flow.startBleDiscoveryMutation.isPending ||
    flow.refreshBleDiscoveryMutation.isPending ||
    flow.restartBleDiscoveryMutation.isPending ||
    flow.stopBleDiscoveryMutation.isPending;
  const shouldShowRestart = Boolean(
    flow.bleDiscoverySession && flow.bleDiscoverySnapshot?.running === false
  );

  return (
    <Modal
      busy={busy}
      closeLabel={t('common.close')}
      description={device?.name ?? ''}
      open={open}
      title={t('hardware.shelly.scanBleTitle')}
      titleInfo={{
        label: t('hardware.shelly.scanBleInfoLabel'),
        title: t('hardware.shelly.scanBleInfoTitle'),
        content: t('hardware.shelly.scanBleInfo')
      }}
      actions={
        shouldShowRestart ? (
          <button
            className="secondary-action"
            type="button"
            aria-busy={flow.restartBleDiscoveryMutation.isPending}
            disabled={busy}
            title={t('hardware.shelly.scanBleAgainTitle')}
            onClick={onRestart}
          >
            {t('hardware.shelly.scanBleAgain')}
          </button>
        ) : null
      }
      onClose={onClose}
    >
      <ShellyBleDiscoveryContent flow={flow} onSaveCandidate={onSaveCandidate} />
    </Modal>
  );
};
""")

# Shelly setup gains a routed BLE-only presentation while retaining the original modal for configurator use.
path = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace_once(
    path,
    "import { ShellyBleDiscoveryModal } from './ShellyBleDiscoveryModal.js';\n",
    "import { ShellyBleDiscoveryContent } from './ShellyBleDiscoveryContent.js';\nimport { ShellyBleDiscoveryModal } from './ShellyBleDiscoveryModal.js';\n",
)
replace_once(
    path,
    """  settingsOnlyDeviceId?: string;
  onAddRequest?: () => void;
  onSettingsClose?: () => void;
};
""",
    """  settingsOnlyDeviceId?: string;
  bleScanOnlyDeviceId?: string;
  onAddRequest?: () => void;
  onSettingsClose?: () => void;
  onBleScanPageRequest?: (device: ShellyDraftDevice) => void;
  onBleScanClose?: () => void;
};
""",
)
replace_once(
    path,
    """  settingsOnlyDeviceId,
  onAddRequest,
  onSettingsClose
}: ShellySetupPageProps) => {
""",
    """  settingsOnlyDeviceId,
  bleScanOnlyDeviceId,
  onAddRequest,
  onSettingsClose,
  onBleScanPageRequest,
  onBleScanClose
}: ShellySetupPageProps) => {
""",
)
replace_once(
    path,
    """  const isBleScanModalOpen = dialog.kind === 'ble';
  const bleScanShelly = dialog.kind === 'ble' ? dialog.device : null;
""",
    """  const isBleScanModalOpen = dialog.kind === 'ble';
  const isBleDiscoverySurfaceOpen = isBleScanModalOpen || Boolean(bleScanOnlyDeviceId);
  const bleScanShelly = dialog.kind === 'ble' ? dialog.device : null;
""",
)
replace_once(
    path,
    """  const settingsOnlyShelly =
    settingsOnlyDeviceId == null
      ? null
      : (shellyDevices.find((device) => device.id === settingsOnlyDeviceId) ?? null);
  const settingsOnlyShellyRef = useRef(settingsOnlyShelly);
""",
    """  const settingsOnlyShelly =
    settingsOnlyDeviceId == null
      ? null
      : (shellyDevices.find((device) => device.id === settingsOnlyDeviceId) ?? null);
  const bleScanOnlyShelly =
    bleScanOnlyDeviceId == null
      ? null
      : (shellyDevices.find((device) => device.id === bleScanOnlyDeviceId) ?? null);
  const settingsOnlyShellyRef = useRef(settingsOnlyShelly);
  const bleScanOnlyShellyRef = useRef(bleScanOnlyShelly);
  const resetBleDiscoveryRef = useRef(flow.resetBleDiscovery);
  const startBleDiscoveryRef = useRef(flow.startBleDiscovery);
  const stopBleDiscoveryRef = useRef(flow.stopBleDiscovery);
  const onBleScanCloseRef = useRef(onBleScanClose);
""",
)
replace_once(
    path,
    """    flow,
    isBleScanModalOpen,
    pushToast,
""",
    """    flow,
    isBleScanModalOpen: isBleDiscoverySurfaceOpen,
    pushToast,
""",
)
replace_once(
    path,
    """    settingsOnlyShellyRef.current = settingsOnlyShelly;
    recheckShellyRef.current = flow.recheckShellyMutation.mutate;
    resetRecheckShellyRef.current = flow.recheckShellyMutation.reset;
    onSettingsCloseRef.current = onSettingsClose;
  }, [
    flow.recheckShellyMutation.mutate,
    flow.recheckShellyMutation.reset,
    onSettingsClose,
    settingsOnlyShelly
  ]);
""",
    """    settingsOnlyShellyRef.current = settingsOnlyShelly;
    bleScanOnlyShellyRef.current = bleScanOnlyShelly;
    recheckShellyRef.current = flow.recheckShellyMutation.mutate;
    resetRecheckShellyRef.current = flow.recheckShellyMutation.reset;
    resetBleDiscoveryRef.current = flow.resetBleDiscovery;
    startBleDiscoveryRef.current = flow.startBleDiscovery;
    stopBleDiscoveryRef.current = flow.stopBleDiscovery;
    onSettingsCloseRef.current = onSettingsClose;
    onBleScanCloseRef.current = onBleScanClose;
  }, [
    bleScanOnlyShelly,
    flow.recheckShellyMutation.mutate,
    flow.recheckShellyMutation.reset,
    flow.resetBleDiscovery,
    flow.startBleDiscovery,
    flow.stopBleDiscovery,
    onBleScanClose,
    onSettingsClose,
    settingsOnlyShelly
  ]);
""",
)
replace_once(
    path,
    """  useEffect(() => {
    if (!settingsOnlyDeviceId) return;
    const device = settingsOnlyShellyRef.current;
    if (!device) {
      onSettingsCloseRef.current?.();
      return;
    }
    resetRecheckShellyRef.current();
    recheckShellyRef.current(device);
  }, [settingsOnlyDeviceId]);

""",
    """  useEffect(() => {
    if (!settingsOnlyDeviceId) return;
    const device = settingsOnlyShellyRef.current;
    if (!device) {
      onSettingsCloseRef.current?.();
      return;
    }
    resetRecheckShellyRef.current();
    recheckShellyRef.current(device);
  }, [settingsOnlyDeviceId]);

  useEffect(() => {
    if (!bleScanOnlyDeviceId) return undefined;
    const device = bleScanOnlyShellyRef.current;
    if (!device) {
      onBleScanCloseRef.current?.();
      return undefined;
    }
    resetBleDiscoveryRef.current();
    resetBleStopError();
    startBleDiscoveryRef.current(device);
    return () => {
      stopBleDiscoveryRef.current();
    };
  }, [bleScanOnlyDeviceId]);

""",
)
replace_once(
    path,
    """  const openBleScanModal = (device: ShellyDraftDevice) => {
    flow.resetBleDiscovery();
""",
    """  const openBleScanModal = (device: ShellyDraftDevice) => {
    if (settingsOnlyDeviceId && onBleScanPageRequest) {
      onBleScanPageRequest(device);
      return;
    }
    flow.resetBleDiscovery();
""",
)
# Suppress normal saved-device page chrome/list when rendering the routed BLE-only page.
Path(path).write_text(
    Path(path)
    .read_text()
    .replace('!addOnly && !settingsOnlyDeviceId && (', '!addOnly && !settingsOnlyDeviceId && !bleScanOnlyDeviceId && (')
)
replace_once(
    path,
    """      {settingsOnlyDeviceId && infoShelly ? (
""",
    """      {bleScanOnlyDeviceId && bleScanOnlyShelly && (
        <div className="plug-settings-page plug-ble-discovery-page">
          <div className="installation-section-heading">
            <div>
              <h1>{t('hardware.shelly.scanBleTitle')}</h1>
              <p>{bleScanOnlyShelly.name}</p>
            </div>
          </div>
          <ShellyBleDiscoveryContent flow={flow} onSaveCandidate={handleDiscoveredSensor} />
          {flow.bleDiscoverySession && flow.bleDiscoverySnapshot?.running === false && (
            <div className="action-row">
              <button
                className="secondary-action"
                type="button"
                aria-busy={flow.restartBleDiscoveryMutation.isPending}
                disabled={isBleDiscoveryBusy}
                title={t('hardware.shelly.scanBleAgainTitle')}
                onClick={restartBleDiscovery}
              >
                {t('hardware.shelly.scanBleAgain')}
              </button>
            </div>
          )}
        </div>
      )}

      {settingsOnlyDeviceId && infoShelly ? (
""",
)

# Plug settings delegates BLE discovery to AppRoutes instead of opening the setup modal.
path = 'apps/mobile/src/screens/PlugSettingsScreen.tsx'
replace_once(
    path,
    """type PlugSettingsScreenProps = {
  deviceId: string;
  onBack(): void;
};

export const PlugSettingsScreen = ({ deviceId, onBack }: PlugSettingsScreenProps) => {
""",
    """type PlugSettingsScreenProps = {
  deviceId: string;
  onBack(): void;
  onOpenBleDiscovery(deviceId: string): void;
};

export const PlugSettingsScreen = ({
  deviceId,
  onBack,
  onOpenBleDiscovery
}: PlugSettingsScreenProps) => {
""",
)
replace_once(
    path,
    """        settingsOnlyDeviceId={deviceId}
        onSettingsClose={onBack}
""",
    """        settingsOnlyDeviceId={deviceId}
        onSettingsClose={onBack}
        onBleScanPageRequest={(device) => onOpenBleDiscovery(device.id)}
""",
)

Path('apps/mobile/src/screens/PlugBleDiscoveryScreen.tsx').write_text("""import { useTranslation } from '../app/i18n.js';
import { AppPageBack } from '../components/AppPageBack.js';
import { useHardwareSetupFlow } from '../flows/hardware-setup/useHardwareSetupFlow.js';
import { ShellySetupPage } from './hardware-setup/pages/ShellySetupPage.js';

type PlugBleDiscoveryScreenProps = {
  deviceId: string;
  onBack(): void;
};

export const PlugBleDiscoveryScreen = ({
  deviceId,
  onBack
}: PlugBleDiscoveryScreenProps) => {
  const { t } = useTranslation();
  const flow = useHardwareSetupFlow();
  const device = flow.shellyDevices.find((candidate) => candidate.id === deviceId);

  return (
    <main className="demo-shell hardware-shell">
      <AppPageBack label={device?.name ?? t('hardware.shelly.settings')} onBack={onBack} />
      <ShellySetupPage
        flow={flow}
        bleScanOnlyDeviceId={deviceId}
        onBleScanClose={onBack}
      />
    </main>
  );
};
""")

# App route adds a deeper child page under Plug settings.
path = 'apps/mobile/src/routes/AppRoutes.tsx'
replace_once(
    path,
    "import { PlugSettingsScreen } from '../screens/PlugSettingsScreen.js';\n",
    "import { PlugBleDiscoveryScreen } from '../screens/PlugBleDiscoveryScreen.js';\nimport { PlugSettingsScreen } from '../screens/PlugSettingsScreen.js';\n",
)
replace_once(
    path,
    """  | DeviceAddRoute
  | { type: 'plug-settings'; deviceId: string }
""",
    """  | DeviceAddRoute
  | { type: 'plug-settings'; deviceId: string }
  | { type: 'plug-ble-discovery'; deviceId: string }
""",
)
replace_once(
    path,
    """  if (route.type === 'plug-settings') return 'climate';
  if (route.type === 'device-add') return route.sourceKind;
""",
    """  if (route.type === 'plug-settings' || route.type === 'plug-ble-discovery') {
    return 'climate';
  }
  if (route.type === 'device-add') return route.sourceKind;
""",
)
replace_once(
    path,
    """  if (route.type === 'plug-settings') return { type: 'dashboard', kind: 'climate' };
  if (route.type === 'setup') {
""",
    """  if (route.type === 'plug-ble-discovery') {
    return { type: 'plug-settings', deviceId: route.deviceId };
  }
  if (route.type === 'plug-settings') return { type: 'dashboard', kind: 'climate' };
  if (route.type === 'setup') {
""",
)
replace_once(
    path,
    """      <PlugSettingsScreen
        deviceId={route.deviceId}
        onBack={() => navigate({ type: 'dashboard', kind: 'climate' })}
      />
    );
  } else if (route.type === 'device-add') {
""",
    """      <PlugSettingsScreen
        deviceId={route.deviceId}
        onBack={() => navigate({ type: 'dashboard', kind: 'climate' })}
        onOpenBleDiscovery={(deviceId) =>
          navigate({ type: 'plug-ble-discovery', deviceId })
        }
      />
    );
  } else if (route.type === 'plug-ble-discovery') {
    content = (
      <PlugBleDiscoveryScreen
        deviceId={route.deviceId}
        onBack={() => navigate({ type: 'plug-settings', deviceId: route.deviceId })}
      />
    );
  } else if (route.type === 'device-add') {
""",
)

print('Plug BLE discovery child-page implementation applied')

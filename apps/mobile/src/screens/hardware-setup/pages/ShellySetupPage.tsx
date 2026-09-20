import type { ShellySetupFlow } from '../pageContracts.js';
import { InfoLabel } from '@lcl/ui';
import { AppToastViewport } from '../../../components/AppToastViewport.js';
import { IconPlus } from '@tabler/icons-react';
import { useRef } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import { SavedShellyDeviceCard } from './ShellySetupPresentation.js';
import {
  PlugAddPage,
  isSameShellyDevice,
  PlugDeleteConfirmModal,
  type PlugScanResultView,
  usePlugManagementSurface
} from '../../../features/plugs/index.js';
import {
  countIpv4RangeScanAddresses,
  normalizeShellyUrl
} from '../../../flows/hardware-setup/validation.js';
import type { HardwarePageProps } from '../helpers.js';
import { useToastQueue } from '../useToastQueue.js';
import { ShellyBleDiscoveryContent } from './ShellyBleDiscoveryContent.js';
import { ShellyBleDiscoveryModal } from './ShellyBleDiscoveryModal.js';
import { ShellySettingsContent } from './ShellySettingsContent.js';
import { ShellySettingsModal } from './ShellySettingsModal.js';
import { useShellySetupFeedback } from './useShellySetupFeedback.js';

const normalizeScanBaseUrl = (value: string): string => {
  try {
    return normalizeShellyUrl(value);
  } catch {
    return value.trim().replace(/\/+$/, '').toLowerCase();
  }
};

type ShellySetupPageProps = HardwarePageProps<ShellySetupFlow> & {
  enableBleDiscovery?: boolean;
  addOnly?: boolean;
  settingsOnlyDeviceId?: string;
  bleScanOnlyDeviceId?: string;
  onAddRequest?: () => void;
  onSettingsClose?: () => void;
  onSettingsPageRequest?: (device: ShellyDraftDevice) => void;
  onBleScanPageRequest?: (device: ShellyDraftDevice) => void;
  onBleScanClose?: () => void;
};

export const ShellySetupPage = ({
  flow,
  enableBleDiscovery = true,
  addOnly = false,
  settingsOnlyDeviceId,
  bleScanOnlyDeviceId,
  onAddRequest,
  onSettingsClose,
  onSettingsPageRequest,
  onBleScanPageRequest,
  onBleScanClose
}: ShellySetupPageProps) => {
  const { t } = useTranslation();
  const isShellyScanActive = flow.shellyScanMutation.isPending && !flow.shellyScanStopped;
  const isAnyShellyCheckPending =
    flow.checkShellyMutation.isPending ||
    flow.recheckShellyMutation.isPending ||
    isShellyScanActive;
  const { dismissToast, pushToast, toasts } = useToastQueue('shelly-toast');
  const scanResults = flow.shellyScanResults;
  const shellyDevices = flow.shellyDevices;
  const isScanStopped =
    flow.shellyScanStopped || flow.shellyScanMutation.data?.stopped === true;
  const shellyScanRangeError = (() => {
    try {
      countIpv4RangeScanAddresses(flow.shellyScanStartInput, flow.shellyScanEndInput);
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : t('hardware.shelly.scanRangeFailed');
    }
  })();
  const isBleDiscoveryBusy =
    flow.startBleDiscoveryMutation.isPending ||
    flow.refreshBleDiscoveryMutation.isPending ||
    flow.restartBleDiscoveryMutation.isPending ||
    flow.stopBleDiscoveryMutation.isPending;
  const resetBleStopErrorRef = useRef<() => void>(() => undefined);
  const management = usePlugManagementSurface({
    devices: shellyDevices,
    settingsOnlyDeviceId,
    bleScanOnlyDeviceId,
    bleBusy: isBleDiscoveryBusy,
    onSettingsPageRequest,
    onBleScanPageRequest,
    onSettingsClose,
    onBleScanClose,
    resetPlugCheck: flow.checkShellyMutation.reset,
    resetSettingsCheck: flow.recheckShellyMutation.reset,
    recheckSettings: (device) => flow.recheckShellyMutation.mutate(device),
    resetBleDiscovery: flow.resetBleDiscovery,
    beforeBleStart: () => resetBleStopErrorRef.current(),
    startBleDiscovery: flow.startBleDiscovery,
    stopBleDiscovery: flow.stopBleDiscovery,
    removeDevice: flow.removeShellyDevice,
    onDeviceRemoved: () => pushToast('ok', t('hardware.shelly.removed'))
  });
  const { resetBleStopError } = useShellySetupFeedback({
    flow,
    isBleScanModalOpen: management.isBleDiscoverySurfaceOpen,
    pushToast,
    suppressControlFeedbackDeviceId: settingsOnlyDeviceId ?? null,
    t
  });
  resetBleStopErrorRef.current = resetBleStopError;

  const addManualShelly = (onSuccess: () => void) => {
    flow.recheckShellyMutation.reset();
    flow.checkShellyMutation.reset();
    if (!flow.shellyInputState.ok) {
      return;
    }
    flow.checkShellyMutation.mutate(undefined, {
      onSuccess: () => {
        onSuccess();
        pushToast('ok', t('hardware.shelly.added'));
      },
      onError: () => {
        pushToast(
          'warning',
          t('hardware.shelly.checkFailedTitle'),
          t('hardware.shelly.checkFailedDetail')
        );
      }
    });
  };

  const addScannedShellyDevice = (baseUrl: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    flow.recheckShellyMutation.reset();
    flow.checkShellyMutation.reset();
    flow.checkShellyMutation.mutate(
      { baseUrl, name: trimmedName },
      {
        onSuccess: () => {
          pushToast('ok', t('hardware.shelly.added'));
        },
        onError: () => {
          pushToast(
            'warning',
            t('hardware.shelly.checkFailedTitle'),
            t('hardware.shelly.checkFailedDetail')
          );
        }
      }
    );
  };

  const plugScanResults: PlugScanResultView[] = scanResults.map((result) => ({
    baseUrl: result.baseUrl,
    model: result.deviceInfo.model,
    generation: result.deviceInfo.gen,
    saved:
      Boolean(result.deviceInfo.id?.trim()) &&
      shellyDevices.some((device) =>
        isSameShellyDevice(device.id, result.deviceInfo.id ?? '')
      ),
    adding:
      flow.checkShellyMutation.isPending &&
      flow.checkShellyMutation.variables != null &&
      normalizeScanBaseUrl(flow.checkShellyMutation.variables.baseUrl) ===
        normalizeScanBaseUrl(result.baseUrl)
  }));

  const handleDiscoveredSensor = (candidate: BleDiscoveryCandidate) => {
    flow.addDiscoveredSensor(candidate, 'shelly-scan');
    pushToast('ok', t('hardware.shelly.thermometerSaved'));
  };

  return (
    <section
      className={addOnly ? 'device-add-page shelly-add-page' : 'demo-panel'}
      aria-label={addOnly ? t('hardware.shelly.add') : t('hardware.shelly.regionLabel')}
    >
      {!addOnly && !settingsOnlyDeviceId && !bleScanOnlyDeviceId && (
        <button
          className="primary-action setup-add-fab"
          type="button"
          aria-label={t('hardware.shelly.add')}
          title={t('hardware.shelly.addTitle')}
          onClick={onAddRequest}
        >
          <IconPlus className="setup-add-fab__icon" aria-hidden="true" />
        </button>
      )}

      {addOnly && (
        <PlugAddPage
          manual={{
            name: flow.shellyNameInput,
            url: flow.shellyUrlInput,
            valid: flow.shellyInputState.ok,
            nameError: flow.shellyInputState.ok
              ? undefined
              : flow.shellyInputState.fieldErrors.name,
            urlError: flow.shellyInputState.ok
              ? undefined
              : flow.shellyInputState.fieldErrors.url,
            pending: flow.checkShellyMutation.isPending,
            disabled: isAnyShellyCheckPending,
            onNameChange: flow.setShellyNameInput,
            onUrlChange: flow.setShellyUrlInput,
            onSubmit: addManualShelly
          }}
          scan={{
            startInput: flow.shellyScanStartInput,
            endInput: flow.shellyScanEndInput,
            rangeError: shellyScanRangeError,
            active: isShellyScanActive,
            success: flow.shellyScanMutation.isSuccess,
            stopped: isScanStopped,
            results: plugScanResults,
            checkPending: flow.checkShellyMutation.isPending,
            onStartInputChange: flow.setShellyScanStartInput,
            onEndInputChange: flow.setShellyScanEndInput,
            onStart: flow.startShellyScan,
            onStop: flow.stopShellyScan,
            onAddResult: addScannedShellyDevice
          }}
        />
      )}

      <PlugDeleteConfirmModal
        deviceName={management.removePendingDevice?.name ?? null}
        onClose={management.cancelRemove}
        onConfirm={management.confirmRemove}
      />

      {bleScanOnlyDeviceId && management.bleScanOnlyDevice && (
        <div className="plug-settings-page plug-ble-discovery-page">
          <div className="installation-section-heading">
            <div>
              <h1>{t('hardware.shelly.scanBleTitle')}</h1>
              <p>
                <InfoLabel
                  label={management.bleScanOnlyDevice.name}
                  infoLabel={t('hardware.shelly.scanBleInfoLabel')}
                  title={t('hardware.shelly.scanBleInfoTitle')}
                >
                  {t('hardware.shelly.scanBleInfo')}
                </InfoLabel>
              </p>
            </div>
          </div>
          <ShellyBleDiscoveryContent
            flow={flow}
            onSaveCandidate={handleDiscoveredSensor}
          />
          {flow.bleDiscoverySession && flow.bleDiscoverySnapshot?.running === false && (
            <div className="action-row">
              <button
                className="secondary-action"
                type="button"
                aria-busy={flow.restartBleDiscoveryMutation.isPending}
                disabled={isBleDiscoveryBusy}
                title={t('hardware.shelly.scanBleAgainTitle')}
                onClick={flow.restartBleDiscovery}
              >
                {t('hardware.shelly.scanBleAgain')}
              </button>
            </div>
          )}
        </div>
      )}

      {settingsOnlyDeviceId && management.infoDevice ? (
        <div className="plug-settings-page">
          <div className="installation-section-heading">
            <h1>{management.infoDevice.name}</h1>
          </div>
          <ShellySettingsContent
            flow={flow}
            device={management.infoDevice}
            enableBleDiscovery={enableBleDiscovery}
            onBleScan={management.openBleScan}
            onRemove={management.requestRemove}
          />
        </div>
      ) : (
        <ShellySettingsModal
          flow={flow}
          device={management.infoDevice}
          enableBleDiscovery={enableBleDiscovery}
          onClose={management.closeInfo}
          onBleScan={management.openBleScan}
          onRemove={management.requestRemove}
        />
      )}

      <ShellyBleDiscoveryModal
        flow={flow}
        device={management.bleModalDevice}
        open={management.isBleModalOpen}
        onClose={management.closeBleScan}
        onRestart={flow.restartBleDiscovery}
        onSaveCandidate={handleDiscoveredSensor}
      />

      {!addOnly && !settingsOnlyDeviceId && !bleScanOnlyDeviceId && (
        <div className="saved-list" aria-label={t('hardware.shelly.savedListLabel')}>
          {flow.shellyDevices.length === 0 && <p>{t('hardware.shelly.empty')}</p>}
          {flow.shellyDevices.map((device) => (
            <SavedShellyDeviceCard
              key={device.id}
              controlState={flow.shellyControlStates[device.id]}
              device={device}
              {...(enableBleDiscovery ? { onBleScan: management.openBleScan } : {})}
              onInfoOpen={management.openInfo}
              onNameChange={(savedDevice, value) =>
                flow.setShellyDeviceName(savedDevice.id, value)
              }
              onRemove={management.requestRemove}
            />
          ))}
        </div>
      )}
      <AppToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </section>
  );
};

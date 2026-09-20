import type { ShellySetupFlow } from '../pageContracts.js';
import { InfoLabel, Modal } from '@lcl/ui';
import { AppToastViewport } from '../../../components/AppToastViewport.js';
import { IconPlus } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import { SavedShellyDeviceCard } from './ShellySetupPresentation.js';
import { PlugAddPage, type PlugScanResultView } from '../../../features/plugs/index.js';
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

type ShellyDialogState =
  | { kind: 'none' }
  | { kind: 'ble'; device: ShellyDraftDevice }
  | { kind: 'info'; deviceId: string }
  | { kind: 'remove'; device: ShellyDraftDevice };
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
  const [dialog, setDialog] = useState<ShellyDialogState>(() =>
    settingsOnlyDeviceId
      ? { kind: 'info', deviceId: settingsOnlyDeviceId }
      : { kind: 'none' }
  );
  const { dismissToast, pushToast, toasts } = useToastQueue('shelly-toast');
  const isBleScanModalOpen = dialog.kind === 'ble';
  const isBleDiscoverySurfaceOpen = isBleScanModalOpen || Boolean(bleScanOnlyDeviceId);
  const bleScanShelly = dialog.kind === 'ble' ? dialog.device : null;
  const infoShellyId = dialog.kind === 'info' ? dialog.deviceId : null;
  const shellyDevicePendingRemoval = dialog.kind === 'remove' ? dialog.device : null;
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
  const infoShelly =
    infoShellyId === null
      ? null
      : (shellyDevices.find((device) => device.id === infoShellyId) ?? null);
  const settingsOnlyShelly =
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
  const recheckShellyRef = useRef(flow.recheckShellyMutation.mutate);
  const resetRecheckShellyRef = useRef(flow.recheckShellyMutation.reset);
  const onSettingsCloseRef = useRef(onSettingsClose);
  const { resetBleStopError } = useShellySetupFeedback({
    flow,
    isBleScanModalOpen: isBleDiscoverySurfaceOpen,
    pushToast,
    suppressControlFeedbackDeviceId: settingsOnlyDeviceId ?? null,
    t
  });
  const resetBleStopErrorRef = useRef(resetBleStopError);
  resetBleStopErrorRef.current = resetBleStopError;

  useEffect(() => {
    settingsOnlyShellyRef.current = settingsOnlyShelly;
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

  useEffect(() => {
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
    resetBleStopErrorRef.current();
    startBleDiscoveryRef.current(device);
    return () => {
      stopBleDiscoveryRef.current();
    };
  }, [bleScanOnlyDeviceId]);

  const addManualShelly = (onSuccess: () => void) => {
    flow.recheckShellyMutation.reset();
    flow.checkShellyMutation.reset();
    if (!flow.shellyInputState.ok) {
      return;
    }
    flow.checkShellyMutation.mutate(undefined, {
      onSuccess: () => {
        onSuccess();
        setDialog({ kind: 'none' });
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
    saved: shellyDevices.some(
      (device) =>
        normalizeScanBaseUrl(device.baseUrl) === normalizeScanBaseUrl(result.baseUrl)
    ),
    adding:
      flow.checkShellyMutation.isPending &&
      flow.checkShellyMutation.variables != null &&
      normalizeScanBaseUrl(flow.checkShellyMutation.variables.baseUrl) ===
        normalizeScanBaseUrl(result.baseUrl)
  }));

  const openBleScanModal = (device: ShellyDraftDevice) => {
    if (onBleScanPageRequest) {
      onBleScanPageRequest(device);
      return;
    }
    flow.resetBleDiscovery();
    resetBleStopError();
    setDialog({ kind: 'ble', device });
    flow.startBleDiscovery(device);
  };

  const closeBleScanModal = () => {
    if (isBleDiscoveryBusy) {
      return;
    }
    flow.stopBleDiscovery();
    if (settingsOnlyDeviceId && bleScanShelly) {
      setDialog({ kind: 'info', deviceId: bleScanShelly.id });
      return;
    }
    setDialog({ kind: 'none' });
  };

  const restartBleDiscovery = () => {
    flow.restartBleDiscovery();
  };

  const handleDiscoveredSensor = (candidate: BleDiscoveryCandidate) => {
    flow.addDiscoveredSensor(candidate, 'shelly-scan');
    pushToast('ok', t('hardware.shelly.thermometerSaved'));
  };

  const openInfoModal = (device: ShellyDraftDevice) => {
    flow.checkShellyMutation.reset();
    flow.recheckShellyMutation.reset();
    if (onSettingsPageRequest) {
      onSettingsPageRequest(device);
      return;
    }
    setDialog({ kind: 'info', deviceId: device.id });
    flow.recheckShellyMutation.mutate(device);
  };

  const closeInfoModal = () => {
    flow.recheckShellyMutation.reset();
    setDialog({ kind: 'none' });
    if (settingsOnlyDeviceId) onSettingsClose?.();
  };

  const removeSavedShelly = (device: ShellyDraftDevice) => {
    setDialog({ kind: 'remove', device });
  };

  const confirmRemoveSavedShelly = () => {
    if (!shellyDevicePendingRemoval) {
      return;
    }

    flow.removeShellyDevice(shellyDevicePendingRemoval.id);
    setDialog({ kind: 'none' });
    pushToast('ok', t('hardware.shelly.removed'));
    if (settingsOnlyDeviceId) onSettingsClose?.();
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

      <Modal
        closeLabel={t('common.cancel')}
        description={shellyDevicePendingRemoval?.name ?? ''}
        open={shellyDevicePendingRemoval !== null}
        title={t('hardware.shelly.deleteConfirmTitle')}
        actions={
          <button
            className="secondary-action secondary-action--danger"
            type="button"
            title={t('hardware.shelly.deleteTitle')}
            onClick={confirmRemoveSavedShelly}
          >
            {t('common.delete')}
          </button>
        }
        onClose={() =>
          settingsOnlyDeviceId
            ? setDialog({ kind: 'info', deviceId: settingsOnlyDeviceId })
            : setDialog({ kind: 'none' })
        }
      >
        <p>{t('hardware.shelly.deleteDescription')}</p>
      </Modal>

      {bleScanOnlyDeviceId && bleScanOnlyShelly && (
        <div className="plug-settings-page plug-ble-discovery-page">
          <div className="installation-section-heading">
            <div>
              <h1>{t('hardware.shelly.scanBleTitle')}</h1>
              <p>
                <InfoLabel
                  label={bleScanOnlyShelly.name}
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
                onClick={restartBleDiscovery}
              >
                {t('hardware.shelly.scanBleAgain')}
              </button>
            </div>
          )}
        </div>
      )}

      {settingsOnlyDeviceId && infoShelly ? (
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

      <ShellyBleDiscoveryModal
        flow={flow}
        device={bleScanShelly}
        open={isBleScanModalOpen}
        onClose={closeBleScanModal}
        onRestart={restartBleDiscovery}
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
              {...(enableBleDiscovery ? { onBleScan: openBleScanModal } : {})}
              onInfoOpen={openInfoModal}
              onNameChange={(savedDevice, value) =>
                flow.setShellyDeviceName(savedDevice.id, value)
              }
              onRemove={removeSavedShelly}
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

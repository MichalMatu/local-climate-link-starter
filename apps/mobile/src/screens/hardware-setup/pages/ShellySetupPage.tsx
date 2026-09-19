import type { ShellySetupFlow } from '../pageContracts.js';
import { Modal, ToastViewport } from '@lcl/ui';
import { IconPlus } from '@tabler/icons-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { ShellySetupScanResult } from '../../../flows/hardware-setup/shellyRequests.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import { SavedShellyDeviceCard, ShellyAddForm } from './ShellySetupPresentation.js';
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
  const [didSubmitShellyAdd, setDidSubmitShellyAdd] = useState(false);
  const [didSubmitShellyScan, setDidSubmitShellyScan] = useState(false);
  const [scanResultNames, setScanResultNames] = useState<Record<string, string>>({});
  const [activeAddSection, setActiveAddSection] = useState<'manual' | 'scan'>('scan');
  const { dismissToast, pushToast, toasts } = useToastQueue('shelly-toast');
  const isBleScanModalOpen = dialog.kind === 'ble';
  const isBleDiscoverySurfaceOpen = isBleScanModalOpen || Boolean(bleScanOnlyDeviceId);
  const bleScanShelly = dialog.kind === 'ble' ? dialog.device : null;
  const infoShellyId = dialog.kind === 'info' ? dialog.deviceId : null;
  const shellyDevicePendingRemoval = dialog.kind === 'remove' ? dialog.device : null;
  const scanRangeErrorId = useId();
  const scanResults = flow.shellyScanResults;
  const shellyDevices = flow.shellyDevices;
  const isScanStopped =
    flow.shellyScanStopped || flow.shellyScanMutation.data?.stopped === true;
  const shouldShowEmptyScanResult =
    flow.shellyScanMutation.isSuccess && !isScanStopped && scanResults.length === 0;
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
  const showShellyScanRangeError = didSubmitShellyScan && shellyScanRangeError !== null;
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
    resetBleStopError();
    startBleDiscoveryRef.current(device);
    return () => {
      stopBleDiscoveryRef.current();
    };
  }, [bleScanOnlyDeviceId]);

  const checkShelly = () => {
    setDidSubmitShellyAdd(true);
    flow.recheckShellyMutation.reset();
    flow.checkShellyMutation.reset();
    if (!flow.shellyInputState.ok) {
      return;
    }
    flow.checkShellyMutation.mutate(undefined, {
      onSuccess: () => {
        setDidSubmitShellyAdd(false);
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

  const startShellyScan = () => {
    setDidSubmitShellyScan(true);
    if (shellyScanRangeError) {
      return;
    }
    setScanResultNames({});
    flow.startShellyScan();
  };

  const stopShellyScan = () => {
    flow.stopShellyScan();
  };

  const selectAddSection = (section: 'manual' | 'scan') => {
    if (section === activeAddSection) {
      return;
    }
    if (activeAddSection === 'scan' && isShellyScanActive) {
      flow.stopShellyScan();
    }
    setActiveAddSection(section);
  };

  const scannedShellyName = (result: ShellySetupScanResult) =>
    scanResultNames[result.baseUrl] ?? result.deviceInfo.model;

  const setScannedShellyName = (result: ShellySetupScanResult, value: string) => {
    setScanResultNames((current) => ({ ...current, [result.baseUrl]: value }));
  };

  const isAddingScannedShelly = (result: ShellySetupScanResult) =>
    flow.checkShellyMutation.isPending &&
    flow.checkShellyMutation.variables != null &&
    normalizeScanBaseUrl(flow.checkShellyMutation.variables.baseUrl) ===
      normalizeScanBaseUrl(result.baseUrl);

  const addScannedShellyDevice = (result: ShellySetupScanResult) => {
    const name = scannedShellyName(result).trim();
    if (!name) {
      return;
    }
    flow.recheckShellyMutation.reset();
    flow.checkShellyMutation.reset();
    flow.checkShellyMutation.mutate(
      { baseUrl: result.baseUrl, name },
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

  const isSavedShellyScanResult = (result: ShellySetupScanResult) =>
    shellyDevices.some(
      (device) =>
        normalizeScanBaseUrl(device.baseUrl) === normalizeScanBaseUrl(result.baseUrl)
    );

  const openBleScanModal = (device: ShellyDraftDevice) => {
    if (settingsOnlyDeviceId && onBleScanPageRequest) {
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
        <>
          <div className="device-add-page__body">
            <div
              className="shelly-add-tabs"
              role="tablist"
              aria-label={t('hardware.shelly.add')}
            >
              <button
                className="shelly-add-tabs__tab"
                type="button"
                role="tab"
                aria-selected={activeAddSection === 'scan'}
                onClick={() => selectAddSection('scan')}
              >
                {t('hardware.shelly.scanNetwork')}
              </button>
              <button
                className="shelly-add-tabs__tab"
                type="button"
                role="tab"
                aria-selected={activeAddSection === 'manual'}
                onClick={() => selectAddSection('manual')}
              >
                {t('hardware.shelly.addManual')}
              </button>
            </div>
            {activeAddSection === 'manual' && (
              <section
                className="shelly-manual-add"
                role="tabpanel"
                aria-label={t('hardware.shelly.addManual')}
              >
                <div className="shelly-manual-add__body">
                  <ShellyAddForm flow={flow} showValidationErrors={didSubmitShellyAdd} />
                  <div className="shelly-manual-add__actions">
                    <button
                      className="primary-action"
                      type="button"
                      aria-busy={flow.checkShellyMutation.isPending || undefined}
                      disabled={isAnyShellyCheckPending}
                      title={t('hardware.shelly.addCheckedTitle')}
                      onClick={checkShelly}
                    >
                      {flow.checkShellyMutation.isPending
                        ? t('hardware.shelly.checking')
                        : t('common.add')}
                    </button>
                  </div>
                </div>
              </section>
            )}
            {activeAddSection === 'scan' && (
              <section
                className="shelly-network-scan"
                role="tabpanel"
                aria-label={t('hardware.shelly.scanNetwork')}
              >
                <div className="shelly-network-scan__body">
                  <div className="shelly-network-scan__range">
                    <label
                      className={
                        showShellyScanRangeError ? 'field field--invalid' : 'field'
                      }
                    >
                      {t('hardware.shelly.scanRangeStart')}
                      <input
                        aria-describedby={
                          showShellyScanRangeError ? scanRangeErrorId : undefined
                        }
                        aria-invalid={showShellyScanRangeError}
                        type="text"
                        inputMode="numeric"
                        placeholder="192.168.0.1"
                        value={flow.shellyScanStartInput}
                        onChange={(event) =>
                          flow.setShellyScanStartInput(event.currentTarget.value)
                        }
                      />
                    </label>
                    <label
                      className={
                        showShellyScanRangeError ? 'field field--invalid' : 'field'
                      }
                    >
                      {t('hardware.shelly.scanRangeEnd')}
                      <input
                        aria-describedby={
                          showShellyScanRangeError ? scanRangeErrorId : undefined
                        }
                        aria-invalid={showShellyScanRangeError}
                        type="text"
                        inputMode="numeric"
                        placeholder="192.168.0.99"
                        value={flow.shellyScanEndInput}
                        onChange={(event) =>
                          flow.setShellyScanEndInput(event.currentTarget.value)
                        }
                      />
                      {showShellyScanRangeError && (
                        <span className="field__error" id={scanRangeErrorId}>
                          {shellyScanRangeError}
                        </span>
                      )}
                    </label>
                  </div>
                  {shouldShowEmptyScanResult && (
                    <p>{t('hardware.shelly.scanResultEmpty')}</p>
                  )}
                  {scanResults.length > 0 && (
                    <div
                      className="saved-list"
                      aria-label={t('hardware.shelly.foundListLabel')}
                    >
                      {scanResults.map((result) => (
                        <article
                          key={result.baseUrl}
                          className="device-discovery-card shelly-scan-result"
                        >
                          <div className="device-discovery-card__primary">
                            <label className="device-discovery-card__name">
                              <span>{t('hardware.shelly.deviceNameLabel')}</span>
                              <input
                                className="device-discovery-card__name-input shelly-scan-result__name-input"
                                aria-label={`${t('hardware.shelly.deviceNameLabel')}: ${result.baseUrl}`}
                                type="text"
                                value={scannedShellyName(result)}
                                disabled={isSavedShellyScanResult(result)}
                                onChange={(event) =>
                                  setScannedShellyName(result, event.currentTarget.value)
                                }
                              />
                            </label>
                            <button
                              aria-label={
                                isSavedShellyScanResult(result)
                                  ? `${t('hardware.shelly.alreadyAdded')}: ${result.baseUrl}`
                                  : `${t('common.add')}: ${result.baseUrl}`
                              }
                              aria-busy={isAddingScannedShelly(result) || undefined}
                              className="primary-action device-discovery-card__action shelly-scan-result__add"
                              type="button"
                              disabled={
                                isSavedShellyScanResult(result) ||
                                flow.checkShellyMutation.isPending ||
                                scannedShellyName(result).trim().length === 0
                              }
                              onClick={() => addScannedShellyDevice(result)}
                            >
                              {isSavedShellyScanResult(result)
                                ? t('hardware.shelly.alreadyAdded')
                                : isAddingScannedShelly(result)
                                  ? t('hardware.shelly.checking')
                                  : t('common.add')}
                            </button>
                          </div>
                          <div className="device-discovery-card__meta shelly-scan-result__meta">
                            <strong className="device-discovery-card__identity">
                              {result.baseUrl}
                            </strong>
                            <span>
                              {result.deviceInfo.model}, gen {result.deviceInfo.gen}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  <div className="action-row shelly-network-scan__actions device-add-page__scan-control">
                    <button
                      className="secondary-action device-scan-action"
                      type="button"
                      aria-busy={isShellyScanActive || undefined}
                      title={
                        isShellyScanActive
                          ? t('hardware.shelly.scanStopTitle')
                          : t('hardware.shelly.scanStartTitle')
                      }
                      onClick={isShellyScanActive ? stopShellyScan : startShellyScan}
                    >
                      {isShellyScanActive && (
                        <span
                          className="device-scan-action__spinner"
                          aria-hidden="true"
                        />
                      )}
                      <span>
                        {isShellyScanActive
                          ? t('hardware.shelly.scanStop')
                          : t('hardware.shelly.scanStart')}
                      </span>
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </>
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
              <p>{bleScanOnlyShelly.name}</p>
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
      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </section>
  );
};

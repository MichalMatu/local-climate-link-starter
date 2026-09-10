import {
  DiagnosticRow,
  FeedbackPanel,
  InfoTooltip,
  Modal,
  ShellyCard,
  ToastViewport,
  type ToastMessage,
  type ToastTone
} from '@lcl/ui';
import { IconBluetooth, IconTrash } from '@tabler/icons-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { ShellySetupScanResult } from '../../../flows/hardware-setup/shellyRequests.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import {
  formatAutomationMode,
  formatBleCandidateProfile,
  formatClockSyncState,
  formatClockTimestamp,
  formatClockUptime,
  formatComponentState,
  formatNullableMetric,
  formatPlugEnergy,
  formatPlugPower,
  formatPlugVoltage,
  formatShellyClock,
  formatShellyScanEstimate,
  SavedShellyDeviceCard,
  ShellyAddForm,
  shellyCompatibilityBadge
} from './ShellySetupPresentation.js';
import { countIpv4RangeScanAddresses } from '../../../flows/hardware-setup/validation.js';
import { mutationError, shellyAddressLabel, type HardwarePageProps } from '../helpers.js';

type ShellyStatusModalSource = 'add' | 'recheck';
const SHELLY_AP_PANEL_URL = 'http://192.168.33.1/';

export const ShellySetupPage = ({ flow }: HardwarePageProps) => {
  const { locale, t } = useTranslation();
  const shellyAddress = shellyAddressLabel(flow);
  const isShellyScanActive = flow.shellyScanMutation.isPending && !flow.shellyScanStopped;
  const isAnyShellyCheckPending =
    flow.checkShellyMutation.isPending ||
    flow.recheckShellyMutation.isPending ||
    isShellyScanActive;
  const [isAddShellyModalOpen, setIsAddShellyModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isBleScanModalOpen, setIsBleScanModalOpen] = useState(false);
  const [bleScanShelly, setBleScanShelly] = useState<ShellyDraftDevice | null>(null);
  const [settingsShellyId, setSettingsShellyId] = useState<string | null>(null);
  const [clockShellyId, setClockShellyId] = useState<string | null>(null);
  const [shellyDevicePendingRemoval, setShellyDevicePendingRemoval] =
    useState<ShellyDraftDevice | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [statusModalAddress, setStatusModalAddress] = useState<string | null>(null);
  const [statusModalSource, setStatusModalSource] =
    useState<ShellyStatusModalSource>('add');
  const [statusModalReturnSettingsId, setStatusModalReturnSettingsId] = useState<
    string | null
  >(null);
  const [didSubmitShellyAdd, setDidSubmitShellyAdd] = useState(false);
  const [didSubmitShellyScan, setDidSubmitShellyScan] = useState(false);
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
    : undefined;
  const shellyScanEstimate = formatShellyScanEstimate(
    flow.shellyScanStartInput,
    flow.shellyScanEndInput,
    locale,
    t
  );
  const scanResults = flow.shellyScanMutation.data?.results ?? [];
  const shellyControlStates = flow.shellyControlStates;
  const shellyDevices = flow.shellyDevices;
  const refreshShellyControl = flow.refreshShellyControl;
  const acknowledgeShellyControlFeedback = flow.acknowledgeShellyControlFeedback;
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
  const bleDiscoveryCandidates = flow.bleDiscoverySnapshot?.candidates ?? [];
  const didBleDiscoveryStartFail =
    flow.bleDiscoverySnapshot?.lastReason === 'ble-scan-start-failed';
  const compatibilityBadge = shellyCompatibilityBadge(flow.setupStatus, t);
  const isBleDiscoveryBusy =
    flow.startBleDiscoveryMutation.isPending ||
    flow.refreshBleDiscoveryMutation.isPending ||
    flow.restartBleDiscoveryMutation.isPending ||
    flow.stopBleDiscoveryMutation.isPending;
  const clockShelly =
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
  const isClockRefreshPending = clockControlState?.pendingAction === 'status';
  const shouldShowBleRestart = Boolean(
    flow.bleDiscoverySession && flow.bleDiscoverySnapshot?.running === false
  );
  const pollBleDiscoveryRef = useRef<() => void>(() => undefined);
  const toastIdRef = useRef(0);
  const shownBleStopErrorRef = useRef<string | null>(null);
  const shownControlFeedbackRef = useRef<Record<string, string>>({});
  const autoRefreshShellyIdsRef = useRef<Set<string>>(new Set());
  const [returnToAddAfterScan, setReturnToAddAfterScan] = useState(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = `shelly-toast-${toastIdRef.current}`;
    const toast: ToastMessage =
      detail === undefined ? { id, tone, title } : { id, tone, title, detail };
    setToasts((current) => [...current.slice(-2), toast]);
  }, []);

  const dismissShellyScanProgressToast = useCallback(() => {
    const scanningTitle = t('hardware.shelly.scanningIpRange');
    setToasts((current) => current.filter((toast) => toast.title !== scanningTitle));
  }, [t]);

  const dismissShellyScanToasts = useCallback(() => {
    const scanTitles = new Set([
      t('hardware.shelly.scanningIpRange'),
      t('hardware.shelly.scanStopped')
    ]);
    setToasts((current) => current.filter((toast) => !scanTitles.has(toast.title)));
  }, [t]);

  useEffect(() => {
    const savedIds = new Set(shellyDevices.map((device) => device.id));
    autoRefreshShellyIdsRef.current.forEach((deviceId) => {
      if (!savedIds.has(deviceId)) {
        autoRefreshShellyIdsRef.current.delete(deviceId);
      }
    });

    shellyDevices.forEach((device) => {
      const controlState = shellyControlStates[device.id];
      if (
        controlState?.status ||
        controlState?.pendingAction ||
        autoRefreshShellyIdsRef.current.has(device.id)
      ) {
        return;
      }

      autoRefreshShellyIdsRef.current.add(device.id);
      refreshShellyControl(device);
    });
  }, [refreshShellyControl, shellyControlStates, shellyDevices]);

  useEffect(() => {
    Object.entries(shellyControlStates).forEach(([deviceId, controlState]) => {
      const message = controlState.error ?? controlState.message;
      if (!message || controlState.updatedAtMs === null) {
        return;
      }

      const feedbackKey = `${controlState.updatedAtMs}:${message}`;
      if (shownControlFeedbackRef.current[deviceId] === feedbackKey) {
        return;
      }

      shownControlFeedbackRef.current[deviceId] = feedbackKey;
      pushToast(controlState.error ? 'warning' : 'ok', message);
      acknowledgeShellyControlFeedback(deviceId, controlState.updatedAtMs, message);
    });
  }, [acknowledgeShellyControlFeedback, pushToast, shellyControlStates]);

  useEffect(() => {
    if (!flow.stopBleDiscoveryMutation.isError) {
      return;
    }

    const message = mutationError(flow.stopBleDiscoveryMutation.error);
    if (shownBleStopErrorRef.current === message) {
      return;
    }

    shownBleStopErrorRef.current = message;
    pushToast('warning', t('hardware.shelly.bleScannerCloseFailedTitle'), message);
    flow.stopBleDiscoveryMutation.reset();
  }, [flow.stopBleDiscoveryMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.shellyScanMutation.isError) {
      return;
    }
    dismissShellyScanProgressToast();
    pushToast(
      'warning',
      t('hardware.shelly.scanNetworkFailedTitle'),
      mutationError(flow.shellyScanMutation.error)
    );
    flow.shellyScanMutation.reset();
  }, [dismissShellyScanProgressToast, flow.shellyScanMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.shellyScanMutation.isSuccess) {
      return;
    }
    dismissShellyScanProgressToast();
  }, [dismissShellyScanProgressToast, flow.shellyScanMutation.isSuccess]);

  useEffect(() => {
    if (!flow.startBleDiscoveryMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.shelly.bleScannerStartFailedTitle'),
      mutationError(flow.startBleDiscoveryMutation.error)
    );
    flow.startBleDiscoveryMutation.reset();
  }, [flow.startBleDiscoveryMutation, pushToast, t]);

  pollBleDiscoveryRef.current = () => {
    if (
      !flow.bleDiscoverySession ||
      flow.bleDiscoverySnapshot?.running === false ||
      flow.startBleDiscoveryMutation.isPending ||
      flow.refreshBleDiscoveryMutation.isPending ||
      flow.restartBleDiscoveryMutation.isPending ||
      flow.refreshBleDiscoveryMutation.isError ||
      flow.restartBleDiscoveryMutation.isError ||
      flow.stopBleDiscoveryMutation.isPending
    ) {
      return;
    }
    flow.refreshBleDiscovery();
  };

  useEffect(() => {
    if (!isBleScanModalOpen || !flow.bleDiscoverySession) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      pollBleDiscoveryRef.current();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [flow.bleDiscoverySession, isBleScanModalOpen]);

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
        setIsAddShellyModalOpen(false);
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

  const closeStatusModal = () => {
    if (isCheckingShelly) {
      return;
    }
    flow.checkShellyMutation.reset();
    flow.recheckShellyMutation.reset();
    setIsStatusModalOpen(false);
    if (statusModalReturnSettingsId) {
      const canReturnToSettings = shellyDevices.some(
        (device) => device.id === statusModalReturnSettingsId
      );
      if (canReturnToSettings) {
        setSettingsShellyId(statusModalReturnSettingsId);
      }
      setStatusModalReturnSettingsId(null);
    }
  };

  const openAddShellyModal = () => {
    flow.checkShellyMutation.reset();
    setDidSubmitShellyAdd(false);
    setIsAddShellyModalOpen(true);
  };

  const closeAddShellyModal = () => {
    flow.checkShellyMutation.reset();
    setDidSubmitShellyAdd(false);
    setIsAddShellyModalOpen(false);
  };

  const openScanModalFromAdd = () => {
    flow.resetShellyScan();
    setDidSubmitShellyScan(false);
    setReturnToAddAfterScan(true);
    setIsAddShellyModalOpen(false);
    setIsScanModalOpen(true);
  };

  const closeScanModal = (options: { returnToAdd?: boolean } = {}) => {
    const shouldReturnToAdd = options.returnToAdd ?? returnToAddAfterScan;
    flow.resetShellyScan();
    dismissShellyScanToasts();
    setDidSubmitShellyScan(false);
    setIsScanModalOpen(false);
    if (shouldReturnToAdd) {
      setIsAddShellyModalOpen(true);
      setReturnToAddAfterScan(false);
      return;
    }
    setReturnToAddAfterScan(false);
  };

  const startShellyScan = () => {
    setDidSubmitShellyScan(true);
    if (shellyScanRangeError) {
      return;
    }
    dismissShellyScanToasts();
    pushToast('ok', t('hardware.shelly.scanningIpRange'));
    flow.startShellyScan();
  };

  const stopShellyScan = () => {
    if (flow.stopShellyScan()) {
      dismissShellyScanProgressToast();
      pushToast('ok', t('hardware.shelly.scanStopped'));
    }
  };

  const addScannedShellyDevice = (result: ShellySetupScanResult) => {
    const name = flow.shellyNameInput.trim() || result.deviceInfo.model;
    flow.upsertShellyDevice({
      id: result.baseUrl,
      name,
      baseUrl: result.baseUrl,
      scriptIdInput: '1'
    });
    flow.checkShellyMutation.reset();
    closeScanModal({ returnToAdd: false });
    pushToast('ok', t('hardware.shelly.added'));
  };

  const openBleScanModal = (device: ShellyDraftDevice) => {
    flow.resetBleDiscovery();
    shownBleStopErrorRef.current = null;
    setBleScanShelly(device);
    setIsBleScanModalOpen(true);
    pushToast(
      'ok',
      t('hardware.shelly.scanningBle'),
      t('hardware.shelly.scanningBleSafeOff')
    );
    flow.startBleDiscovery(device);
  };

  const closeBleScanModal = () => {
    if (isBleDiscoveryBusy) {
      return;
    }
    flow.stopBleDiscovery();
    setIsBleScanModalOpen(false);
  };

  const restartBleDiscovery = () => {
    pushToast('ok', t('hardware.shelly.scanningBle'));
    flow.restartBleDiscovery();
  };

  const handleDiscoveredSensor = (candidate: BleDiscoveryCandidate) => {
    flow.addDiscoveredSensor(candidate, 'shelly-scan');
    pushToast('ok', t('hardware.shelly.thermometerSaved'));
  };

  const recheckSavedShelly = (
    device: ShellyDraftDevice,
    options: { returnToSettings?: boolean } = {}
  ) => {
    setStatusModalAddress(device.baseUrl);
    setStatusModalSource('recheck');
    setStatusModalReturnSettingsId(options.returnToSettings ? device.id : null);
    setIsStatusModalOpen(true);
    flow.checkShellyMutation.reset();
    flow.recheckShellyMutation.mutate(device, {
      onSuccess: () => setIsStatusModalOpen(true)
    });
  };

  const removeSavedShelly = (device: ShellyDraftDevice) => {
    setShellyDevicePendingRemoval(device);
  };

  const openSettingsModal = (device: ShellyDraftDevice) => {
    setSettingsShellyId(device.id);
  };

  const closeSettingsModal = () => {
    setSettingsShellyId(null);
  };

  const openClockModal = (device: ShellyDraftDevice) => {
    setClockShellyId(device.id);
  };

  const closeClockModal = () => {
    setClockShellyId(null);
  };

  const confirmRemoveSavedShelly = () => {
    if (!shellyDevicePendingRemoval) {
      return;
    }

    flow.removeShellyDevice(shellyDevicePendingRemoval.id);
    setShellyDevicePendingRemoval(null);
    pushToast('ok', t('hardware.shelly.removed'));
  };

  return (
    <section className="demo-panel" aria-label={t('hardware.shelly.regionLabel')}>
      <div className="action-row add-device-action-row">
        <button
          className="secondary-action"
          type="button"
          aria-label={t('hardware.shelly.add')}
          title={t('hardware.shelly.addTitle')}
          onClick={openAddShellyModal}
        >
          {t('hardware.shelly.add')}
        </button>
      </div>

      <Modal
        busy={flow.checkShellyMutation.isPending}
        closeLabel={t('common.close')}
        open={isAddShellyModalOpen}
        title={t('hardware.shelly.add')}
        headerActions={
          <button
            className="secondary-action modal-header-action--compact"
            type="button"
            disabled={isAnyShellyCheckPending}
            title={t('hardware.shelly.networkScanTitle')}
            onClick={openScanModalFromAdd}
          >
            {t('hardware.shelly.scanNetwork')}
          </button>
        }
        actions={
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
        }
        onClose={closeAddShellyModal}
      >
        <ShellyAddForm flow={flow} showValidationErrors={didSubmitShellyAdd} />
      </Modal>

      <Modal
        busy={isShellyScanActive}
        closeLabel={t('common.close')}
        headerActions={
          <InfoTooltip
            label={t('hardware.shelly.infoScanLabel')}
            title={t('hardware.shelly.infoScanTitle')}
          >
            {t('hardware.shelly.apPanelHelp', { url: SHELLY_AP_PANEL_URL })}
            <br />
            {t('hardware.shelly.scannerBehavior')}
            <br />
            {shellyScanEstimate}
          </InfoTooltip>
        }
        open={isScanModalOpen}
        title={t('hardware.shelly.scanShellyTitle')}
        actions={
          <>
            <button
              className="secondary-action"
              type="button"
              aria-busy={isShellyScanActive || undefined}
              disabled={isShellyScanActive}
              title={t('hardware.shelly.scanStartTitle')}
              onClick={startShellyScan}
            >
              {isShellyScanActive
                ? t('hardware.shelly.scanning')
                : t('hardware.shelly.scanStart')}
            </button>
            {isShellyScanActive && (
              <button
                className="secondary-action"
                type="button"
                title={t('hardware.shelly.scanStopTitle')}
                onClick={stopShellyScan}
              >
                {t('hardware.shelly.scanStop')}
              </button>
            )}
          </>
        }
        onClose={closeScanModal}
      >
        <div className="field-row">
          <label className={showShellyScanRangeError ? 'field field--invalid' : 'field'}>
            {t('hardware.shelly.scanRangeStart')}
            <input
              aria-describedby={showShellyScanRangeError ? scanRangeErrorId : undefined}
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
          <label className={showShellyScanRangeError ? 'field field--invalid' : 'field'}>
            {t('hardware.shelly.scanRangeEnd')}
            <input
              aria-describedby={showShellyScanRangeError ? scanRangeErrorId : undefined}
              aria-invalid={showShellyScanRangeError}
              type="text"
              inputMode="numeric"
              placeholder="192.168.0.99"
              value={flow.shellyScanEndInput}
              onChange={(event) => flow.setShellyScanEndInput(event.currentTarget.value)}
            />
            {showShellyScanRangeError && (
              <span className="field__error" id={scanRangeErrorId}>
                {shellyScanRangeError}
              </span>
            )}
          </label>
        </div>

        {shouldShowEmptyScanResult && <p>{t('hardware.shelly.scanResultEmpty')}</p>}
        {scanResults.length > 0 && (
          <div className="saved-list" aria-label={t('hardware.shelly.foundListLabel')}>
            {scanResults.map((result) => (
              <article key={result.baseUrl} className="saved-list__item">
                <div className="saved-list__row shelly-scan-result__row">
                  <div className="saved-list__field">
                    <span>{t('common.address')}</span>
                    <strong>{result.baseUrl}</strong>
                  </div>
                  <div className="saved-list__field">
                    <span>{t('common.model')}</span>
                    <strong>
                      {result.deviceInfo.model}, gen {result.deviceInfo.gen}
                    </strong>
                  </div>
                  <button
                    aria-label={t('hardware.shelly.addAria', {
                      address: result.baseUrl
                    })}
                    className="secondary-action shelly-scan-result__add"
                    title={t('hardware.shelly.addCheckedTitle')}
                    type="button"
                    onClick={() => addScannedShellyDevice(result)}
                  >
                    {t('common.add')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Modal>

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
        onClose={() => setShellyDevicePendingRemoval(null)}
      >
        <p>{t('hardware.shelly.deleteDescription')}</p>
      </Modal>

      <Modal
        closeLabel={t('common.close')}
        description={settingsShelly?.name ?? ''}
        open={settingsShelly !== null}
        size="diagnostic"
        title={t('hardware.shelly.settingsTitle')}
        onClose={closeSettingsModal}
      >
        {settingsShelly && (
          <div className="settings-modal-layout">
            <label className="field">
              {t('hardware.shelly.deviceNameLabel')}
              <input
                id={settingsNameInputId}
                type="text"
                value={settingsShelly.name}
                onChange={(event) =>
                  flow.setShellyDeviceName(settingsShelly.id, event.currentTarget.value)
                }
              />
            </label>
            <div className="status-stack">
              <DiagnosticRow
                href={settingsShelly.baseUrl}
                label={t('hardware.shelly.addressSettings')}
                linkLabel={t('hardware.shelly.openPanelLabel', {
                  address: settingsShelly.baseUrl
                })}
                value={settingsShelly.baseUrl}
              />
              <DiagnosticRow
                label={t('common.firmware')}
                value={settingsStatus?.firmwareId ?? t('common.missingData')}
              />
              <DiagnosticRow
                label={t('hardware.metrics.relay')}
                value={
                  settingsStatus
                    ? settingsStatus.relayOn
                      ? 'ON'
                      : 'OFF'
                    : t('common.missingData')
                }
                tone={settingsStatus?.relayOn ? 'warning' : 'normal'}
              />
              <DiagnosticRow
                label={t('hardware.metrics.mode')}
                value={formatAutomationMode(settingsStatus?.automationMode, t)}
                tone={settingsStatus?.automationMode === 'missing' ? 'warning' : 'normal'}
              />
              <DiagnosticRow
                label={t('hardware.metrics.power')}
                value={formatPlugPower(settingsStatus?.telemetry.powerW, t)}
              />
              <DiagnosticRow
                label={t('hardware.metrics.voltage')}
                value={formatPlugVoltage(settingsStatus?.telemetry.voltageV, t)}
              />
              <DiagnosticRow
                label={t('hardware.metrics.energy')}
                value={formatPlugEnergy(settingsStatus?.telemetry.energyWh, t)}
              />
              <DiagnosticRow
                label={t('hardware.metrics.wifiRssi')}
                value={
                  settingsStatus?.telemetry.wifiRssiDbm === undefined
                    ? t('common.missing')
                    : `${settingsStatus.telemetry.wifiRssiDbm} dBm`
                }
              />
              <DiagnosticRow
                label={t('hardware.metrics.clockShelly')}
                value={formatShellyClock(settingsStatus?.clock, t)}
              />
              <DiagnosticRow
                label={t('hardware.shelly.uptime')}
                value={formatClockUptime(settingsStatus?.clock.uptimeSec, t)}
              />
            </div>
            <div
              className="settings-action-stack"
              aria-label={t('hardware.shelly.actionsLabel')}
            >
              <button
                className="secondary-action"
                type="button"
                disabled={settingsShelly === null || isAnyShellyCheckPending}
                title={t('hardware.shelly.checkSavedTitle')}
                onClick={() => {
                  closeSettingsModal();
                  recheckSavedShelly(settingsShelly, { returnToSettings: true });
                }}
              >
                {t('hardware.shelly.check')}
              </button>
              <button
                className="secondary-action"
                type="button"
                disabled={
                  settingsShelly === null ||
                  isAnyShellyCheckPending ||
                  isBleDiscoveryBusy ||
                  isSettingsControlBusy
                }
                title={t('hardware.shelly.scanBleViaShellyTitle')}
                onClick={() => {
                  closeSettingsModal();
                  openBleScanModal(settingsShelly);
                }}
              >
                <IconBluetooth className="icon-action__svg" aria-hidden="true" />
                {t('hardware.shelly.scanBle')}
              </button>
              <button
                className="secondary-action secondary-action--danger"
                type="button"
                disabled={settingsShelly === null}
                title={t('hardware.shelly.deleteTitle')}
                onClick={() => {
                  closeSettingsModal();
                  removeSavedShelly(settingsShelly);
                }}
              >
                <IconTrash className="icon-action__svg" aria-hidden="true" />
                {t('common.delete')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        closeLabel={t('common.close')}
        description={clockShelly?.name ?? ''}
        open={clockShelly !== null}
        size="diagnostic"
        title={t('hardware.shelly.clockTitle')}
        actions={
          <button
            className="secondary-action"
            type="button"
            aria-busy={isClockRefreshPending || undefined}
            disabled={clockShelly === null || isClockRefreshPending}
            title={t('hardware.shelly.clockRefreshTitle')}
            onClick={() => {
              if (clockShelly) {
                flow.refreshShellyControl(clockShelly);
              }
            }}
          >
            {isClockRefreshPending ? t('common.refreshing') : t('common.refresh')}
          </button>
        }
        onClose={closeClockModal}
      >
        <div className="status-stack">
          <DiagnosticRow
            label={t('hardware.metrics.clock')}
            value={formatShellyClock(clockStatus, t)}
          />
          <DiagnosticRow
            label={t('hardware.shelly.clockSync')}
            value={formatClockSyncState(clockStatus, t)}
            tone={clockStatus?.timeSynced ? 'normal' : 'warning'}
          />
          <DiagnosticRow
            label={t('hardware.shelly.uptime')}
            value={formatClockUptime(clockStatus?.uptimeSec, t)}
          />
          <DiagnosticRow
            label="NTP"
            value={formatClockTimestamp(clockStatus?.lastSyncUnixTimeSec, locale, t)}
          />
        </div>
      </Modal>

      <Modal
        busy={isCheckingShelly}
        closeLabel={t('common.close')}
        open={isStatusModalOpen}
        title={modalTitle}
        onClose={closeStatusModal}
      >
        {isCheckingShelly && <p>{t('hardware.shelly.localRpcConnecting')}</p>}
        {shellyCheckError && (
          <FeedbackPanel tone="warning" title={mutationError(shellyCheckError)}>
            {t('hardware.shelly.checkFailedDetail')}
          </FeedbackPanel>
        )}
        {!isCheckingShelly && !shellyCheckError && flow.setupStatus && (
          <>
            <div
              className="status-stack"
              aria-label={t('hardware.shelly.statusCheckResultLabel')}
            >
              {statusModalShellyHref ? (
                <DiagnosticRow
                  href={statusModalShellyHref}
                  label={t('hardware.shelly.addressInputLabel')}
                  linkLabel={t('hardware.shelly.openPanelLabel', {
                    address: statusModalShellyAddress
                  })}
                  value={statusModalShellyAddress}
                />
              ) : (
                <DiagnosticRow
                  label={t('hardware.shelly.addressInputLabel')}
                  value={statusModalShellyAddress}
                />
              )}
              <DiagnosticRow
                label={t('hardware.metrics.relay')}
                value={flow.setupStatus.status.relayOn ? 'ON' : 'OFF'}
                tone={flow.setupStatus.status.relayOn ? 'warning' : 'normal'}
              />
            </div>
            <ShellyCard
              name="Shelly Plug S Gen3"
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
          </>
        )}
      </Modal>

      <Modal
        busy={isBleDiscoveryBusy}
        closeLabel={t('common.close')}
        description={bleScanShelly ? bleScanShelly.name : ''}
        open={isBleScanModalOpen}
        size="diagnostic"
        title={t('hardware.shelly.scanBleTitle')}
        headerActions={
          <InfoTooltip
            label={t('hardware.shelly.scanBleInfoLabel')}
            title={t('hardware.shelly.scanBleInfoTitle')}
          >
            {t('hardware.shelly.scanBleInfo')}
          </InfoTooltip>
        }
        actions={
          shouldShowBleRestart ? (
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
          ) : null
        }
        onClose={closeBleScanModal}
      >
        {didBleDiscoveryStartFail && (
          <FeedbackPanel tone="warning" title={t('hardware.shelly.scanBleStartFailed')}>
            {t('hardware.shelly.scanBleStartFailedDetail')}
          </FeedbackPanel>
        )}
        {bleDiscoveryCandidates.length > 0 && (
          <div
            className="ble-candidate-list"
            aria-label={t('hardware.sensor.foundBleListLabel')}
          >
            {bleDiscoveryCandidates.map((candidate) => {
              const hasTemperature = typeof candidate.temperatureC === 'number';
              const hasHumidity = typeof candidate.humidityPct === 'number';
              const isSavedSensor = flow.sensorDevices.some(
                (device) =>
                  device.runtimeAddress.toUpperCase() ===
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
                    onClick={() => handleDiscoveredSensor(candidate)}
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
      </Modal>

      <div className="saved-list" aria-label={t('hardware.shelly.savedListLabel')}>
        {flow.shellyDevices.length === 0 && <p>{t('hardware.shelly.empty')}</p>}
        {flow.shellyDevices.map((device) => (
          <SavedShellyDeviceCard
            key={device.id}
            controlState={flow.shellyControlStates[device.id]}
            device={device}
            onAutomationAuto={flow.setAutomationAuto}
            onAutomationManual={flow.setAutomationManual}
            onClockOpen={openClockModal}
            onRefreshControl={flow.refreshShellyControl}
            onRelayOff={flow.turnRelayOff}
            onRelayOn={flow.turnRelayOn}
            onSettingsOpen={openSettingsModal}
          />
        ))}
      </div>
      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </section>
  );
};

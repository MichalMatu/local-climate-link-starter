import type { ShellySetupFlow } from '../pageContracts.js';
import {
  DiagnosticRow,
  FeedbackPanel,
  InfoTooltip,
  Modal,
  ShellyCard,
  ToastViewport
} from '@lcl/ui';
import { IconPlus } from '@tabler/icons-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { ShellySetupScanResult } from '../../../flows/hardware-setup/shellyRequests.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import {
  formatBleCandidateProfile,
  formatClockSyncState,
  formatClockTimestamp,
  formatClockUptime,
  formatComponentState,
  formatAutomationMode,
  formatNullableMetric,
  formatShellyScanEstimate,
  SavedShellyDeviceCard,
  ShellyAddForm,
  shellyCompatibilityBadge
} from './ShellySetupPresentation.js';
import { countIpv4RangeScanAddresses } from '../../../flows/hardware-setup/validation.js';
import { mutationError, type HardwarePageProps } from '../helpers.js';
import { useToastQueue } from '../useToastQueue.js';

type ShellyDialogState =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'ble'; device: ShellyDraftDevice }
  | { kind: 'info'; deviceId: string }
  | { kind: 'remove'; device: ShellyDraftDevice };
const SHELLY_AP_PANEL_URL = 'http://192.168.33.1/';

type ShellySetupPageProps = HardwarePageProps<ShellySetupFlow> & {
  enableBleDiscovery?: boolean;
};

export const ShellySetupPage = ({
  flow,
  enableBleDiscovery = true
}: ShellySetupPageProps) => {
  const { locale, t } = useTranslation();
  const isShellyScanActive = flow.shellyScanMutation.isPending && !flow.shellyScanStopped;
  const isAnyShellyCheckPending =
    flow.checkShellyMutation.isPending ||
    flow.recheckShellyMutation.isPending ||
    isShellyScanActive;
  const [dialog, setDialog] = useState<ShellyDialogState>({ kind: 'none' });
  const [didSubmitShellyAdd, setDidSubmitShellyAdd] = useState(false);
  const [didSubmitShellyScan, setDidSubmitShellyScan] = useState(false);
  const { dismissToast, pushToast, toasts } = useToastQueue('shelly-toast');
  const isAddShellyModalOpen = dialog.kind === 'add';
  const isBleScanModalOpen = dialog.kind === 'ble';
  const bleScanShelly = dialog.kind === 'ble' ? dialog.device : null;
  const infoShellyId = dialog.kind === 'info' ? dialog.deviceId : null;
  const shellyDevicePendingRemoval = dialog.kind === 'remove' ? dialog.device : null;
  const scanRangeErrorId = useId();
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
  const infoShelly =
    infoShellyId === null
      ? null
      : (shellyDevices.find((device) => device.id === infoShellyId) ?? null);
  const infoControlState = infoShelly ? shellyControlStates[infoShelly.id] : undefined;
  const infoStatus = infoControlState?.status;
  const shouldShowBleRestart = Boolean(
    flow.bleDiscoverySession && flow.bleDiscoverySnapshot?.running === false
  );
  const pollBleDiscoveryRef = useRef<() => void>(() => undefined);
  const shownBleStopErrorRef = useRef<string | null>(null);
  const shownControlFeedbackRef = useRef<Record<string, string>>({});
  const autoRefreshShellyIdsRef = useRef<Set<string>>(new Set());

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
    pushToast(
      'warning',
      t('hardware.shelly.scanNetworkFailedTitle'),
      mutationError(flow.shellyScanMutation.error)
    );
    flow.shellyScanMutation.reset();
  }, [flow.shellyScanMutation, pushToast, t]);
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

  const openAddShellyModal = () => {
    flow.checkShellyMutation.reset();
    setDidSubmitShellyAdd(false);
    setDialog({ kind: 'add' });
  };

  const closeAddShellyModal = () => {
    flow.checkShellyMutation.reset();
    flow.resetShellyScan();
    setDidSubmitShellyAdd(false);
    setDidSubmitShellyScan(false);
    setDialog({ kind: 'none' });
  };

  const startShellyScan = () => {
    setDidSubmitShellyScan(true);
    if (shellyScanRangeError) {
      return;
    }
    flow.startShellyScan();
  };

  const stopShellyScan = () => {
    flow.stopShellyScan();
  };

  const selectScannedShellyDevice = (result: ShellySetupScanResult) => {
    if (!flow.shellyNameInput.trim()) {
      flow.setShellyNameInput(result.deviceInfo.model);
    }
    flow.setShellyUrlInput(result.baseUrl);
    flow.resetShellyScan();
    setDidSubmitShellyScan(false);
  };

  const openBleScanModal = (device: ShellyDraftDevice) => {
    flow.resetBleDiscovery();
    shownBleStopErrorRef.current = null;
    setDialog({ kind: 'ble', device });
    flow.startBleDiscovery(device);
  };

  const closeBleScanModal = () => {
    if (isBleDiscoveryBusy) {
      return;
    }
    flow.stopBleDiscovery();
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
  };

  return (
    <section className="demo-panel" aria-label={t('hardware.shelly.regionLabel')}>
      <button
        className="primary-action setup-add-fab"
        type="button"
        aria-label={t('hardware.shelly.add')}
        title={t('hardware.shelly.addTitle')}
        onClick={openAddShellyModal}
      >
        <IconPlus className="setup-add-fab__icon" aria-hidden="true" />
      </button>

      <Modal
        busy={flow.checkShellyMutation.isPending}
        closeLabel={t('common.close')}
        open={isAddShellyModalOpen}
        size="task"
        title={t('hardware.shelly.add')}
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
        <details className="shelly-network-scan">
          <summary>{t('hardware.shelly.scanNetwork')}</summary>
          <div className="shelly-network-scan__body">
            <div className="shelly-network-scan__hint">
              <span>{shellyScanEstimate}</span>
              <InfoTooltip
                label={t('hardware.shelly.infoScanLabel')}
                title={t('hardware.shelly.infoScanTitle')}
              >
                {t('hardware.shelly.apPanelHelp', { url: SHELLY_AP_PANEL_URL })}
                <br />
                {t('hardware.shelly.scannerBehavior')}
              </InfoTooltip>
            </div>
            <div className="field-row">
              <label
                className={showShellyScanRangeError ? 'field field--invalid' : 'field'}
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
                className={showShellyScanRangeError ? 'field field--invalid' : 'field'}
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
            <div className="action-row shelly-network-scan__actions">
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
            </div>
            {isShellyScanActive && (
              <div className="scan-loading-state scan-loading-state--compact">
                <span className="scan-loading-state__spinner" aria-hidden="true" />
                <strong>{t('hardware.shelly.scanningIpRange')}</strong>
                <p>{shellyScanEstimate}</p>
              </div>
            )}
            {shouldShowEmptyScanResult && <p>{t('hardware.shelly.scanResultEmpty')}</p>}
            {scanResults.length > 0 && (
              <div
                className="saved-list"
                aria-label={t('hardware.shelly.foundListLabel')}
              >
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
                        aria-label={`${t('common.select')}: ${result.baseUrl}`}
                        className="secondary-action shelly-scan-result__add"
                        type="button"
                        onClick={() => selectScannedShellyDevice(result)}
                      >
                        {t('common.select')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </details>
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
        onClose={() => setDialog({ kind: 'none' })}
      >
        <p>{t('hardware.shelly.deleteDescription')}</p>
      </Modal>

      <Modal
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
                label={t('hardware.metrics.relay')}
                value={
                  infoStatus
                    ? infoStatus.relayOn
                      ? 'ON'
                      : 'OFF'
                    : t('common.missingData')
                }
              />
              <DiagnosticRow
                label={t('hardware.metrics.mode')}
                value={formatAutomationMode(infoStatus?.automationMode, t)}
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

      <Modal
        busy={isBleDiscoveryBusy}
        closeLabel={t('common.close')}
        description={bleScanShelly ? bleScanShelly.name : ''}
        open={isBleScanModalOpen}
        size="task"
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
        {!didBleDiscoveryStartFail &&
          bleDiscoveryCandidates.length === 0 &&
          !shouldShowBleRestart && (
            <div className="scan-loading-state">
              <span className="scan-loading-state__spinner" aria-hidden="true" />
              <strong>{t('hardware.shelly.scanningBle')}</strong>
              <p>{t('hardware.shelly.scanningBleSafeOff')}</p>
            </div>
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
            {...(enableBleDiscovery ? { onBleScan: openBleScanModal } : {})}
            onInfoOpen={openInfoModal}
            onNameChange={(savedDevice, value) =>
              flow.setShellyDeviceName(savedDevice.id, value)
            }
            onRelayOff={flow.turnRelayOff}
            onRelayOn={flow.turnRelayOn}
            onRemove={removeSavedShelly}
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

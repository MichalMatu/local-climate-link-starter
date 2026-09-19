import type { SensorSetupFlow } from '../pageContracts.js';
import { useToastQueue } from '../useToastQueue.js';
import { Modal, ToastViewport } from '@lcl/ui';
import { IconPlus, IconTemperature } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
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
type SensorDialogState = { kind: 'none' } | { kind: 'remove'; device: SensorDraftDevice };
type SensorAddMode = 'manual' | 'phone-scan';

type SensorSetupPageProps = HardwarePageProps<SensorSetupFlow> & {
  primaryAddAction?: SensorAddMode;
  embedded?: boolean;
  addOnly?: boolean;
  onAddRequest?: (mode: SensorAddMode) => void;
};

export const SensorSetupPage = ({
  flow,
  primaryAddAction = 'manual',
  embedded = false,
  addOnly = false,
  onAddRequest
}: SensorSetupPageProps) => {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<SensorDialogState>({ kind: 'none' });
  const [editingSensorId, setEditingSensorId] = useState<string | null>(null);
  const [didSubmitSensorAdd, setDidSubmitSensorAdd] = useState(false);
  const [addMode, setAddMode] = useState<SensorAddMode>(primaryAddAction);
  const [scanCandidateNames, setScanCandidateNames] = useState<Record<string, string>>(
    {}
  );
  const autoScanStartedRef = useRef(false);
  const startPhoneBleScanRef = useRef<() => void>(() => undefined);
  const stopPhoneBleScanRef = useRef<() => void>(() => undefined);
  const { dismissToast, pushToast, toasts } = useToastQueue('sensor-toast');
  const sensorPendingRemoval = dialog.kind === 'remove' ? dialog.device : null;
  const isPhoneBleScanPending = flow.phoneBleScanMutation.isPending;
  const isSensorGattPending = flow.setPvvxTimeMutation.isPending;
  const shouldShowPhoneBleEmpty =
    flow.phoneBleScanMutation.isSuccess && flow.phoneBleScanCandidates.length === 0;
  const sensorDeviceCount = flow.sensorDevices.length;
  const shouldRunSavedSensorLiveScan =
    sensorDeviceCount > 0 && !addOnly && !isSensorGattPending;

  const { resetPhoneBleError } = useSensorSetupFeedback({
    flow,
    shouldRunSavedSensorLiveScan,
    pushToast,
    t
  });

  const startPhoneBleScan = () => {
    resetPhoneBleError();
    flow.startPhoneBleScan();
  };
  startPhoneBleScanRef.current = startPhoneBleScan;
  stopPhoneBleScanRef.current = flow.stopPhoneBleScan;

  useEffect(() => {
    if (!addOnly || primaryAddAction !== 'phone-scan' || autoScanStartedRef.current)
      return;
    autoScanStartedRef.current = true;
    startPhoneBleScanRef.current();
  }, [addOnly, primaryAddAction]);

  useEffect(
    () => () => {
      if (addOnly) stopPhoneBleScanRef.current();
    },
    [addOnly]
  );

  const selectAddMode = (mode: SensorAddMode) => {
    if (mode === addMode) return;
    if (addMode === 'phone-scan') {
      flow.stopPhoneBleScan();
      flow.resetPhoneBleScan();
    }
    setDidSubmitSensorAdd(false);
    setAddMode(mode);
    if (mode === 'phone-scan') startPhoneBleScan();
  };

  const addSensor = () => {
    setDidSubmitSensorAdd(true);
    if (!flow.sensorInputState.ok) return;
    flow.addSensorDraft();
    setDidSubmitSensorAdd(false);
    flow.setSensorNameInput('');
    flow.setSensorMacInput('');
    pushToast('ok', t('hardware.shelly.thermometerSaved'));
  };

  const defaultScannedSensorName = (candidate: BleDiscoveryCandidate) =>
    t('hardware.flow.sensorDefaultName', {
      suffix: candidate.runtimeAddress.split(':').slice(-2).join(':')
    });

  const scannedSensorName = (candidate: BleDiscoveryCandidate) =>
    scanCandidateNames[candidate.runtimeAddress] ?? defaultScannedSensorName(candidate);

  const setScannedSensorName = (candidate: BleDiscoveryCandidate, value: string) => {
    setScanCandidateNames((current) => ({
      ...current,
      [candidate.runtimeAddress]: value
    }));
  };

  const saveScannedSensor = (candidate: BleDiscoveryCandidate) => {
    const name = scannedSensorName(candidate).trim();
    if (!name) return;
    flow.addDiscoveredSensor(candidate, 'phone-scan', name);
    pushToast('ok', t('hardware.shelly.thermometerSaved'));
  };

  const confirmRemoveSensor = () => {
    if (!sensorPendingRemoval) return;
    flow.removeSensorDevice(sensorPendingRemoval.id);
    setDialog({ kind: 'none' });
    pushToast('ok', t('hardware.sensor.removed'));
  };

  const readingsForSensor = (device: SensorDraftDevice) =>
    flow.sensorSamplesById[device.id.toUpperCase()] ?? [];

  const scanContent = (
    <section
      className="sensor-add-scan"
      role="tabpanel"
      aria-label={t('hardware.sensor.scanBle')}
    >
      {shouldShowPhoneBleEmpty && <p>{t('hardware.sensor.noBleFound')}</p>}
      {flow.phoneBleScanCandidates.length > 0 && (
        <div
          className="ble-candidate-list"
          aria-label={t('hardware.sensor.blePhoneFoundLabel')}
        >
          {flow.phoneBleScanCandidates.map((candidate) => {
            const hasTemperature = typeof candidate.temperatureC === 'number';
            const hasHumidity = typeof candidate.humidityPct === 'number';
            const savedSensor = flow.sensorDevices.find(
              (device) =>
                device.runtimeAddress.toUpperCase() ===
                candidate.runtimeAddress.toUpperCase()
            );
            const isSavedSensor = savedSensor !== undefined;
            const displayName = savedSensor?.name ?? scannedSensorName(candidate);

            return (
              <article key={candidate.runtimeAddress} className="ble-candidate-item">
                <div className="ble-candidate-content">
                  <label className="ble-candidate-name">
                    <span>{t('hardware.sensor.nameLabel')}</span>
                    <input
                      aria-label={`${t('hardware.sensor.nameLabel')}: ${candidate.runtimeAddress}`}
                      type="text"
                      value={displayName}
                      disabled={isSavedSensor}
                      onChange={(event) =>
                        setScannedSensorName(candidate, event.currentTarget.value)
                      }
                    />
                  </label>
                  <div className="ble-candidate-main">
                    <strong>{candidate.runtimeAddress}</strong>
                    <span>{sensorProfileDisplayLabels[candidate.profileId]}</span>
                  </div>
                  <dl className="ble-candidate-metrics">
                    <div>
                      <dt>RSSI</dt>
                      <dd>
                        {formatSensorMetric(
                          candidate.rssi,
                          ' dBm',
                          0,
                          t('common.missing')
                        )}
                      </dd>
                    </div>
                    {hasTemperature && (
                      <div>
                        <dt>{t('hardware.metrics.temperatureShort')}</dt>
                        <dd>
                          {formatSensorMetric(
                            candidate.temperatureC,
                            '°C',
                            1,
                            t('common.missing')
                          )}
                        </dd>
                      </div>
                    )}
                    {hasHumidity && (
                      <div>
                        <dt>{t('hardware.metrics.humidityShort')}</dt>
                        <dd>
                          {formatSensorMetric(
                            candidate.humidityPct,
                            '%',
                            1,
                            t('common.missing')
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
                <button
                  className="primary-action ble-candidate-action"
                  type="button"
                  disabled={isSavedSensor || displayName.trim().length === 0}
                  title={
                    isSavedSensor
                      ? t('hardware.sensor.saveThermometerSavedTitle')
                      : t('hardware.sensor.saveThermometerTitle')
                  }
                  onClick={() => saveScannedSensor(candidate)}
                >
                  {isSavedSensor ? t('hardware.sensor.saved') : t('common.add')}
                </button>
              </article>
            );
          })}
        </div>
      )}
      <div className="action-row device-add-page__actions device-add-page__scan-control">
        <button
          className="secondary-action"
          type="button"
          title={
            isPhoneBleScanPending
              ? t('hardware.sensor.scanStopTitle')
              : t('hardware.sensor.scanAgainTitle')
          }
          onClick={isPhoneBleScanPending ? flow.stopPhoneBleScan : startPhoneBleScan}
        >
          {isPhoneBleScanPending
            ? t('hardware.shelly.scanStop')
            : t('hardware.shelly.scanBleAgain')}
        </button>
      </div>
    </section>
  );

  if (addOnly) {
    return (
      <section
        className="device-add-page sensor-add-page"
        aria-label={t('hardware.sensor.add')}
      >
        <div
          className="shelly-add-tabs"
          role="tablist"
          aria-label={t('hardware.sensor.add')}
        >
          <button
            className="shelly-add-tabs__tab"
            type="button"
            role="tab"
            aria-selected={addMode === 'phone-scan'}
            title={t('hardware.sensor.scanPhoneTitle')}
            onClick={() => selectAddMode('phone-scan')}
          >
            {t('hardware.sensor.scanBle')}
          </button>
          <button
            className="shelly-add-tabs__tab"
            type="button"
            role="tab"
            aria-selected={addMode === 'manual'}
            onClick={() => selectAddMode('manual')}
          >
            {t('hardware.shelly.addManual')}
          </button>
        </div>
        {addMode === 'phone-scan' ? (
          scanContent
        ) : (
          <section
            className="sensor-manual-add"
            role="tabpanel"
            aria-label={t('hardware.shelly.addManual')}
          >
            <SensorAddForm flow={flow} showValidationErrors={didSubmitSensorAdd} />
            <div className="action-row device-add-page__actions">
              <button className="primary-action" type="button" onClick={addSensor}>
                {t('common.add')}
              </button>
            </div>
          </section>
        )}
        <ToastViewport
          dismissLabel={t('toast.dismiss')}
          label={t('toast.regionLabel')}
          toasts={toasts}
          onDismiss={dismissToast}
        />
      </section>
    );
  }

  return (
    <section
      className={
        embedded
          ? 'sensor-setup-panel sensor-setup-panel--embedded'
          : 'demo-panel sensor-setup-panel'
      }
      aria-label={t('hardware.nav.sensorTitle')}
    >
      <button
        className={
          primaryAddAction === 'phone-scan'
            ? 'primary-action dashboard-fab'
            : 'primary-action setup-add-fab'
        }
        type="button"
        aria-label={
          primaryAddAction === 'phone-scan'
            ? t('hardware.sensor.scanPhoneTitle')
            : t('hardware.sensor.add')
        }
        title={
          primaryAddAction === 'phone-scan'
            ? t('hardware.sensor.scanPhoneTitle')
            : t('hardware.sensor.addTitle')
        }
        onClick={() => onAddRequest?.(primaryAddAction)}
      >
        <IconPlus
          className={
            primaryAddAction === 'phone-scan'
              ? 'dashboard-fab__icon'
              : 'setup-add-fab__icon'
          }
          aria-hidden="true"
        />
      </button>

      <Modal
        closeLabel={t('common.cancel')}
        description={sensorPendingRemoval?.name ?? ''}
        open={sensorPendingRemoval !== null}
        title={t('hardware.sensor.deleteConfirmTitle')}
        actions={
          <button
            className="secondary-action secondary-action--danger"
            type="button"
            title={t('hardware.sensor.deleteTitle')}
            onClick={confirmRemoveSensor}
          >
            {t('common.delete')}
          </button>
        }
        onClose={() => setDialog({ kind: 'none' })}
      >
        <p>{t('hardware.sensor.deleteDescription')}</p>
      </Modal>
      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />

      <div className="saved-list" aria-label={t('hardware.sensor.savedListLabel')}>
        {flow.sensorDevices.length === 0 &&
          (embedded ? (
            <div className="dashboard-kind-empty">
              <IconTemperature
                className="dashboard-kind-empty__icon"
                aria-hidden="true"
              />
              <strong>{t('hardware.sensor.empty')}</strong>
            </div>
          ) : (
            <p>{t('hardware.sensor.empty')}</p>
          ))}
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
    </section>
  );
};

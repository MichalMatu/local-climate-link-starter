import type { SensorSetupFlow } from '../pageContracts.js';
import { useToastQueue } from '../useToastQueue.js';
import { Modal, ToastViewport } from '@lcl/ui';
import { IconPlus, IconTemperature } from '@tabler/icons-react';
import { useState } from 'react';
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

type SensorDialogState =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'ble' }
  | { kind: 'remove'; device: SensorDraftDevice };

type SensorSetupPageProps = HardwarePageProps<SensorSetupFlow> & {
  primaryAddAction?: 'manual' | 'phone-scan';
  embedded?: boolean;
};

export const SensorSetupPage = ({
  flow,
  primaryAddAction = 'manual',
  embedded = false
}: SensorSetupPageProps) => {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<SensorDialogState>({ kind: 'none' });
  const [editingSensorId, setEditingSensorId] = useState<string | null>(null);
  const [didSubmitSensorAdd, setDidSubmitSensorAdd] = useState(false);
  const { dismissToast, pushToast, toasts } = useToastQueue('sensor-toast');
  const isAddSensorModalOpen = dialog.kind === 'add';
  const isPhoneBleScanModalOpen = dialog.kind === 'ble';
  const sensorPendingRemoval = dialog.kind === 'remove' ? dialog.device : null;
  const isPhoneBleScanPending = flow.phoneBleScanMutation.isPending;
  const isSensorGattPending = flow.setPvvxTimeMutation.isPending;
  const shouldShowPhoneBleEmpty =
    flow.phoneBleScanMutation.isSuccess && flow.phoneBleScanCandidates.length === 0;
  const sensorDeviceCount = flow.sensorDevices.length;
  const shouldRunSavedSensorLiveScan =
    sensorDeviceCount > 0 &&
    !isAddSensorModalOpen &&
    !isPhoneBleScanModalOpen &&
    !isSensorGattPending;

  const { resetPhoneBleError } = useSensorSetupFeedback({
    flow,
    shouldRunSavedSensorLiveScan,
    pushToast,
    t
  });

  const closeAddSensorModal = () => {
    flow.resetPhoneBleScan();
    setDidSubmitSensorAdd(false);
    setDialog({ kind: 'none' });
  };

  const closePhoneBleScanModal = () => {
    flow.resetPhoneBleScan();
    setDialog({ kind: 'none' });
  };

  const addSensor = () => {
    setDidSubmitSensorAdd(true);
    if (!flow.sensorInputState.ok) {
      return;
    }

    flow.addSensorDraft();
    closeAddSensorModal();
  };

  const openAddSensorModal = () => {
    flow.resetPhoneBleScan();
    resetPhoneBleError();
    setDidSubmitSensorAdd(false);
    setDialog({ kind: 'add' });
  };

  const startPhoneBleScan = () => {
    resetPhoneBleError();
    flow.startPhoneBleScan();
  };

  const openPhoneBleScanModal = () => {
    setDidSubmitSensorAdd(false);
    setDialog({ kind: 'ble' });
    startPhoneBleScan();
  };

  const saveScannedSensor = (candidate: BleDiscoveryCandidate) => {
    flow.addDiscoveredSensor(candidate);
    closePhoneBleScanModal();
  };

  const confirmRemoveSensor = () => {
    if (!sensorPendingRemoval) {
      return;
    }

    flow.removeSensorDevice(sensorPendingRemoval.id);
    setDialog({ kind: 'none' });
    pushToast('ok', t('hardware.sensor.removed'));
  };

  const readingsForSensor = (device: SensorDraftDevice) =>
    flow.sensorSamplesById[device.id.toUpperCase()] ?? [];

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
        onClick={
          primaryAddAction === 'phone-scan' ? openPhoneBleScanModal : openAddSensorModal
        }
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
        closeLabel={t('common.close')}
        open={isAddSensorModalOpen}
        size="task"
        title={t('hardware.sensor.add')}
        headerActions={
          <button
            className="secondary-action modal-header-action--compact"
            type="button"
            disabled={isPhoneBleScanPending}
            title={t('hardware.sensor.scanPhoneTitle')}
            onClick={openPhoneBleScanModal}
          >
            {t('hardware.sensor.scanBle')}
          </button>
        }
        actions={
          <button
            className="primary-action"
            type="button"
            title={t('hardware.sensor.addFromMacTitle')}
            onClick={addSensor}
          >
            {t('common.add')}
          </button>
        }
        onClose={closeAddSensorModal}
      >
        <SensorAddForm flow={flow} showValidationErrors={didSubmitSensorAdd} />
      </Modal>

      <Modal
        busy={isPhoneBleScanPending}
        closeLabel={t('common.close')}
        open={isPhoneBleScanModalOpen}
        size="task"
        title={t('hardware.sensor.phoneBleTitle')}
        actions={
          isPhoneBleScanPending ? (
            <button
              className="secondary-action"
              type="button"
              title={t('hardware.sensor.scanStopTitle')}
              onClick={flow.stopPhoneBleScan}
            >
              {t('hardware.shelly.scanStop')}
            </button>
          ) : (
            <button
              className="secondary-action"
              type="button"
              title={t('hardware.sensor.scanAgainTitle')}
              onClick={startPhoneBleScan}
            >
              {t('hardware.shelly.scanBleAgain')}
            </button>
          )
        }
        onClose={closePhoneBleScanModal}
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
              const isSavedSensor = flow.sensorDevices.some(
                (device) =>
                  device.runtimeAddress.toUpperCase() ===
                  candidate.runtimeAddress.toUpperCase()
              );

              return (
                <article key={candidate.runtimeAddress} className="ble-candidate-item">
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
                  <button
                    className="secondary-action ble-candidate-action"
                    type="button"
                    disabled={isSavedSensor}
                    title={
                      isSavedSensor
                        ? t('hardware.sensor.saveThermometerSavedTitle')
                        : t('hardware.sensor.saveThermometerTitle')
                    }
                    onClick={() => saveScannedSensor(candidate)}
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

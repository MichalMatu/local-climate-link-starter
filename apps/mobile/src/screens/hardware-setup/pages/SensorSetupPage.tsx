import { Modal, ToastViewport, type ToastMessage, type ToastTone } from '@lcl/ui';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import { mutationError } from '../helpers.js';
import type { HardwarePageProps } from '../helpers.js';

const sensorProfileLabels = {
  xiaomi_lywsd03mmc_bthome_v2: 'Xiaomi/PVVX BTHome v2',
  tp357_custom_v1: 'TP357'
} as const;

const sensorProfileDisplayLabels = {
  xiaomi_lywsd03mmc_bthome_v2: 'BTHome v2',
  tp357_custom_v1: 'TP357'
} as const;

type SensorDraftDevice = HardwarePageProps['flow']['sensorDevices'][number];

const TrashIcon = () => (
  <svg
    aria-hidden="true"
    className="icon-action__svg"
    focusable="false"
    viewBox="0 0 24 24"
  >
    <path d="M7 7h10" />
    <path d="M10 7V5.5h4V7" />
    <path d="m9 9.5.5 8.5A1.5 1.5 0 0 0 11 19.5h2A1.5 1.5 0 0 0 14.5 18l.5-8.5" />
    <path d="M11 11.5v5" />
    <path d="M13 11.5v5" />
  </svg>
);

const formatNullableMetric = (
  value: number | null | undefined,
  suffix = '',
  fractionDigits = 1,
  missingLabel: string
): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(fractionDigits)}${suffix}`
    : missingLabel;

type SensorAddFormProps = {
  flow: HardwarePageProps['flow'];
  showValidationErrors: boolean;
};

const SensorAddForm = ({ flow, showValidationErrors }: SensorAddFormProps) => {
  const { t } = useTranslation();
  const nameInputId = useId();
  const nameErrorId = useId();
  const macInputId = useId();
  const macErrorId = useId();
  const nameError =
    showValidationErrors && !flow.sensorInputState.ok
      ? flow.sensorInputState.fieldErrors.name
      : undefined;
  const macError =
    showValidationErrors && !flow.sensorInputState.ok
      ? flow.sensorInputState.fieldErrors.mac
      : undefined;

  return (
    <>
      <label className="field">
        {t('hardware.sensor.profileLabel')}
        <span className="select-control">
          <select
            value={flow.sensorProfileInput}
            onChange={(event) =>
              flow.setSensorProfileInput(
                event.currentTarget.value as typeof flow.sensorProfileInput
              )
            }
          >
            <option value="xiaomi_lywsd03mmc_bthome_v2">
              {sensorProfileLabels.xiaomi_lywsd03mmc_bthome_v2}
            </option>
            <option value="tp357_custom_v1">{sensorProfileLabels.tp357_custom_v1}</option>
          </select>
        </span>
      </label>

      <div className={nameError ? 'field field--invalid' : 'field'}>
        <label htmlFor={nameInputId}>{t('hardware.sensor.nameLabel')}</label>
        <input
          id={nameInputId}
          aria-describedby={nameError ? nameErrorId : undefined}
          aria-invalid={nameError ? true : undefined}
          type="text"
          placeholder={t('hardware.sensor.namePlaceholder')}
          value={flow.sensorNameInput}
          onChange={(event) => flow.setSensorNameInput(event.currentTarget.value)}
        />
        {nameError && (
          <span className="field__error" id={nameErrorId}>
            {nameError}
          </span>
        )}
      </div>
      <div className={macError ? 'field field--invalid' : 'field'}>
        <label htmlFor={macInputId}>{t('hardware.sensor.macLabel')}</label>
        <input
          id={macInputId}
          aria-describedby={macError ? macErrorId : undefined}
          aria-invalid={macError ? true : undefined}
          type="text"
          inputMode="text"
          placeholder="AA:BB:CC:DD:EE:FF"
          value={flow.sensorMacInput}
          onChange={(event) => flow.setSensorMacInput(event.currentTarget.value)}
        />
        {macError && (
          <span className="field__error" id={macErrorId}>
            {macError}
          </span>
        )}
      </div>
    </>
  );
};

export const SensorSetupPage = ({ flow }: HardwarePageProps) => {
  const { t } = useTranslation();
  const [isAddSensorModalOpen, setIsAddSensorModalOpen] = useState(false);
  const [isPhoneBleScanModalOpen, setIsPhoneBleScanModalOpen] = useState(false);
  const [sensorPendingRemoval, setSensorPendingRemoval] =
    useState<SensorDraftDevice | null>(null);
  const [didSubmitSensorAdd, setDidSubmitSensorAdd] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const shownPhoneBleErrorRef = useRef<string | null>(null);
  const isPhoneBleScanPending = flow.phoneBleScanMutation.isPending;
  const shouldShowPhoneBleEmpty =
    flow.phoneBleScanMutation.isSuccess && flow.phoneBleScanCandidates.length === 0;

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = `sensor-toast-${toastIdRef.current}`;
    const toast: ToastMessage =
      detail === undefined ? { id, tone, title } : { id, tone, title, detail };
    setToasts((current) => [...current.slice(-2), toast]);
  }, []);

  useEffect(() => {
    if (!flow.phoneBleScanMutation.isError) {
      return;
    }

    const message = mutationError(flow.phoneBleScanMutation.error);
    if (shownPhoneBleErrorRef.current === message) {
      return;
    }

    shownPhoneBleErrorRef.current = message;
    pushToast('warning', t('hardware.sensor.phoneBleFailedTitle'), message);
    flow.phoneBleScanMutation.reset();
  }, [flow.phoneBleScanMutation, pushToast, t]);

  const closeAddSensorModal = () => {
    flow.resetPhoneBleScan();
    setDidSubmitSensorAdd(false);
    setIsAddSensorModalOpen(false);
  };

  const closePhoneBleScanModal = () => {
    flow.resetPhoneBleScan();
    setIsPhoneBleScanModalOpen(false);
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
    shownPhoneBleErrorRef.current = null;
    setDidSubmitSensorAdd(false);
    setIsAddSensorModalOpen(true);
  };

  const startPhoneBleScan = () => {
    shownPhoneBleErrorRef.current = null;
    flow.startPhoneBleScan();
  };

  const openPhoneBleScanModal = () => {
    setDidSubmitSensorAdd(false);
    setIsAddSensorModalOpen(false);
    setIsPhoneBleScanModalOpen(true);
    startPhoneBleScan();
  };

  const saveScannedSensor = (candidate: BleDiscoveryCandidate) => {
    flow.addDiscoveredSensor(candidate);
    closePhoneBleScanModal();
  };

  const removeSensor = (device: SensorDraftDevice) => {
    setSensorPendingRemoval(device);
  };

  const confirmRemoveSensor = () => {
    if (!sensorPendingRemoval) {
      return;
    }

    flow.removeSensorDevice(sensorPendingRemoval.id);
    setSensorPendingRemoval(null);
    pushToast('ok', t('hardware.sensor.removed'));
  };

  return (
    <section className="demo-panel" aria-label={t('hardware.nav.sensorTitle')}>
      <div className="action-row add-device-action-row">
        <button
          className="secondary-action"
          type="button"
          aria-label={t('hardware.sensor.add')}
          title={t('hardware.sensor.addTitle')}
          onClick={openAddSensorModal}
        >
          <span aria-hidden="true">+ </span>
          {t('hardware.sensor.add')}
        </button>
      </div>

      <Modal
        closeLabel={t('common.close')}
        open={isAddSensorModalOpen}
        title={t('hardware.sensor.add')}
        actions={
          <>
            <button
              className="secondary-action"
              type="button"
              disabled={isPhoneBleScanPending}
              title={t('hardware.sensor.scanPhoneTitle')}
              onClick={openPhoneBleScanModal}
            >
              {t('hardware.sensor.scanBle')}
            </button>
            <button
              className="secondary-action"
              type="button"
              title={t('hardware.sensor.addFromMacTitle')}
              onClick={addSensor}
            >
              {t('common.add')}
            </button>
          </>
        }
        onClose={closeAddSensorModal}
      >
        <SensorAddForm flow={flow} showValidationErrors={didSubmitSensorAdd} />
      </Modal>

      <Modal
        closeLabel={t('common.close')}
        closeOnBackdrop={false}
        closeOnEscape={!isPhoneBleScanPending}
        open={isPhoneBleScanModalOpen}
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
                        {formatNullableMetric(
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
                          {formatNullableMetric(
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
                          {formatNullableMetric(
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
        onClose={() => setSensorPendingRemoval(null)}
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
        {flow.sensorDevices.length === 0 && <p>{t('hardware.sensor.empty')}</p>}
        {flow.sensorDevices.map((device) => (
          <article key={device.id} className="saved-list__item">
            <div className="saved-list__row">
              <label className="field">
                {t('hardware.shelly.nameLabel')}
                <input
                  type="text"
                  value={device.name}
                  onChange={(event) =>
                    flow.setSensorDeviceName(device.id, event.currentTarget.value)
                  }
                />
              </label>
              <div className="saved-list__field">
                <span>MAC</span>
                <strong>{device.runtimeAddress}</strong>
              </div>
              <div className="saved-list__field">
                <span>{t('hardware.sensor.typeLabel')}</span>
                <div className="saved-list__field-action-row">
                  <strong>{sensorProfileDisplayLabels[device.profileId]}</strong>
                  <button
                    className="icon-action icon-action--danger"
                    type="button"
                    aria-label={t('hardware.sensor.removeAria', { name: device.name })}
                    title={t('hardware.sensor.deleteTitle')}
                    onClick={() => removeSensor(device)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

import type { SensorSetupFlow } from '../pageContracts.js';
import { useToastQueue } from '../useToastQueue.js';
import { Modal, ToastViewport } from '@lcl/ui';
import { IconClock, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useId, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { HardwarePageProps } from '../helpers.js';
import { useSensorSetupFeedback } from './useSensorSetupFeedback.js';

const sensorProfileLabels = {
  xiaomi_lywsd03mmc_bthome_v2: 'Xiaomi/PVVX BTHome v2',
  tp357_custom_v1: 'TP357'
} as const;

const sensorProfileDisplayLabels = {
  xiaomi_lywsd03mmc_bthome_v2: 'BTHome v2',
  tp357_custom_v1: 'TP357'
} as const;

type SensorDraftDevice = SensorSetupFlow['sensorDevices'][number];

const formatNullableMetric = (
  value: number | null | undefined,
  suffix = '',
  fractionDigits = 1,
  missingLabel: string
): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(fractionDigits)}${suffix}`
    : missingLabel;

const formatBattery = (
  sample: SensorReadingSample | null,
  missingLabel: string
): string => {
  if (typeof sample?.batteryPct === 'number') {
    return formatNullableMetric(sample.batteryPct, '%', 0, missingLabel);
  }
  if (typeof sample?.voltageV === 'number') {
    return formatNullableMetric(sample.voltageV, ' V', 2, missingLabel);
  }
  return missingLabel;
};

const formatSeenAt = (
  sample: SensorReadingSample | null,
  locale: string,
  missingLabel: string
): string =>
  sample
    ? new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(sample.seenAtMs))
    : missingLabel;

const latestSample = (samples: SensorReadingSample[]): SensorReadingSample | null =>
  samples.at(-1) ?? null;

type NumericSampleMetric = 'temperatureC' | 'humidityPct' | 'rssi';

const latestNumericSample = (
  samples: SensorReadingSample[],
  metric: NumericSampleMetric
): SensorReadingSample | null => {
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index];
    if (sample && typeof sample[metric] === 'number') {
      return sample;
    }
  }

  return null;
};

const latestBatterySample = (
  samples: SensorReadingSample[]
): SensorReadingSample | null => {
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index];
    if (
      sample &&
      (typeof sample.batteryPct === 'number' || typeof sample.voltageV === 'number')
    ) {
      return sample;
    }
  }

  return null;
};

type SensorAddFormProps = {
  flow: SensorSetupFlow;
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

type SensorDialogState =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'ble' }
  | { kind: 'remove'; device: SensorDraftDevice };

export const SensorSetupPage = ({ flow }: HardwarePageProps<SensorSetupFlow>) => {
  const { locale, t } = useTranslation();
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

  const readingsForSensor = (device: SensorDraftDevice): SensorReadingSample[] =>
    flow.sensorSamplesById[device.runtimeAddress.toUpperCase()] ?? [];

  return (
    <section
      className="demo-panel sensor-setup-panel"
      aria-label={t('hardware.nav.sensorTitle')}
    >
      <button
        className="primary-action setup-add-fab"
        type="button"
        aria-label={t('hardware.sensor.add')}
        title={t('hardware.sensor.addTitle')}
        onClick={openAddSensorModal}
      >
        <IconPlus className="setup-add-fab__icon" aria-hidden="true" />
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
        {flow.sensorDevices.length === 0 && <p>{t('hardware.sensor.empty')}</p>}
        {flow.sensorDevices.map((device) => {
          const samples = readingsForSensor(device);
          const temperatureSample = latestNumericSample(samples, 'temperatureC');
          const humiditySample = latestNumericSample(samples, 'humidityPct');
          const hasTemperatureData =
            typeof temperatureSample?.temperatureC === 'number' &&
            Number.isFinite(temperatureSample.temperatureC);
          const hasHumidityData =
            typeof humiditySample?.humidityPct === 'number' &&
            Number.isFinite(humiditySample.humidityPct);

          const latest = latestSample(samples);
          const batterySample = latestBatterySample(samples);
          const rssiSample = latestNumericSample(samples, 'rssi');
          const isEditing = editingSensorId === device.id;

          return (
            <article key={device.id} className="saved-list__item sensor-saved-card">
              <div className="sensor-card-header">
                {isEditing ? (
                  <input
                    autoFocus
                    className="sensor-card-name-input"
                    aria-label={t('hardware.sensor.nameLabel')}
                    type="text"
                    value={device.name}
                    onBlur={() => setEditingSensorId(null)}
                    onChange={(event) =>
                      flow.setSensorDeviceName(device.id, event.currentTarget.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === 'Escape') {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <div className="sensor-card-title-row">
                    <h3 className="sensor-card-title">{device.name}</h3>
                    <button
                      className="icon-action rule-summary-icon-action"
                      type="button"
                      aria-label={t('hardware.sensor.nameLabel')}
                      title={t('hardware.sensor.nameLabel')}
                      onClick={() => setEditingSensorId(device.id)}
                    >
                      <IconPencil className="icon-action__svg" aria-hidden="true" />
                    </button>
                  </div>
                )}
                <div className="sensor-card-actions">
                  {device.profileId === 'xiaomi_lywsd03mmc_bthome_v2' && (
                    <button
                      className="icon-action"
                      type="button"
                      disabled={flow.setPvvxTimeMutation.isPending}
                      aria-label={t('hardware.sensor.pvvxSetTimeTitle')}
                      title={t('hardware.sensor.pvvxSetTimeTitle')}
                      onClick={() => flow.setPvvxTimeMutation.mutate(device)}
                    >
                      <IconClock className="icon-action__svg" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    className="icon-action icon-action--danger"
                    type="button"
                    aria-label={t('hardware.sensor.deleteTitle')}
                    title={t('hardware.sensor.deleteTitle')}
                    onClick={() => setDialog({ kind: 'remove', device })}
                  >
                    <IconTrash className="icon-action__svg" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="sensor-metric-grid">
                <div
                  className={
                    hasTemperatureData
                      ? 'sensor-data-metric-card'
                      : 'sensor-data-metric-card sensor-data-metric-card--empty'
                  }
                >
                  <span className="sensor-data-metric-card__label">
                    {t('hardware.metrics.temperature')}
                  </span>
                  <strong
                    className={
                      hasTemperatureData
                        ? 'sensor-data-metric-card__value'
                        : 'sensor-data-metric-card__value sensor-data-metric-card__value--empty'
                    }
                  >
                    {formatNullableMetric(
                      temperatureSample?.temperatureC,
                      '°C',
                      1,
                      '— °C'
                    )}
                  </strong>
                </div>
                <div
                  className={
                    hasHumidityData
                      ? 'sensor-data-metric-card'
                      : 'sensor-data-metric-card sensor-data-metric-card--empty'
                  }
                >
                  <span className="sensor-data-metric-card__label">
                    {t('hardware.metrics.humidity')}
                  </span>
                  <strong
                    className={
                      hasHumidityData
                        ? 'sensor-data-metric-card__value'
                        : 'sensor-data-metric-card__value sensor-data-metric-card__value--empty'
                    }
                  >
                    {formatNullableMetric(humiditySample?.humidityPct, '%', 1, '— %')}
                  </strong>
                </div>
              </div>
              <dl className="sensor-card-details">
                <div>
                  <dt>{t('hardware.sensor.typeLabel')}</dt>
                  <dd>{sensorProfileDisplayLabels[device.profileId]}</dd>
                </div>
                <div>
                  <dt>{t('hardware.metrics.battery')}</dt>
                  <dd>{formatBattery(batterySample, t('common.missingData'))}</dd>
                </div>
                <div>
                  <dt>{t('common.rssi')}</dt>
                  <dd>
                    {formatNullableMetric(
                      rssiSample?.rssi,
                      ' dBm',
                      0,
                      t('common.missingData')
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t('hardware.metrics.lastMeasurement')}</dt>
                  <dd>{formatSeenAt(latest, locale, t('common.missingData'))}</dd>
                </div>
                <div className="sensor-card-details__wide">
                  <dt>MAC</dt>
                  <dd>{device.runtimeAddress}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
};

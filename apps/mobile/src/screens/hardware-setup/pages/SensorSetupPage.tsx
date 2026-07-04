import {
  DiagnosticRow,
  Modal,
  Sparkline,
  ToastViewport,
  type ToastMessage,
  type ToastTone
} from '@lcl/ui';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import { SettingsGearIcon } from '../../../components/icons/SettingsGearIcon.js';
import type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';
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

const temperatureChartDomain = { minimumRange: 5 } as const;
const humidityChartDomain = {
  minimumRange: 20,
  lowerBound: 0,
  upperBound: 100
} as const;

type SensorDraftDevice = HardwarePageProps['flow']['sensorDevices'][number];

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

const sampleValues = (
  samples: SensorReadingSample[],
  metric: 'temperatureC' | 'humidityPct'
): Array<number | undefined> => samples.map((sample) => sample[metric]);

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
  const { locale, t } = useTranslation();
  const [isAddSensorModalOpen, setIsAddSensorModalOpen] = useState(false);
  const [isPhoneBleScanModalOpen, setIsPhoneBleScanModalOpen] = useState(false);
  const [sensorSettingsId, setSensorSettingsId] = useState<string | null>(null);
  const [sensorPendingRemoval, setSensorPendingRemoval] =
    useState<SensorDraftDevice | null>(null);
  const [didSubmitSensorAdd, setDidSubmitSensorAdd] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const shownPhoneBleErrorRef = useRef<string | null>(null);
  const preloadedPvvxHistoryIdsRef = useRef<Set<string>>(new Set());
  const scheduledPvvxHistoryIdsRef = useRef<Set<string>>(new Set());
  const isPhoneBleScanPending = flow.phoneBleScanMutation.isPending;
  const isSensorGattPending =
    flow.fetchPvvxHistoryMutation.isPending || flow.setPvvxTimeMutation.isPending;
  const shouldShowPhoneBleEmpty =
    flow.phoneBleScanMutation.isSuccess && flow.phoneBleScanCandidates.length === 0;
  const sensorSettingsDevice =
    flow.sensorDevices.find((device) => device.id === sensorSettingsId) ?? null;
  const sensorDeviceCount = flow.sensorDevices.length;
  const startSavedSensorLiveScan = flow.startSavedSensorLiveScan;
  const restartSavedSensorLiveScan = flow.restartSavedSensorLiveScan;
  const stopSavedSensorLiveScan = flow.stopSavedSensorLiveScan;
  const shouldRunSavedSensorLiveScan =
    sensorDeviceCount > 0 &&
    !isAddSensorModalOpen &&
    !isPhoneBleScanModalOpen &&
    !isSensorGattPending;

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

  useEffect(() => {
    if (!shouldRunSavedSensorLiveScan) {
      stopSavedSensorLiveScan();
      return;
    }

    startSavedSensorLiveScan();
    return () => stopSavedSensorLiveScan();
  }, [shouldRunSavedSensorLiveScan, startSavedSensorLiveScan, stopSavedSensorLiveScan]);

  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const clearResumeTimer = () => {
      if (resumeTimer !== null) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    };

    const scheduleResume = () => {
      if (!shouldRunSavedSensorLiveScan) {
        return;
      }

      clearResumeTimer();
      resumeTimer = setTimeout(() => {
        resumeTimer = null;
        void restartSavedSensorLiveScan();
      }, 250);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearResumeTimer();
        stopSavedSensorLiveScan();
        return;
      }

      scheduleResume();
    };

    const handleFocus = () => {
      if (document.visibilityState !== 'hidden') {
        scheduleResume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearResumeTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [restartSavedSensorLiveScan, shouldRunSavedSensorLiveScan, stopSavedSensorLiveScan]);

  useEffect(() => {
    if (
      isAddSensorModalOpen ||
      isPhoneBleScanModalOpen ||
      sensorSettingsDevice !== null ||
      flow.fetchPvvxHistoryMutation.status !== 'idle' ||
      flow.setPvvxTimeMutation.isPending
    ) {
      return;
    }

    const device = flow.sensorDevices.find(
      (sensorDevice) =>
        sensorDevice.profileId === 'xiaomi_lywsd03mmc_bthome_v2' &&
        !preloadedPvvxHistoryIdsRef.current.has(sensorDevice.id) &&
        !scheduledPvvxHistoryIdsRef.current.has(sensorDevice.id)
    );
    if (!device) {
      return;
    }

    const scheduledPvvxHistoryIds = scheduledPvvxHistoryIdsRef.current;
    scheduledPvvxHistoryIds.add(device.id);
    const preloadTimer = window.setTimeout(() => {
      scheduledPvvxHistoryIds.delete(device.id);
      preloadedPvvxHistoryIdsRef.current.add(device.id);
      flow.fetchPvvxHistoryMutation.mutate({ device, mode: 'preload' });
    }, 750);

    return () => {
      scheduledPvvxHistoryIds.delete(device.id);
      window.clearTimeout(preloadTimer);
    };
  }, [
    flow.fetchPvvxHistoryMutation,
    flow.sensorDevices,
    flow.setPvvxTimeMutation.isPending,
    isAddSensorModalOpen,
    isPhoneBleScanModalOpen,
    sensorSettingsDevice
  ]);

  useEffect(() => {
    if (!flow.fetchPvvxHistoryMutation.isSuccess) {
      return;
    }

    const sampleCount = flow.fetchPvvxHistoryMutation.data?.sampleCount ?? 0;
    if (flow.fetchPvvxHistoryMutation.data?.mode === 'manual') {
      pushToast(
        'ok',
        t('hardware.sensor.pvvxHistoryLoadedTitle'),
        t('hardware.sensor.pvvxHistoryLoadedDetail', { count: sampleCount })
      );
    }
    flow.fetchPvvxHistoryMutation.reset();
  }, [flow.fetchPvvxHistoryMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.fetchPvvxHistoryMutation.isError) {
      return;
    }

    if (flow.fetchPvvxHistoryMutation.variables?.mode === 'manual') {
      pushToast(
        'warning',
        t('hardware.sensor.pvvxFailedTitle'),
        mutationError(flow.fetchPvvxHistoryMutation.error)
      );
    }
    flow.fetchPvvxHistoryMutation.reset();
  }, [flow.fetchPvvxHistoryMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.setPvvxTimeMutation.isSuccess) {
      return;
    }

    pushToast(
      'ok',
      flow.setPvvxTimeMutation.data?.acknowledged
        ? t('hardware.sensor.pvvxTimeSetTitle')
        : t('hardware.sensor.pvvxTimeSentTitle')
    );
    flow.setPvvxTimeMutation.reset();
  }, [flow.setPvvxTimeMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.setPvvxTimeMutation.isError) {
      return;
    }

    pushToast(
      'warning',
      t('hardware.sensor.pvvxFailedTitle'),
      mutationError(flow.setPvvxTimeMutation.error)
    );
    flow.setPvvxTimeMutation.reset();
  }, [flow.setPvvxTimeMutation, pushToast, t]);

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
    setSensorSettingsId((current) =>
      current === sensorPendingRemoval.id ? null : current
    );
    setSensorPendingRemoval(null);
    pushToast('ok', t('hardware.sensor.removed'));
  };

  const readingsForSensor = (device: SensorDraftDevice): SensorReadingSample[] =>
    flow.sensorSamplesById[device.id.toUpperCase()] ?? [];

  const openSensorSettings = (device: SensorDraftDevice) => {
    setSensorSettingsId(device.id);
  };

  const openRemoveFromSettings = (device: SensorDraftDevice) => {
    setSensorSettingsId(null);
    removeSensor(device);
  };

  return (
    <section
      className="demo-panel sensor-setup-panel"
      aria-label={t('hardware.nav.sensorTitle')}
    >
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
        busy={isPhoneBleScanPending}
        closeLabel={t('common.close')}
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
        closeLabel={t('common.close')}
        open={sensorSettingsDevice !== null}
        title={t('hardware.sensor.settings')}
        actions={
          sensorSettingsDevice && (
            <button
              className="secondary-action secondary-action--danger"
              type="button"
              title={t('hardware.sensor.deleteTitle')}
              onClick={() => openRemoveFromSettings(sensorSettingsDevice)}
            >
              {t('common.delete')}
            </button>
          )
        }
        onClose={() => setSensorSettingsId(null)}
      >
        {sensorSettingsDevice && (
          <div className="settings-modal-layout">
            <label className="field">
              {t('hardware.sensor.nameLabel')}
              <input
                type="text"
                value={sensorSettingsDevice.name}
                onChange={(event) =>
                  flow.setSensorDeviceName(
                    sensorSettingsDevice.id,
                    event.currentTarget.value
                  )
                }
              />
            </label>
            <div className="status-stack">
              <DiagnosticRow label="MAC" value={sensorSettingsDevice.runtimeAddress} />
              <DiagnosticRow
                label={t('hardware.sensor.typeLabel')}
                value={sensorProfileDisplayLabels[sensorSettingsDevice.profileId]}
              />
              <DiagnosticRow
                label={t('hardware.metrics.lastMeasurement')}
                value={formatSeenAt(
                  latestSample(readingsForSensor(sensorSettingsDevice)),
                  locale,
                  t('common.missingData')
                )}
              />
              <DiagnosticRow
                label={t('hardware.metrics.battery')}
                value={formatBattery(
                  latestBatterySample(readingsForSensor(sensorSettingsDevice)),
                  t('common.missingData')
                )}
              />
              <DiagnosticRow
                label={t('common.rssi')}
                value={formatNullableMetric(
                  latestNumericSample(readingsForSensor(sensorSettingsDevice), 'rssi')
                    ?.rssi,
                  ' dBm',
                  0,
                  t('common.missingData')
                )}
              />
            </div>
            {sensorSettingsDevice.profileId === 'xiaomi_lywsd03mmc_bthome_v2' && (
              <div className="settings-action-stack">
                <button
                  className="secondary-action"
                  type="button"
                  disabled={flow.fetchPvvxHistoryMutation.isPending}
                  title={t('hardware.sensor.pvvxHistoryTitle')}
                  onClick={() =>
                    flow.fetchPvvxHistoryMutation.mutate({
                      device: sensorSettingsDevice,
                      mode: 'manual'
                    })
                  }
                >
                  {flow.fetchPvvxHistoryMutation.isPending
                    ? t('hardware.sensor.pvvxHistoryLoading')
                    : t('hardware.sensor.pvvxHistory')}
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={flow.setPvvxTimeMutation.isPending}
                  title={t('hardware.sensor.pvvxSetTimeTitle')}
                  onClick={() => flow.setPvvxTimeMutation.mutate(sensorSettingsDevice)}
                >
                  {flow.setPvvxTimeMutation.isPending
                    ? t('hardware.sensor.pvvxTimeSetting')
                    : t('hardware.sensor.pvvxSetTime')}
                </button>
              </div>
            )}
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
        {flow.sensorDevices.map((device) => {
          const samples = readingsForSensor(device);
          const temperatureSample = latestNumericSample(samples, 'temperatureC');
          const humiditySample = latestNumericSample(samples, 'humidityPct');

          return (
            <article key={device.id} className="saved-list__item sensor-saved-card">
              <div className="sensor-card-header">
                <h3 className="sensor-card-title">{device.name}</h3>
                <button
                  className="icon-action saved-list__settings-toggle"
                  type="button"
                  aria-label={t('hardware.sensor.settingsAria', {
                    name: device.name
                  })}
                  title={t('hardware.sensor.settingsTitle')}
                  onClick={() => openSensorSettings(device)}
                >
                  <SettingsGearIcon />
                </button>
              </div>
              <div className="sensor-chart-stack">
                <div className="sensor-data-chart-card">
                  <strong className="sensor-data-chart-card__value">
                    {formatNullableMetric(
                      temperatureSample?.temperatureC,
                      '°C',
                      1,
                      t('common.missingData')
                    )}
                  </strong>
                  <Sparkline
                    label={t('hardware.sensor.temperatureChartLabel', {
                      name: device.name
                    })}
                    domain={temperatureChartDomain}
                    points={sampleValues(samples, 'temperatureC')}
                  />
                </div>
                <div className="sensor-data-chart-card">
                  <strong className="sensor-data-chart-card__value">
                    {formatNullableMetric(
                      humiditySample?.humidityPct,
                      '%',
                      1,
                      t('common.missingData')
                    )}
                  </strong>
                  <Sparkline
                    label={t('hardware.sensor.humidityChartLabel', {
                      name: device.name
                    })}
                    domain={humidityChartDomain}
                    points={sampleValues(samples, 'humidityPct')}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

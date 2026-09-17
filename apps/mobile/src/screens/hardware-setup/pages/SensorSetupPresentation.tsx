import {
  IconBattery,
  IconClock,
  IconDeviceMobile,
  IconPencil,
  IconPlug,
  IconTemperature,
  IconTrash,
  IconWifi
} from '@tabler/icons-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';
import type { SensorSetupFlow } from '../pageContracts.js';

export const sensorProfileLabels = {
  xiaomi_lywsd03mmc_bthome_v2: 'Xiaomi/PVVX BTHome v2',
  tp357_custom_v1: 'TP357'
} as const;

export const sensorProfileDisplayLabels = {
  xiaomi_lywsd03mmc_bthome_v2: 'BTHome v2',
  tp357_custom_v1: 'TP357'
} as const;

export const formatSensorMetric = (
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
    return formatSensorMetric(sample.batteryPct, '%', 0, missingLabel);
  }
  if (typeof sample?.voltageV === 'number') {
    return formatSensorMetric(sample.voltageV, ' V', 2, missingLabel);
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

const latestSample = (
  samples: readonly SensorReadingSample[]
): SensorReadingSample | null => samples.at(-1) ?? null;

const SENSOR_SAMPLE_PULSE_MS = 650;

type NumericSampleMetric = 'temperatureC' | 'humidityPct' | 'rssi';

const latestNumericSample = (
  samples: readonly SensorReadingSample[],
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
  samples: readonly SensorReadingSample[]
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

export const SensorAddForm = ({ flow, showValidationErrors }: SensorAddFormProps) => {
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

type SavedSensorCardProps = {
  device: SensorSetupFlow['sensorDevices'][number];
  samples: readonly SensorReadingSample[];
  isEditing: boolean;
  pvvxTimePending: boolean;
  onEditStart(): void;
  onEditEnd(): void;
  onNameChange(value: string): void;
  onPvvxSetTime(): void;
  onRemove(): void;
};

export const SavedSensorCard = ({
  device,
  samples,
  isEditing,
  pvvxTimePending,
  onEditStart,
  onEditEnd,
  onNameChange,
  onPvvxSetTime,
  onRemove
}: SavedSensorCardProps) => {
  const { locale, t } = useTranslation();
  const temperatureSample = latestNumericSample(samples, 'temperatureC');
  const humiditySample = latestNumericSample(samples, 'humidityPct');
  const hasTemperatureData =
    typeof temperatureSample?.temperatureC === 'number' &&
    Number.isFinite(temperatureSample.temperatureC);
  const hasHumidityData =
    typeof humiditySample?.humidityPct === 'number' &&
    Number.isFinite(humiditySample.humidityPct);
  const latest = latestSample(samples);
  const latestSeenAtMs = latest?.seenAtMs ?? null;
  const previousSeenAtMsRef = useRef<number | null>(latestSeenAtMs);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSamplePulseActive, setIsSamplePulseActive] = useState(false);
  const batterySample = latestBatterySample(samples);
  const rssiSample = latestNumericSample(samples, 'rssi');

  useEffect(() => {
    if (latestSeenAtMs === null) return;

    const previousSeenAtMs = previousSeenAtMsRef.current;
    if (previousSeenAtMs !== null && latestSeenAtMs <= previousSeenAtMs) return;

    previousSeenAtMsRef.current = latestSeenAtMs;
    setIsSamplePulseActive(true);
    if (pulseTimeoutRef.current !== null) clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = setTimeout(() => {
      setIsSamplePulseActive(false);
      pulseTimeoutRef.current = null;
    }, SENSOR_SAMPLE_PULSE_MS);
  }, [latestSeenAtMs]);

  useEffect(
    () => () => {
      if (pulseTimeoutRef.current !== null) clearTimeout(pulseTimeoutRef.current);
    },
    []
  );

  return (
    <article className="saved-list__item sensor-saved-card">
      <div className="sensor-card-header">
        <span
          className={`sensor-card-leading-icon${
            isSamplePulseActive ? ' sensor-card-leading-icon--fresh' : ''
          }`}
          aria-hidden="true"
        >
          <IconTemperature className="sensor-card-leading-icon__icon" />
        </span>
        {isEditing ? (
          <input
            autoFocus
            className="sensor-card-name-input"
            aria-label={t('hardware.sensor.nameLabel')}
            type="text"
            value={device.name}
            onBlur={onEditEnd}
            onChange={(event) => onNameChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          <div className="sensor-card-title-row">
            <h3 className="sensor-card-title">{device.name}</h3>
            {latest?.source === 'phone-scan' && (
              <span
                className="sensor-card-source"
                title={t('hardware.sensor.scanPhoneTitle')}
              >
                <IconDeviceMobile className="icon-action__svg" aria-hidden="true" />
              </span>
            )}
            {latest?.source === 'shelly-scan' && (
              <span className="sensor-card-source" title={t('hardware.nav.shellyTitle')}>
                <IconPlug className="icon-action__svg" aria-hidden="true" />
              </span>
            )}
            <button
              className="icon-action rule-summary-icon-action"
              type="button"
              aria-label={t('hardware.sensor.nameLabel')}
              title={t('hardware.sensor.nameLabel')}
              onClick={onEditStart}
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
              disabled={pvvxTimePending}
              aria-label={t('hardware.sensor.pvvxSetTimeTitle')}
              title={t('hardware.sensor.pvvxSetTimeTitle')}
              onClick={onPvvxSetTime}
            >
              <IconClock className="icon-action__svg" aria-hidden="true" />
            </button>
          )}
          <button
            className="icon-action icon-action--danger"
            type="button"
            aria-label={t('hardware.sensor.deleteTitle')}
            title={t('hardware.sensor.deleteTitle')}
            onClick={onRemove}
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
            {formatSensorMetric(temperatureSample?.temperatureC, '°C', 1, '— °C')}
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
            {formatSensorMetric(humiditySample?.humidityPct, '%', 1, '— %')}
          </strong>
        </div>
      </div>

      <div className="sensor-status-strip">
        <span
          className="sensor-status-strip__item"
          aria-label={`${t('hardware.metrics.battery')}: ${formatBattery(
            batterySample,
            '—'
          )}`}
          title={t('hardware.metrics.battery')}
        >
          <IconBattery aria-hidden="true" />
          <strong>{formatBattery(batterySample, '—')}</strong>
        </span>
        <span
          className="sensor-status-strip__item"
          aria-label={`${t('common.rssi')}: ${formatSensorMetric(
            rssiSample?.rssi,
            ' dBm',
            0,
            '—'
          )}`}
          title={t('common.rssi')}
        >
          <IconWifi aria-hidden="true" />
          <strong>{formatSensorMetric(rssiSample?.rssi, ' dBm', 0, '—')}</strong>
        </span>
        <span
          className="sensor-status-strip__item"
          aria-label={`${t('hardware.metrics.lastMeasurement')}: ${formatSeenAt(
            latest,
            locale,
            '—'
          )}`}
          title={t('hardware.metrics.lastMeasurement')}
        >
          <IconClock aria-hidden="true" />
          <strong>{formatSeenAt(latest, locale, '—')}</strong>
        </span>
      </div>

      <details className="sensor-card-details-disclosure">
        <summary>{t('hardware.sensor.details')}</summary>
        <dl className="sensor-card-details">
          <div>
            <dt>{t('hardware.sensor.typeLabel')}</dt>
            <dd>{sensorProfileDisplayLabels[device.profileId]}</dd>
          </div>
          <div className="sensor-card-details__wide">
            <dt>MAC</dt>
            <dd>{device.runtimeAddress}</dd>
          </div>
        </dl>
      </details>
    </article>
  );
};

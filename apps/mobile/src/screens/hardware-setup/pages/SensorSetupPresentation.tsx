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
import { SelectField } from '@lcl/ui';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';
import {
  calculateSensorVpdKpa,
  type SensorRuntimeReading
} from '../../../flows/hardware-setup/useSensorRuntimeReadings.js';
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
  seenAtMs: number | null,
  locale: string,
  missingLabel: string
): string =>
  seenAtMs === null
    ? missingLabel
    : new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(seenAtMs));

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
      <div className="field">
        <span>{t('hardware.sensor.profileLabel')}</span>
        <SelectField
          ariaLabel={t('hardware.sensor.profileLabel')}
          value={flow.sensorProfileInput}
          options={[
            {
              value: 'xiaomi_lywsd03mmc_bthome_v2',
              label: sensorProfileLabels.xiaomi_lywsd03mmc_bthome_v2
            },
            { value: 'tp357_custom_v1', label: sensorProfileLabels.tp357_custom_v1 }
          ]}
          onChange={(value) =>
            flow.setSensorProfileInput(value as typeof flow.sensorProfileInput)
          }
        />
      </div>

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
  runtimeReading: SensorRuntimeReading | null;
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
  runtimeReading,
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
  const latest = latestSample(samples);
  const batterySample = latestBatterySample(samples);
  const rssiSample = latestNumericSample(samples, 'rssi');
  const liveTemperatureC = runtimeReading
    ? runtimeReading.temperatureC
    : temperatureSample?.temperatureC;
  const liveHumidityPct = runtimeReading
    ? runtimeReading.humidityPct
    : humiditySample?.humidityPct;
  const liveVpdKpa = runtimeReading
    ? runtimeReading.vpdKpa
    : calculateSensorVpdKpa(liveTemperatureC, liveHumidityPct);
  const liveBattery = runtimeReading
    ? formatSensorMetric(runtimeReading.batteryPct, '%', 0, '—')
    : formatBattery(batterySample, '—');
  const liveRssi = formatSensorMetric(
    runtimeReading ? runtimeReading.rssi : rssiSample?.rssi,
    ' dBm',
    0,
    '—'
  );
  const liveSeenAtMs = runtimeReading
    ? runtimeReading.seenAtMs
    : (latest?.seenAtMs ?? null);
  const previousSeenAtMsRef = useRef<number | null>(liveSeenAtMs);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSamplePulseActive, setIsSamplePulseActive] = useState(false);
  const [samplePulseSequence, setSamplePulseSequence] = useState(0);

  useEffect(() => {
    if (liveSeenAtMs === null) return;

    const previousSeenAtMs = previousSeenAtMsRef.current;
    if (previousSeenAtMs !== null && liveSeenAtMs <= previousSeenAtMs) return;

    previousSeenAtMsRef.current = liveSeenAtMs;
    setSamplePulseSequence((current) => current + 1);
    setIsSamplePulseActive(true);
    if (pulseTimeoutRef.current !== null) clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = setTimeout(() => {
      setIsSamplePulseActive(false);
      pulseTimeoutRef.current = null;
    }, SENSOR_SAMPLE_PULSE_MS);
  }, [liveSeenAtMs]);

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
          <IconTemperature
            key={samplePulseSequence}
            className="sensor-card-leading-icon__icon"
          />
        </span>
        <div className="sensor-card-title-row">
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
            <h3 className="sensor-card-title">{device.name}</h3>
          )}
          <span
            className={`sensor-card-live-values${
              runtimeReading?.stale ? ' sensor-card-live-values--stale' : ''
            }`}
          >
            {runtimeReading ? (
              <span
                className="sensor-card-source"
                title={`${t('hardware.rule.selectedShelly')}: ${runtimeReading.shellyName}`}
              >
                <IconPlug className="icon-action__svg" aria-hidden="true" />
              </span>
            ) : latest?.source === 'phone-scan' ? (
              <span
                className="sensor-card-source"
                title={t('hardware.sensor.scanPhoneTitle')}
              >
                <IconDeviceMobile className="icon-action__svg" aria-hidden="true" />
              </span>
            ) : latest?.source === 'shelly-scan' ? (
              <span className="sensor-card-source" title={t('hardware.nav.shellyTitle')}>
                <IconPlug className="icon-action__svg" aria-hidden="true" />
              </span>
            ) : null}
            <strong className="sensor-card-live-values__metrics">
              {formatSensorMetric(liveTemperatureC, ' °C', 1, '— °C')} ·{' '}
              {formatSensorMetric(liveHumidityPct, ' %', 1, '— %')} ·{' '}
              {formatSensorMetric(liveVpdKpa, ' kPa', 2, '— kPa')}
            </strong>
          </span>
        </div>
        <div className="sensor-card-actions">
          {!isEditing && (
            <button
              className="icon-action rule-summary-icon-action"
              type="button"
              aria-label={t('hardware.sensor.nameLabel')}
              title={t('hardware.sensor.nameLabel')}
              onClick={onEditStart}
            >
              <IconPencil className="icon-action__svg" aria-hidden="true" />
            </button>
          )}
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

      <div className="sensor-status-strip">
        <span
          className="sensor-status-strip__item"
          aria-label={`${t('hardware.metrics.battery')}: ${liveBattery}`}
          title={t('hardware.metrics.battery')}
        >
          <IconBattery aria-hidden="true" />
          <strong>{liveBattery}</strong>
        </span>
        <span
          className="sensor-status-strip__item"
          aria-label={`${t('common.rssi')}: ${liveRssi}`}
          title={t('common.rssi')}
        >
          <IconWifi aria-hidden="true" />
          <strong>{liveRssi}</strong>
        </span>
        <span
          className="sensor-status-strip__item"
          aria-label={`${t('hardware.metrics.lastMeasurement')}: ${formatSeenAt(
            liveSeenAtMs,
            locale,
            '—'
          )}`}
          title={t('hardware.metrics.lastMeasurement')}
        >
          <IconClock aria-hidden="true" />
          <strong>{formatSeenAt(liveSeenAtMs, locale, '—')}</strong>
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

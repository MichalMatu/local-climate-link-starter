import {
  MAX_CLIMATE_SENSORS,
  type ClimateSensorAggregation
} from '@lcl/script-generator';
import { SelectField } from '@lcl/ui';
import { IconDeviceMobile, IconPlug } from '@tabler/icons-react';
import { useTranslation } from '../../../app/i18n.js';
import { formatSensorLiveSummary } from '../presentation/climateRulePresentation.js';

export type ClimateRuleDevice = {
  id: string;
  name: string;
};

export type ClimateRuleSensorDevice = ClimateRuleDevice & {
  runtimeAddress: string;
};

export type ClimateRuleLiveReading = {
  source?: 'phone' | 'shelly-runtime' | undefined;
  identityProvenance?: 'recovered-runtime' | undefined;
  temperatureC?: number | undefined;
  humidityPct?: number | undefined;
  batteryPct?: number | undefined;
  rssi?: number | undefined;
  ageMs?: number | undefined;
  stale?: boolean | undefined;
  shellyName?: string | undefined;
};

type ClimateRuleDeviceSelectorsProps = {
  showShellySelector: boolean;
  shellyDevices: readonly ClimateRuleDevice[];
  selectedShellyId: string | null;
  selectShellyDevice(value: string): void;
  sensorDevices: readonly ClimateRuleSensorDevice[];
  selectedSensorId: string | null;
  additionalSensorIds: readonly string[];
  sensorAggregation: ClimateSensorAggregation;
  sensorLiveReadings: Record<string, ClimateRuleLiveReading>;
  selectSensorDevice(value: string): void;
  toggleAdditionalSensorDevice(value: string): void;
  setSensorAggregation(value: ClimateSensorAggregation): void;
};

export const ClimateRuleDeviceSelectors = ({
  showShellySelector,
  shellyDevices,
  selectedShellyId,
  selectShellyDevice,
  sensorDevices,
  selectedSensorId,
  additionalSensorIds,
  sensorAggregation,
  sensorLiveReadings,
  selectSensorDevice,
  toggleAdditionalSensorDevice,
  setSensorAggregation
}: ClimateRuleDeviceSelectorsProps) => {
  const { t } = useTranslation();

  const liveMeta = (device: ClimateRuleSensorDevice) => {
    const reading =
      sensorLiveReadings[device.runtimeAddress.trim().replace(/[:-]/g, '').toUpperCase()];
    const liveSourceLabel =
      reading?.source === 'shelly-runtime'
        ? t('hardware.rule.liveSourcePlugBle')
        : reading?.source === 'phone'
          ? t('hardware.rule.liveSourcePhoneBle')
          : undefined;
    const identityProvenanceLabel =
      reading?.identityProvenance === 'recovered-runtime'
        ? t('hardware.rule.identityRecoveredRuntime')
        : undefined;
    const provenanceLabels = [liveSourceLabel, identityProvenanceLabel].filter(
      (value): value is string => value !== undefined
    );
    const sourceTitleParts = [
      reading?.source === 'shelly-runtime' && liveSourceLabel
        ? `${liveSourceLabel}: ${reading.shellyName ?? ''}`
        : liveSourceLabel,
      identityProvenanceLabel
    ].filter((value): value is string => value !== undefined);
    const sourceTitle =
      sourceTitleParts.length > 0 ? sourceTitleParts.join(' · ') : undefined;

    return (
      <span
        className={`rule-sensor-option-live${
          reading?.stale ? ' rule-sensor-option-live--stale' : ''
        }`}
        title={sourceTitle}
      >
        {reading?.source === 'shelly-runtime' ? (
          <IconPlug aria-hidden="true" />
        ) : reading?.source === 'phone' ? (
          <IconDeviceMobile aria-hidden="true" />
        ) : null}
        <span>
          {formatSensorLiveSummary(reading)}
          {provenanceLabels.length > 0 ? ` · ${provenanceLabels.join(' · ')}` : ''}
        </span>
      </span>
    );
  };

  const additionalCandidates = sensorDevices.filter(
    (device) => device.id !== selectedSensorId
  );
  const additionalLimitReached = additionalSensorIds.length >= MAX_CLIMATE_SENSORS - 1;

  return (
    <>
      {showShellySelector && (
        <div className="field">
          <span>{t('hardware.rule.selectedShelly')}</span>
          <SelectField
            ariaLabel={t('hardware.rule.selectedShelly')}
            value={selectedShellyId ?? ''}
            placeholder={t('hardware.rule.noShellySelected')}
            options={shellyDevices.map((device) => ({
              value: device.id,
              label: device.name
            }))}
            onChange={selectShellyDevice}
          />
        </div>
      )}

      <div className="field">
        <span>{t('hardware.rule.selectedSensor')}</span>
        <SelectField
          ariaLabel={t('hardware.rule.selectedSensor')}
          value={selectedSensorId ?? ''}
          placeholder={t('hardware.flow.noSelectedSensor')}
          options={sensorDevices.map((device) => ({
            value: device.id,
            label: device.name,
            meta: liveMeta(device),
            triggerMeta: null
          }))}
          onChange={selectSensorDevice}
        />
      </div>

      {additionalCandidates.length > 0 && (
        <div className="field">
          <span>{t('hardware.rule.additionalSensors')}</span>
          <div className="rule-sensor-multi-list">
            {additionalCandidates.map((device) => {
              const checked = additionalSensorIds.includes(device.id);
              return (
                <label className="toggle-row rule-sensor-multi-option" key={device.id}>
                  <input
                    type="checkbox"
                    aria-label={device.name}
                    checked={checked}
                    disabled={!checked && additionalLimitReached}
                    onChange={() => toggleAdditionalSensorDevice(device.id)}
                  />
                  <span>{device.name}</span>
                  {liveMeta(device)}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {additionalSensorIds.length > 0 && (
        <div className="field">
          <span>{t('hardware.rule.sensorAggregation')}</span>
          <SelectField<ClimateSensorAggregation>
            ariaLabel={t('hardware.rule.sensorAggregation')}
            value={sensorAggregation}
            options={[
              { value: 'avg', label: t('hardware.rule.sensorAggregationAvg') },
              { value: 'min', label: t('hardware.rule.sensorAggregationMin') },
              { value: 'max', label: t('hardware.rule.sensorAggregationMax') },
              {
                value: 'firstValid',
                label: t('hardware.rule.sensorAggregationFirstValid')
              }
            ]}
            onChange={setSensorAggregation}
          />
        </div>
      )}
    </>
  );
};

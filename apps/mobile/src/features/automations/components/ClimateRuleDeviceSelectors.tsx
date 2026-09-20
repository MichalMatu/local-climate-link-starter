import { IconDeviceMobile, IconPlug } from '@tabler/icons-react';
import { SelectField } from '@lcl/ui';
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
  source: 'phone' | 'shelly-runtime';
  temperatureC?: number | undefined;
  humidityPct?: number | undefined;
  stale: boolean;
  shellyName?: string | undefined;
};

type ClimateRuleDeviceSelectorsProps = {
  showShellySelector: boolean;
  shellyDevices: readonly ClimateRuleDevice[];
  selectedShellyId: string | null;
  selectShellyDevice(value: string): void;
  sensorDevices: readonly ClimateRuleSensorDevice[];
  selectedSensorId: string | null;
  sensorLiveReadings: Record<string, ClimateRuleLiveReading>;
  selectSensorDevice(value: string): void;
};

export const ClimateRuleDeviceSelectors = ({
  showShellySelector,
  shellyDevices,
  selectedShellyId,
  selectShellyDevice,
  sensorDevices,
  selectedSensorId,
  sensorLiveReadings,
  selectSensorDevice
}: ClimateRuleDeviceSelectorsProps) => {
  const { t } = useTranslation();

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
          options={sensorDevices.map((device) => {
            const reading = sensorLiveReadings[device.runtimeAddress.toUpperCase()];
            const sourceTitle =
              reading?.source === 'shelly-runtime'
                ? `${t('hardware.rule.selectedShelly')}: ${reading.shellyName ?? ''}`
                : reading?.source === 'phone'
                  ? t('hardware.sensor.scanPhoneTitle')
                  : undefined;

            return {
              value: device.id,
              label: device.name,
              meta: (
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
                  <span>{formatSensorLiveSummary(reading)}</span>
                </span>
              )
            };
          })}
          onChange={selectSensorDevice}
        />
      </div>
    </>
  );
};

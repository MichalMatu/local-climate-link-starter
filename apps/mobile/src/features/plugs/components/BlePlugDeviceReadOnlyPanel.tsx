import type {
  ShellyCloudReadResult,
  ShellyPlugsUiReadResult
} from '@lcl/shelly-client';
import { DiagnosticRow } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';
import { deviceButtonModeCopy } from '../../../app/locales/deviceButtonMode.js';
import { deviceCloudCopy } from '../../../app/locales/deviceCloud.js';
import { deviceLedCopy } from '../../../app/locales/deviceLed.js';
import './PlugSettingsSurface.css';

export type BlePlugDeviceReadOnlyPanelProps = {
  settings: ShellyPlugsUiReadResult;
  cloud: ShellyCloudReadResult;
};

export const BlePlugDeviceReadOnlyPanel = ({
  settings,
  cloud
}: BlePlugDeviceReadOnlyPanelProps) => {
  const { locale, t } = useTranslation();
  const ledCopy = deviceLedCopy[locale];
  const buttonCopy = deviceButtonModeCopy[locale];
  const cloudCopy = deviceCloudCopy[locale];

  if (!settings.supported) {
    return (
      <section className="plug-detail-framed-section">
        <h3 className="plug-detail-framed-section__title">
          {t('hardware.shelly.settings')}
        </h3>
        <p className="plug-settings-feedback">{ledCopy.unsupported}</p>
      </section>
    );
  }

  const { config, capabilities, controlCapabilities } = settings;
  const ledModeLabel =
    config.leds.mode === 'power'
      ? ledCopy.power
      : config.leds.mode === 'switch'
        ? ledCopy.switch
        : ledCopy.off;
  const nightMode = config.leds.night_mode;
  const buttonMode = config.controls?.['switch:0']?.in_mode;
  const nightModeValue = nightMode?.enable
    ? [
        t('common.enabled'),
        `${nightMode.brightness}%`,
        nightMode.active_between.length === 2
          ? `${nightMode.active_between[0]}–${nightMode.active_between[1]}`
          : null
      ]
        .filter(Boolean)
        .join(' · ')
    : t('common.disabled');

  return (
    <section className="plug-detail-framed-section">
      <h3 className="plug-detail-framed-section__title">
        {t('hardware.shelly.settings')}
      </h3>
      <div className="plug-info-grid">
        <DiagnosticRow label={ledCopy.currentMode} value={ledModeLabel} />
        {config.leds.mode === 'power' && capabilities.powerBrightness && (
          <DiagnosticRow
            label={ledCopy.powerBrightness}
            value={`${config.leds.colors?.power?.brightness ?? 0}%`}
          />
        )}
        {capabilities.nightMode && (
          <DiagnosticRow label={ledCopy.nightMode} value={nightModeValue} />
        )}
        {controlCapabilities.buttonInputMode && buttonMode && (
          <DiagnosticRow
            label={buttonCopy.currentMode}
            value={
              buttonMode === 'momentary' ? buttonCopy.momentary : buttonCopy.detached
            }
          />
        )}
        {cloud.supported && (
          <>
            <DiagnosticRow
              label={cloudCopy.title}
              value={cloud.config.enable ? t('common.enabled') : t('common.disabled')}
            />
            <DiagnosticRow
              label={cloudCopy.connection}
              value={cloud.status.connected ? cloudCopy.connected : cloudCopy.disconnected}
            />
          </>
        )}
      </div>
    </section>
  );
};

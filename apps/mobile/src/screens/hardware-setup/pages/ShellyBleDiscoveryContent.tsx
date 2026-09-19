import { FeedbackPanel } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { ShellySetupFlow } from '../pageContracts.js';
import {
  formatBleCandidateProfile,
  formatNullableMetric
} from './ShellySetupPresentation.js';

type ShellyBleDiscoveryContentProps = {
  flow: ShellySetupFlow;
  onSaveCandidate(candidate: BleDiscoveryCandidate): void;
};

export const ShellyBleDiscoveryContent = ({
  flow,
  onSaveCandidate
}: ShellyBleDiscoveryContentProps) => {
  const { t } = useTranslation();
  const candidates = flow.bleDiscoverySnapshot?.candidates ?? [];
  const didStartFail = flow.bleDiscoverySnapshot?.lastReason === 'ble-scan-start-failed';
  const shouldShowRestart = Boolean(
    flow.bleDiscoverySession && flow.bleDiscoverySnapshot?.running === false
  );

  return (
    <>
      {didStartFail && (
        <FeedbackPanel tone="warning" title={t('hardware.shelly.scanBleStartFailed')}>
          {t('hardware.shelly.scanBleStartFailedDetail')}
        </FeedbackPanel>
      )}
      {!didStartFail && candidates.length === 0 && !shouldShowRestart && (
        <div className="scan-loading-state">
          <span className="scan-loading-state__spinner" aria-hidden="true" />
          <strong>{t('hardware.shelly.scanningBle')}</strong>
          <p>{t('hardware.shelly.scanningBleSafeOff')}</p>
        </div>
      )}
      {candidates.length > 0 && (
        <div
          className="ble-candidate-list"
          aria-label={t('hardware.sensor.foundBleListLabel')}
        >
          {candidates.map((candidate) => {
            const hasTemperature = typeof candidate.temperatureC === 'number';
            const hasHumidity = typeof candidate.humidityPct === 'number';
            const isSavedSensor = flow.sensorDevices.some(
              (sensor) =>
                sensor.runtimeAddress.toUpperCase() ===
                candidate.runtimeAddress.toUpperCase()
            );

            return (
              <article key={candidate.runtimeAddress} className="ble-candidate-item">
                <div className="ble-candidate-main">
                  <strong>{candidate.runtimeAddress}</strong>
                  <span>{formatBleCandidateProfile(candidate.profileId)}</span>
                </div>
                <dl className="ble-candidate-metrics">
                  <div>
                    <dt>RSSI</dt>
                    <dd>
                      {formatNullableMetric(
                        candidate.rssi,
                        t('common.missing'),
                        ' dBm',
                        0
                      )}
                    </dd>
                  </div>
                  {hasTemperature && (
                    <div>
                      <dt>Temp.</dt>
                      <dd>
                        {formatNullableMetric(
                          candidate.temperatureC,
                          t('common.missing'),
                          '°C'
                        )}
                      </dd>
                    </div>
                  )}
                  {hasHumidity && (
                    <div>
                      <dt>{t('hardware.metrics.humidity')}</dt>
                      <dd>
                        {formatNullableMetric(
                          candidate.humidityPct,
                          t('common.missing'),
                          '%'
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
                  onClick={() => onSaveCandidate(candidate)}
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
    </>
  );
};

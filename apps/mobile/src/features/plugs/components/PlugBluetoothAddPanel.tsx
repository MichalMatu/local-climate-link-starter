import { useTranslation } from '../../../app/i18n.js';
import type {
  PlugBleAdvertisement,
  VerifiedPlugBleCandidate
} from '../data/plugBleOnboarding.js';

export type PlugBluetoothAddPanelProps = {
  scanning: boolean;
  candidates: PlugBleAdvertisement[];
  inspectingDeviceId: string | null;
  verifiedCandidate: VerifiedPlugBleCandidate | null;
  error: string | null;
  onStart(): void;
  onStop(): void;
  onInspect(candidate: PlugBleAdvertisement): void;
};

export const PlugBluetoothAddPanel = ({
  scanning,
  candidates,
  inspectingDeviceId,
  verifiedCandidate,
  error,
  onStart,
  onStop,
  onInspect
}: PlugBluetoothAddPanelProps) => {
  const { t } = useTranslation();

  return (
    <section className="shelly-network-scan" role="tabpanel" aria-label={t('common.bluetooth')}>
      <div className="shelly-network-scan__body">
        {error && <p role="alert">{t('hardware.sensor.phoneBleGenericFailed')}</p>}

        {verifiedCandidate && (
          <article className="device-discovery-card shelly-scan-result">
            <div className="device-discovery-card__primary">
              <strong className="device-discovery-card__identity">
                {verifiedCandidate.advertisementName}
              </strong>
            </div>
            <div className="device-discovery-card__meta shelly-scan-result__meta">
              <span>{verifiedCandidate.physicalId}</span>
              <span>
                {verifiedCandidate.model}, gen {verifiedCandidate.generation}
              </span>
              <span>
                Wi-Fi {verifiedCandidate.network.state === 'has-wifi' ? '✓' : '—'} ·{' '}
                {verifiedCandidate.network.connectionStatus}
              </span>
            </div>
          </article>
        )}

        {candidates.length === 0 && !scanning && !verifiedCandidate && (
          <p>{t('hardware.shelly.scanResultEmpty')}</p>
        )}

        {candidates.length > 0 && (
          <div className="saved-list" aria-label={t('hardware.shelly.foundListLabel')}>
            {candidates.map((candidate) => {
              const inspecting = inspectingDeviceId === candidate.deviceId;
              const verified = verifiedCandidate?.bleDeviceId === candidate.deviceId;
              return (
                <article
                  key={candidate.deviceId}
                  className="device-discovery-card shelly-scan-result"
                >
                  <div className="device-discovery-card__primary">
                    <strong className="device-discovery-card__identity">{candidate.name}</strong>
                    <button
                      className="secondary-action device-discovery-card__action"
                      type="button"
                      aria-busy={inspecting || undefined}
                      disabled={inspecting || verified}
                      aria-label={`${t('common.info')}: ${candidate.name}`}
                      onClick={() => onInspect(candidate)}
                    >
                      {inspecting ? t('hardware.shelly.checking') : t('common.info')}
                    </button>
                  </div>
                  <div className="device-discovery-card__meta shelly-scan-result__meta">
                    <span>{candidate.deviceId}</span>
                    {candidate.rssi !== null && <span>RSSI {candidate.rssi} dBm</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="action-row shelly-network-scan__actions device-add-page__scan-control">
          <button
            className="secondary-action device-scan-action"
            type="button"
            aria-busy={scanning || undefined}
            onClick={scanning ? onStop : onStart}
          >
            {scanning && <span className="device-scan-action__spinner" aria-hidden="true" />}
            <span>
              {scanning ? t('hardware.shelly.scanStop') : t('hardware.shelly.scanStart')}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

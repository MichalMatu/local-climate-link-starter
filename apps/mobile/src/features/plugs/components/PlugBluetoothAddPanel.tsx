import { useTranslation } from '../../../app/i18n.js';
import type {
  PlugBleAdvertisement,
  VerifiedPlugBleCandidate
} from '../data/plugBleOnboarding.js';

export type PlugBluetoothAddPanelProps = {
  scanning: boolean;
  candidates: PlugBleAdvertisement[];
  inspectingDeviceId: string | null;
  verifiedCandidates: VerifiedPlugBleCandidate[];
  savedPhysicalIds: readonly string[];
  error: string | null;
  onStart(): void;
  onStop(): void;
  onAdd(candidate: PlugBleAdvertisement): void;
};

const normalize = (value: string): string => value.trim().toLowerCase();

const formatMetric = (
  value: number | null | undefined,
  suffix: string,
  fractionDigits: number
): string =>
  value == null || !Number.isFinite(value)
    ? '—'
    : `${value.toFixed(fractionDigits)}${suffix}`;

export const PlugBluetoothAddPanel = ({
  scanning,
  candidates,
  inspectingDeviceId,
  verifiedCandidates,
  savedPhysicalIds,
  error,
  onStart,
  onStop,
  onAdd
}: PlugBluetoothAddPanelProps) => {
  const { t } = useTranslation();
  const savedIds = new Set(savedPhysicalIds.map(normalize));

  return (
    <section className="shelly-network-scan" aria-label={t('common.bluetooth')}>
      <div className="shelly-network-scan__body">
        {error && <p role="alert">{t('hardware.sensor.phoneBleGenericFailed')}</p>}
        {candidates.length > 0 && (
          <div className="saved-list" aria-label={t('hardware.shelly.foundListLabel')}>
            {candidates.map((candidate) => {
              const inspecting = inspectingDeviceId === candidate.deviceId;
              const verified = verifiedCandidates.find(
                (item) => normalize(item.bleDeviceId) === normalize(candidate.deviceId)
              );
              const saved = verified
                ? savedIds.has(normalize(verified.physicalId))
                : false;
              const preview = verified?.preview ?? null;
              const actionIdentity = verified?.physicalId ?? candidate.name;

              return (
                <article
                  key={candidate.deviceId}
                  className="device-discovery-card shelly-scan-result"
                >
                  <div className="device-discovery-card__primary">
                    <strong className="device-discovery-card__identity">
                      {candidate.name}
                    </strong>
                    <button
                      className="primary-action device-discovery-card__action shelly-scan-result__add"
                      type="button"
                      aria-busy={inspecting || undefined}
                      disabled={inspecting || saved}
                      aria-label={
                        saved
                          ? `${t('hardware.shelly.alreadyAdded')}: ${actionIdentity}`
                          : `${t('common.add')}: ${actionIdentity}`
                      }
                      onClick={() => onAdd(candidate)}
                    >
                      {saved
                        ? t('hardware.shelly.alreadyAdded')
                        : inspecting
                          ? t('hardware.shelly.checking')
                          : t('common.add')}
                    </button>
                  </div>
                  <div className="device-discovery-card__meta shelly-scan-result__meta">
                    <span>{verified?.physicalId ?? candidate.deviceId}</span>
                    <span>
                      {verified
                        ? `${verified.model}, gen ${verified.generation}`
                        : candidate.rssi === null
                          ? 'RSSI —'
                          : `RSSI ${candidate.rssi} dBm`}
                    </span>
                  </div>
                  {verified && (
                    <dl
                      className="device-discovery-card__metrics ble-candidate-metrics"
                      aria-label={t('hardware.shelly.statusMetricsLabel')}
                    >
                      <div>
                        <dt>W</dt>
                        <dd>{formatMetric(preview?.powerW, ' W', 1)}</dd>
                      </div>
                      <div>
                        <dt>V</dt>
                        <dd>{formatMetric(preview?.voltageV, ' V', 0)}</dd>
                      </div>
                      <div>
                        <dt>A</dt>
                        <dd>{formatMetric(preview?.currentA, ' A', 2)}</dd>
                      </div>
                      <div>
                        <dt>NTP</dt>
                        <dd>{preview?.localTime ?? '—'}</dd>
                      </div>
                    </dl>
                  )}
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
            {scanning && (
              <span className="device-scan-action__spinner" aria-hidden="true" />
            )}
            <span>
              {scanning
                ? t('hardware.shelly.scanStop')
                : t('hardware.shelly.scanBleAgain')}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

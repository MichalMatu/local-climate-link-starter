import { IconAlertTriangle, IconPlug } from '@tabler/icons-react';
import { useTranslation } from '../../../app/i18n.js';
import { EditablePlugName } from '../../../components/EditablePlugName.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import { useSavedBlePlugRuntime } from '../flows/useSavedBlePlugRuntime.js';

export type BleOnlyPlugCardProps = {
  plug: SavedBlePlug;
  onNameChange(value: string): void;
};

const formatMetric = (
  value: number | null | undefined,
  suffix: string,
  fractionDigits: number
): string =>
  value == null || !Number.isFinite(value)
    ? '—'
    : `${value.toFixed(fractionDigits)}${suffix}`;

const formatEnergy = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kWh` : `${value.toFixed(0)} Wh`;
};

export const BleOnlyPlugCard = ({ plug, onNameChange }: BleOnlyPlugCardProps) => {
  const { t } = useTranslation();
  const runtime = useSavedBlePlugRuntime(plug);
  const relayState = runtime.status?.relayOn;
  const isBusy = runtime.isPending || runtime.isRelayPending || runtime.status === null;
  const hasError = runtime.isError || runtime.isRelayError;

  return (
    <article
      className="automation-card plug-card plug-card--unconfigured"
      aria-busy={runtime.isPending || runtime.isRelayPending}
    >
      <header className="automation-card__header">
        <span
          className={`automation-card__leading-icon${
            relayState === true ? ' automation-card__leading-icon--active' : ''
          }`}
          aria-hidden="true"
        >
          <IconPlug className="automation-card__icon" />
        </span>
        <div className="automation-card__identity">
          <EditablePlugName name={plug.name} variant="card" onCommit={onNameChange} />
          <p>
            {t('common.bluetooth')} · {plug.model}
          </p>
        </div>
      </header>

      <div
        className="automation-card__plug-runtime"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatMetric(runtime.status?.telemetry.powerW, ' W', 1)}</span>
        <span>{formatMetric(runtime.status?.telemetry.voltageV, ' V', 0)}</span>
        <span>{formatEnergy(runtime.status?.telemetry.energyWh)}</span>
        <span>{runtime.status?.clock.localTime ?? '—'}</span>
      </div>

      <div
        className="automation-relay-actions automation-card__relay-actions"
        role="group"
        aria-label={t('dashboard.output')}
      >
        <button
          className="automation-relay-button"
          type="button"
          aria-pressed={relayState === true}
          disabled={isBusy}
          onClick={() => {
            if (relayState !== true) runtime.turnRelayOn();
          }}
        >
          ON
        </button>
        <button
          className="automation-relay-button"
          type="button"
          aria-pressed={relayState === false}
          disabled={isBusy}
          onClick={() => {
            if (relayState !== false) runtime.turnRelayOff();
          }}
        >
          OFF
        </button>
      </div>

      {hasError && (
        <footer className="automation-card__footer">
          {runtime.isError && (
            <div
              className="automation-card__status automation-card__status--offline"
              role="alert"
            >
              <IconAlertTriangle aria-hidden="true" />
              <span>{t('dashboard.readFailed')}</span>
            </div>
          )}
          {runtime.isRelayError && (
            <span className="automation-control-error" role="alert">
              {t('detail.actionFailed')}
            </span>
          )}
        </footer>
      )}
    </article>
  );
};

import { IconDotsVertical } from '@tabler/icons-react';
import { useTranslation } from '../../app/i18n.js';
import type { SavedPlug } from '../../flows/devices/plugs/model.js';
import { usePlugRuntimeQuery } from '../../flows/devices/plugs/usePlugManagementFlow.js';
import type { AutomationRule } from '../../flows/rules/model.js';
import {
  formatPlugClock,
  formatPlugEnergy,
  formatPlugPower,
  formatPlugVoltage
} from './plugPresentation.js';

export const SavedPlugCard = ({
  plug,
  rules,
  onOpen
}: {
  plug: SavedPlug;
  rules: readonly AutomationRule[];
  onOpen(): void;
}) => {
  const { t } = useTranslation();
  const runtime = usePlugRuntimeQuery(plug, rules);
  const snapshot = runtime.data?.ok ? runtime.data.value : null;
  const telemetry = snapshot?.telemetry;

  return (
    <article
      className="saved-list__item shelly-saved-card"
      aria-busy={runtime.isFetching}
    >
      <div className="shelly-card-header">
        <h3>{plug.name}</h3>
        <button
          className="automation-card__menu"
          type="button"
          aria-label={`${t('hardware.shelly.settings')}: ${plug.name}`}
          title={t('hardware.shelly.settings')}
          onClick={onOpen}
        >
          <IconDotsVertical className="automation-card__menu-icon" aria-hidden="true" />
        </button>
      </div>

      <div
        className="shelly-metrics-strip"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatPlugPower(telemetry?.powerW, t)}</span>
        <span>{formatPlugVoltage(telemetry?.voltageV, t)}</span>
        <span>{formatPlugEnergy(telemetry?.energyWh, t)}</span>
        <span>{formatPlugClock(snapshot?.clock, t)}</span>
      </div>
    </article>
  );
};

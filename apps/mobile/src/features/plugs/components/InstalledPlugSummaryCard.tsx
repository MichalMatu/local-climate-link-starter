import { IconSettings } from '@tabler/icons-react';
import { useTranslation } from '../../../app/i18n.js';

export type InstalledPlugSummaryCardProps = {
  deviceId: string;
  currentValue: string;
  temperatureValue: string;
  clockSyncValue: string;
  onOpenSettings?: (deviceId: string) => void;
};

export const InstalledPlugSummaryCard = ({
  deviceId,
  currentValue,
  temperatureValue,
  clockSyncValue,
  onOpenSettings
}: InstalledPlugSummaryCardProps) => {
  const { t } = useTranslation();

  return (
    <article className="automation-card installation-detail-shelly">
      <div className="installation-section-heading">
        <h2>{t('hardware.diagnostics.groupShelly')}</h2>
        {onOpenSettings && (
          <button
            aria-label={t('hardware.shelly.settings')}
            className="icon-action"
            title={t('hardware.shelly.settings')}
            type="button"
            onClick={() => onOpenSettings(deviceId)}
          >
            <IconSettings className="icon-action__svg" aria-hidden="true" />
          </button>
        )}
      </div>
      <dl className="automation-summary installation-detail-summary">
        <div>
          <dt>{t('hardware.metrics.current')}</dt>
          <dd>{currentValue}</dd>
        </div>
        <div>
          <dt>{t('hardware.metrics.plugTemperature')}</dt>
          <dd>{temperatureValue}</dd>
        </div>
        <div>
          <dt>{t('hardware.shelly.clockSync')}</dt>
          <dd>{clockSyncValue}</dd>
        </div>
      </dl>
    </article>
  );
};

import { DiagnosticRow, StatusBadge } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';
import type { PlugInformation } from '../data/plugInformation.js';
import './PlugSettingsSurface.css';

export type PlugInfoConnection =
  | { transport: 'wifi'; baseUrl: string }
  | { transport: 'bluetooth'; bleDeviceId: string; advertisementName: string };

export type PlugInfoPanelProps = {
  connection: PlugInfoConnection;
  information?: PlugInformation | undefined;
  loading?: boolean;
  error?: boolean;
  deviceRamFreeBytes?: number | null | undefined;
  deviceRamTotalBytes?: number | null | undefined;
  showResourceRows?: boolean;
};

const formatNumber = (
  value: number | null | undefined,
  suffix: string,
  missing: string,
  digits = 1
): string => (value == null ? missing : `${value.toFixed(digits)}${suffix}`);

const formatBytes = (value: number | null | undefined, missing: string): string => {
  if (value == null) return missing;
  return value < 1024 ? `${Math.round(value)} B` : `${(value / 1024).toFixed(1)} KiB`;
};

const formatUptime = (value: number | undefined, missing: string): string => {
  if (value == null) return missing;
  const totalMinutes = Math.floor(value / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
};

export const PlugInfoPanel = ({
  connection,
  information,
  loading = false,
  error = false,
  deviceRamFreeBytes,
  deviceRamTotalBytes,
  showResourceRows = true
}: PlugInfoPanelProps) => {
  const { locale, t } = useTranslation();
  const missing = t('common.missing');

  if (loading) {
    return (
      <section className="plug-detail-framed-section">
        <h3 className="plug-detail-framed-section__title">{t('hardware.nav.shelly')}</h3>
        <div className="plug-detail-loading" role="status">
          <span className="plug-detail-loading__spinner" aria-hidden="true" />
          <span>{t('common.refreshing')}</span>
        </div>
      </section>
    );
  }

  if (error || !information) {
    return (
      <section className="plug-detail-framed-section">
        <h3 className="plug-detail-framed-section__title">{t('hardware.nav.shelly')}</h3>
        <p className="plug-settings-feedback plug-settings-feedback--warning">
          {t('dashboard.readFailed')}
        </p>
      </section>
    );
  }

  const { deviceInfo, status } = information;
  const telemetry = status.telemetry;
  return (
    <section className="plug-detail-framed-section">
      <h3 className="plug-detail-framed-section__title">{t('hardware.nav.shelly')}</h3>
      <div className="plug-info-grid">
        <div className="lcl-diagnostic-row">
          <span>{t('common.model')}</span>
          <div className="lcl-compact-device__meta">
            <strong>{`${deviceInfo.model}, gen ${deviceInfo.gen}`}</strong>
          </div>
        </div>
        <DiagnosticRow
          label={t('common.firmware')}
          value={deviceInfo.firmwareId ?? missing}
        />
        {connection.transport === 'wifi' ? (
          <>
            <DiagnosticRow
              href={connection.baseUrl}
              label={t('hardware.shelly.addressSettings')}
              linkLabel={t('hardware.shelly.openPanelLabel', {
                address: connection.baseUrl
              })}
              value={connection.baseUrl}
            />
            <DiagnosticRow
              label={t('hardware.metrics.wifiRssi')}
              value={formatNumber(telemetry.wifiRssiDbm, ' dBm', missing, 0)}
            />
          </>
        ) : (
          <DiagnosticRow
            label={t('common.bluetooth')}
            value={`${connection.bleDeviceId} · ${connection.advertisementName || missing}`}
          />
        )}
        <DiagnosticRow
          label={t('hardware.shelly.uptime')}
          value={formatUptime(status.clock.uptimeSec, missing)}
        />
        <DiagnosticRow
          label="NTP"
          value={`${status.clock.localTime ?? missing} · ${
            status.clock.timeSynced
              ? t('hardware.status.synced')
              : t('hardware.status.unsynced')
          } · ${
            status.clock.lastSyncUnixTimeSec == null
              ? missing
              : new Intl.DateTimeFormat(locale, {
                  dateStyle: 'short',
                  timeStyle: 'medium'
                }).format(status.clock.lastSyncUnixTimeSec * 1000)
          }`}
          tone={status.clock.timeSynced ? 'normal' : 'warning'}
        />
        <DiagnosticRow
          label={t('hardware.metrics.current')}
          value={formatNumber(telemetry.currentA, ' A', missing, 2)}
        />
        <DiagnosticRow
          label={t('hardware.metrics.plugTemperature')}
          value={formatNumber(telemetry.deviceTemperatureC, '°C', missing, 1)}
        />
        <div className="lcl-diagnostic-row">
          <span>{t('hardware.shelly.matter')}</span>
          <StatusBadge tone={status.matterEnabled ? 'warning' : 'inactive'}>
            {status.matterEnabled ? t('common.enabled') : t('common.disabled')}
          </StatusBadge>
        </div>
        {showResourceRows && (
          <>
            <DiagnosticRow
              label={t('hardware.diagnostics.deviceRamFree')}
              value={formatBytes(deviceRamFreeBytes, missing)}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.deviceRamTotal')}
              value={formatBytes(deviceRamTotalBytes, missing)}
            />
          </>
        )}
      </div>
    </section>
  );
};

import { DiagnosticRow, FeedbackPanel, ScriptPreview } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';

export type ClimateRecoverySectionProps = {
  title: string;
  description: string;
  actionLabel: string;
  primary: boolean;
  busy: boolean;
  onAction(): void;
};

export const ClimateRecoverySection = ({
  title,
  description,
  actionLabel,
  primary,
  busy,
  onAction
}: ClimateRecoverySectionProps) => (
  <section className="plug-detail-recovery" aria-label={title}>
    <FeedbackPanel tone="warning" title={title}>
      {description}
    </FeedbackPanel>
    <div className="installation-detail-actions">
      <button
        className={primary ? 'primary-action' : 'secondary-action'}
        type="button"
        disabled={busy}
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </div>
  </section>
);

export type ClimateAutomationDetailSectionProps = {
  reason: string;
  relayRule: string;
  shellyRelay: string;
};

export const ClimateAutomationDetailSection = ({
  reason,
  relayRule,
  shellyRelay
}: ClimateAutomationDetailSectionProps) => {
  const { t } = useTranslation();

  return (
    <section className="installation-automation-live-state">
      <dl className="automation-summary installation-detail-summary">
        <div>
          <dt>{t('hardware.metrics.reason')}</dt>
          <dd>{reason}</dd>
        </div>
        <div>
          <dt>{t('hardware.metrics.relayRule')}</dt>
          <dd>{relayRule}</dd>
        </div>
        <div>
          <dt>{t('hardware.metrics.shellyRelay')}</dt>
          <dd>{shellyRelay}</dd>
        </div>
      </dl>
    </section>
  );
};

export type ClimateBleSensorView = {
  id: string;
  name: string;
  address: string;
  temperature: string;
  humidity: string;
  battery: string;
  rssi: string;
  lastMeasurement: string;
  lastPacket?: string;
  dataState: string;
};

export type ClimateBleDetailSectionProps = {
  sensors: readonly ClimateBleSensorView[];
  bluetoothState?: string;
  onScan?: () => void;
};

export const ClimateBleDetailSection = ({
  sensors,
  bluetoothState,
  onScan
}: ClimateBleDetailSectionProps) => {
  const { t } = useTranslation();

  return (
    <section>
      <div className="installation-ble-card">
        {bluetoothState && (
          <div className="installation-ble-card__status">
            <span>{t('common.bluetooth')}</span>
            <strong>{bluetoothState}</strong>
          </div>
        )}
        <div className="installation-sensor-list">
          {sensors.map((sensor) => (
            <section className="installation-sensor-item" key={sensor.id}>
              <div className="installation-sensor-item__header">
                <strong>{sensor.name}</strong>
                <span>{sensor.address}</span>
              </div>
              <dl className="automation-summary installation-detail-summary">
                <div>
                  <dt>{t('hardware.metrics.temperature')}</dt>
                  <dd>{sensor.temperature}</dd>
                </div>
                <div>
                  <dt>{t('hardware.metrics.humidity')}</dt>
                  <dd>{sensor.humidity}</dd>
                </div>
                <div>
                  <dt>{t('hardware.metrics.battery')}</dt>
                  <dd>{sensor.battery}</dd>
                </div>
                <div>
                  <dt>RSSI</dt>
                  <dd>{sensor.rssi}</dd>
                </div>
                <div>
                  <dt>{t('hardware.metrics.lastMeasurement')}</dt>
                  <dd>{sensor.lastMeasurement}</dd>
                </div>
                {sensor.lastPacket && (
                  <div>
                    <dt>{t('hardware.metrics.lastBlePacket')}</dt>
                    <dd>{sensor.lastPacket}</dd>
                  </div>
                )}
                <div>
                  <dt>{t('hardware.metrics.dataBle')}</dt>
                  <dd>{sensor.dataState}</dd>
                </div>
              </dl>
            </section>
          ))}
        </div>
      </div>
      {onScan && (
        <button className="secondary-action" type="button" onClick={onScan}>
          {t('hardware.shelly.scanBleViaShellyTitle')}
        </button>
      )}
    </section>
  );
};

export type ClimateScriptDiagnosticRow = {
  label: string;
  value: string;
};

export type ClimateScriptDiagnosticsSectionProps = {
  title: string;
  rows: readonly ClimateScriptDiagnosticRow[];
};

export const ClimateScriptDiagnosticsSection = ({
  title,
  rows
}: ClimateScriptDiagnosticsSectionProps) => (
  <section className="plug-script-diagnostics">
    <h3 className="plug-detail-subheading">{title}</h3>
    <div className="plug-info-grid">
      {rows.map((row) => (
        <DiagnosticRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  </section>
);

export type ClimateScriptDetailSectionProps = {
  attentionMessage?: string;
  attentionTitle: string;
  copyAriaLabel: string;
  copyLabel: string;
  error: boolean;
  errorTitle: string;
  loading: boolean;
  loadingLabel: string;
  previewLabel: string;
  retryLabel: string;
  source?: string;
  onCopy(): void;
  onRetry(): void;
};

export const ClimateScriptDetailSection = ({
  attentionMessage,
  attentionTitle,
  copyAriaLabel,
  copyLabel,
  error,
  errorTitle,
  loading,
  loadingLabel,
  previewLabel,
  retryLabel,
  source,
  onCopy,
  onRetry
}: ClimateScriptDetailSectionProps) => (
  <section>
    {attentionMessage && (
      <FeedbackPanel tone="warning" title={attentionTitle}>
        {attentionMessage}
      </FeedbackPanel>
    )}
    {loading && (
      <div className="plug-detail-loading plug-detail-loading--section" role="status">
        <span className="plug-detail-loading__spinner" aria-hidden="true" />
        <span>{loadingLabel}</span>
      </div>
    )}
    {error && (
      <FeedbackPanel tone="danger" title={errorTitle}>
        <button className="secondary-action" type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      </FeedbackPanel>
    )}
    {source !== undefined && (
      <ScriptPreview
        code={source}
        copyAriaLabel={copyAriaLabel}
        copyLabel={copyLabel}
        label={previewLabel}
        variant="fill"
        onCopy={onCopy}
      />
    )}
  </section>
);

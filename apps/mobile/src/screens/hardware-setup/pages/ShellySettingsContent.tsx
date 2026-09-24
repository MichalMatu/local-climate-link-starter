import { DiagnosticRow, FeedbackPanel } from '@lcl/ui';
import { IconBluetooth, IconTrash } from '@tabler/icons-react';
import { useTranslation } from '../../../app/i18n.js';
import {
  PlugButtonModeSettingsCard,
  PlugCloudSettingsCard,
  PlugLedSettingsCard
} from '../../../features/plugs/index.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import { mutationError } from '../helpers.js';
import type { ShellySetupFlow } from '../pageContracts.js';
import {
  formatClockSyncState,
  formatClockTimestamp,
  formatClockUptime,
  formatComponentState
} from './ShellySetupPresentation.js';

type ShellySettingsContentProps = {
  flow: ShellySetupFlow;
  device: ShellyDraftDevice;
  enableBleDiscovery: boolean;
  onBleScan(device: ShellyDraftDevice): void;
  onRemove(device: ShellyDraftDevice): void;
};

export const ShellySettingsContent = ({
  flow,
  device,
  enableBleDiscovery,
  onBleScan,
  onRemove
}: ShellySettingsContentProps) => {
  const { locale, t } = useTranslation();
  const controlState = flow.shellyControlStates[device.id];
  const status = controlState?.status;
  const settingsTarget = { deviceId: device.id, baseUrl: device.baseUrl };

  return (
    <div className="settings-modal-layout">
      {flow.recheckShellyMutation.isError && (
        <FeedbackPanel
          tone="warning"
          title={mutationError(flow.recheckShellyMutation.error)}
        >
          {t('hardware.shelly.checkFailedDetail')}
        </FeedbackPanel>
      )}
      <div className="status-stack">
        <div className="lcl-diagnostic-row">
          <span>{t('common.model')}</span>
          <div className="lcl-compact-device__meta">
            <strong>
              {(flow.setupStatus?.deviceInfo.model ?? device.model)
                ? `${flow.setupStatus?.deviceInfo.model ?? device.model}, gen ${flow.setupStatus?.deviceInfo.gen ?? device.gen ?? '?'}`
                : t('common.missingData')}
            </strong>
          </div>
        </div>
        <DiagnosticRow
          href={device.baseUrl}
          label={t('hardware.shelly.addressSettings')}
          linkLabel={t('hardware.shelly.openPanelLabel', { address: device.baseUrl })}
          value={device.baseUrl}
        />
        <DiagnosticRow
          label={t('common.firmware')}
          value={status?.firmwareId ?? t('common.missingData')}
        />
        <DiagnosticRow
          label={t('hardware.metrics.wifiRssi')}
          value={
            status?.telemetry.wifiRssiDbm === undefined
              ? t('common.missing')
              : `${status.telemetry.wifiRssiDbm} dBm`
          }
        />
        <DiagnosticRow
          label={t('hardware.shelly.uptime')}
          value={formatClockUptime(status?.clock.uptimeSec, t)}
        />
        <DiagnosticRow
          label="NTP"
          value={
            status
              ? `${formatClockSyncState(status.clock, t)} · ${formatClockTimestamp(
                  status.clock.lastSyncUnixTimeSec,
                  locale,
                  t
                )}`
              : t('common.missingData')
          }
          tone={status?.clock.timeSynced ? 'normal' : 'warning'}
        />
        <DiagnosticRow
          label={t('hardware.shelly.scripts')}
          value={flow.setupStatus ? t('common.enabled') : t('common.missingData')}
        />
        <DiagnosticRow
          label="Bluetooth"
          value={
            flow.setupStatus
              ? formatComponentState(flow.setupStatus.status.bluetooth, t)
              : t('common.missingData')
          }
        />
        <DiagnosticRow
          label={t('hardware.shelly.matter')}
          value={
            flow.setupStatus
              ? flow.setupStatus.status.matterEnabled
                ? t('common.enabled')
                : t('common.disabled')
              : t('common.missingData')
          }
        />
      </div>

      <PlugButtonModeSettingsCard target={settingsTarget} />
      <PlugCloudSettingsCard target={settingsTarget} />
      <PlugLedSettingsCard target={settingsTarget} />

      <div className="action-row">
        {enableBleDiscovery && (
          <button
            className="secondary-action"
            type="button"
            title={t('hardware.shelly.scanBleViaShellyTitle')}
            onClick={() => onBleScan(device)}
          >
            <IconBluetooth className="icon-action__svg" aria-hidden="true" />
            <span>{t('hardware.shelly.scanBleViaShellyTitle')}</span>
          </button>
        )}
        <button
          className="secondary-action secondary-action--danger"
          type="button"
          title={t('hardware.shelly.deleteTitle')}
          onClick={() => onRemove(device)}
        >
          <IconTrash className="icon-action__svg" aria-hidden="true" />
          <span>{t('hardware.shelly.deleteTitle')}</span>
        </button>
      </div>
    </div>
  );
};

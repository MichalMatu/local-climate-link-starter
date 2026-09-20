import type { ShellyClockStatus, ShellyComponentState } from '@lcl/shelly-client';
import { IconBluetooth, IconSettings, IconPencil, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import {
  useTranslation,
  type Locale,
  type Translate,
  type TranslationKey
} from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import { SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS } from '../../../flows/hardware-setup/shellyRequests.js';
import { SHELLY_SETUP_SCAN_CONCURRENCY } from '../../../flows/hardware-setup/useShellySetupScanFlow.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import { countIpv4RangeScanAddresses } from '../../../flows/hardware-setup/validation.js';
import type { ShellySetupFlow } from '../pageContracts.js';

export const formatNullableMetric = (
  value: number | null | undefined,
  missingLabel: string,
  suffix = '',
  fractionDigits = 1
): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(fractionDigits)}${suffix}`
    : missingLabel;

export const formatComponentState = (
  state: ShellyComponentState,
  t: Translate
): string => {
  switch (state) {
    case 'enabled':
      return t('common.enabled');
    case 'disabled':
      return t('common.disabled');
    case 'missing':
      return t('common.missingInStatus');
  }
};

export const shellyCompatibilityBadge = (
  status: ShellySetupFlow['setupStatus'],
  t: Translate
) => {
  if (!status) {
    return { label: t('common.unknown'), tone: 'inactive' as const };
  }
  if (status.status.matterEnabled) {
    return { label: t('hardware.status.blocked'), tone: 'danger' as const };
  }
  if (status.status.scripts !== 'enabled' || status.status.bluetooth !== 'enabled') {
    return { label: t('hardware.status.check'), tone: 'warning' as const };
  }
  return { label: t('hardware.status.compatible'), tone: 'ok' as const };
};

export const formatPlugPower = (value: number | undefined, t: Translate): string =>
  value === undefined
    ? t('common.missing')
    : formatNullableMetric(value, t('common.missing'), ' W', 1);

export const formatPlugVoltage = (value: number | undefined, t: Translate): string =>
  value === undefined
    ? t('common.missing')
    : formatNullableMetric(value, t('common.missing'), ' V', 0);

export const formatPlugEnergy = (value: number | undefined, t: Translate): string => {
  if (value === undefined) {
    return t('common.missing');
  }
  return value >= 1000
    ? `${(value / 1000).toFixed(2)} kWh`
    : formatNullableMetric(value, t('common.missing'), ' Wh', 0);
};

export const formatShellyClock = (
  clock: ShellyClockStatus | undefined,
  t: Translate
): string => clock?.localTime ?? t('common.missing');

export const formatClockSyncState = (
  clock: ShellyClockStatus | undefined,
  t: Translate
): string =>
  clock
    ? clock.timeSynced
      ? t('hardware.status.synced')
      : t('hardware.status.unsynced')
    : t('common.missingData');

export const formatAutomationMode = (
  mode: NonNullable<ShellyControlCardState['status']>['automationMode'] | undefined,
  t: Translate
): string => {
  switch (mode) {
    case 'auto':
      return 'AUTO';
    case 'manual':
      return 'MANUAL';
    case 'missing':
      return t('hardware.rule.values.noScript');
    default:
      return t('common.missingData');
  }
};

export const formatBleCandidateProfile = (
  profileId: BleDiscoveryCandidate['profileId']
): string => (profileId === 'tp357_custom_v1' ? 'TP357' : 'Xiaomi/PVVX BTHome v2');

const formatAddressCount = (count: number, locale: Locale, t: Translate): string => {
  const pluralCategory = new Intl.PluralRules(locale).select(count);
  const nounKey =
    count === 1
      ? 'hardware.shelly.addressNounOne'
      : pluralCategory === 'few'
        ? 'hardware.shelly.addressNounFew'
        : 'hardware.shelly.addressNounMany';

  return `${count} ${t(nounKey as TranslationKey)}`;
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0
    ? `${minutes} min`
    : `${minutes} min ${remainingSeconds} s`;
};

export const formatClockUptime = (seconds: number | undefined, t: Translate): string => {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return t('common.missing');
  }

  const wholeSeconds = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  if (hours === 0) {
    return formatDuration(wholeSeconds);
  }

  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

export const formatClockTimestamp = (
  unixTimeSec: number | undefined,
  locale: Locale,
  t: Translate
): string =>
  unixTimeSec === undefined || !Number.isFinite(unixTimeSec)
    ? t('common.missing')
    : new Date(unixTimeSec * 1000).toLocaleString(locale, {
        dateStyle: 'short',
        timeStyle: 'short'
      });

export const formatShellyScanEstimate = (
  startInput: string,
  endInput: string,
  locale: Locale,
  t: Translate
): string => {
  try {
    const addressCount = countIpv4RangeScanAddresses(startInput, endInput);
    const batches = Math.ceil(addressCount / SHELLY_SETUP_SCAN_CONCURRENCY);
    const seconds = Math.ceil((batches * SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS) / 1000);
    return t('hardware.shelly.scanEstimate', {
      count: formatAddressCount(addressCount, locale, t),
      concurrency: SHELLY_SETUP_SCAN_CONCURRENCY,
      duration: formatDuration(seconds)
    });
  } catch {
    return t('hardware.shelly.scanEstimateUnavailable');
  }
};

type ShellyControlCardState = ShellySetupFlow['shellyControlStates'][string];

type SavedShellyDeviceCardProps = {
  device: ShellyDraftDevice;
  controlState: ShellyControlCardState | undefined;
  onNameChange: (device: ShellyDraftDevice, value: string) => void;
  onInfoOpen: (device: ShellyDraftDevice) => void;
  onBleScan?: (device: ShellyDraftDevice) => void;
  onRemove: (device: ShellyDraftDevice) => void;
};

export const SavedShellyDeviceCard = ({
  device,
  controlState,
  onNameChange,
  onInfoOpen,
  onBleScan,
  onRemove
}: SavedShellyDeviceCardProps) => {
  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const controlStatus = controlState?.status ?? null;
  const isControlBusy =
    controlState?.pendingAction !== null && controlState?.pendingAction !== undefined;
  const telemetry = controlStatus?.telemetry;
  const clock = controlStatus?.clock;

  return (
    <article
      className="saved-list__item shelly-saved-card"
      aria-busy={isControlBusy || undefined}
    >
      <div className="shelly-card-header">
        {isEditingName ? (
          <input
            autoFocus
            className="shelly-card-name-input"
            aria-label={t('hardware.shelly.deviceNameLabel')}
            type="text"
            value={device.name}
            onBlur={() => setIsEditingName(false)}
            onChange={(event) => onNameChange(device, event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          <div className="shelly-card-title-row">
            <h3>{device.name}</h3>
            <button
              className="icon-action rule-summary-icon-action"
              type="button"
              aria-label={t('hardware.shelly.deviceNameLabel')}
              title={t('hardware.shelly.deviceNameLabel')}
              onClick={() => setIsEditingName(true)}
            >
              <IconPencil className="icon-action__svg" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="shelly-card-actions">
          <button
            className="icon-action"
            type="button"
            aria-label={t('hardware.shelly.settings')}
            title={t('hardware.shelly.settings')}
            onClick={() => onInfoOpen(device)}
          >
            <IconSettings className="icon-action__svg" aria-hidden="true" />
          </button>
          <button
            className="icon-action icon-action--danger"
            type="button"
            aria-label={t('hardware.shelly.deleteTitle')}
            title={t('hardware.shelly.deleteTitle')}
            onClick={() => onRemove(device)}
          >
            <IconTrash className="icon-action__svg" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="shelly-metrics-strip"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatPlugPower(telemetry?.powerW, t)}</span>
        <span>{formatPlugVoltage(telemetry?.voltageV, t)}</span>
        <span>{formatPlugEnergy(telemetry?.energyWh, t)}</span>
        <span>{formatShellyClock(clock, t)}</span>
      </div>

      {onBleScan && (
        <button
          className="shelly-ble-action"
          type="button"
          disabled={isControlBusy}
          title={t('hardware.shelly.scanBleViaShellyTitle')}
          onClick={() => onBleScan(device)}
        >
          <IconBluetooth className="icon-action__svg" aria-hidden="true" />
          <span>{t('hardware.shelly.scanBleViaShellyTitle')}</span>
        </button>
      )}
    </article>
  );
};

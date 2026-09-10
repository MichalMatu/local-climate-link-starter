import type { ShellyClockStatus, ShellyComponentState } from '@lcl/shelly-client';
import { IconRefresh, IconSettings } from '@tabler/icons-react';
import { useId } from 'react';
import {
  useTranslation,
  type Locale,
  type Translate,
  type TranslationKey
} from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import {
  SHELLY_SETUP_SCAN_CONCURRENCY,
  SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS
} from '../../../flows/hardware-setup/shellyRequests.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import { countIpv4RangeScanAddresses } from '../../../flows/hardware-setup/validation.js';
import type { HardwarePageProps } from '../helpers.js';

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
  status: HardwarePageProps['flow']['setupStatus'],
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

type ShellyControlCardState = HardwarePageProps['flow']['shellyControlStates'][string];

type ShellyAddFormProps = {
  flow: HardwarePageProps['flow'];
  showValidationErrors: boolean;
};

export const ShellyAddForm = ({ flow, showValidationErrors }: ShellyAddFormProps) => {
  const { t } = useTranslation();
  const nameInputId = useId();
  const nameErrorId = useId();
  const urlInputId = useId();
  const urlErrorId = useId();
  const nameError =
    showValidationErrors && !flow.shellyInputState.ok
      ? flow.shellyInputState.fieldErrors.name
      : undefined;
  const urlError =
    showValidationErrors && !flow.shellyInputState.ok
      ? flow.shellyInputState.fieldErrors.url
      : undefined;

  return (
    <>
      <div className={nameError ? 'field field--invalid' : 'field'}>
        <label htmlFor={nameInputId}>{t('hardware.shelly.deviceNameLabel')}</label>
        <input
          id={nameInputId}
          aria-describedby={nameError ? nameErrorId : undefined}
          aria-invalid={nameError ? true : undefined}
          type="text"
          value={flow.shellyNameInput}
          onChange={(event) => flow.setShellyNameInput(event.currentTarget.value)}
        />
        {nameError && (
          <span className="field__error" id={nameErrorId}>
            {nameError}
          </span>
        )}
      </div>
      <div className={urlError ? 'field field--invalid' : 'field'}>
        <label htmlFor={urlInputId}>{t('hardware.shelly.addressInputLabel')}</label>
        <input
          id={urlInputId}
          aria-describedby={urlError ? urlErrorId : undefined}
          aria-invalid={urlError ? true : undefined}
          type="url"
          inputMode="url"
          placeholder={t('hardware.shelly.addressPlaceholder')}
          value={flow.shellyUrlInput}
          onChange={(event) => flow.setShellyUrlInput(event.currentTarget.value)}
        />
        {urlError && (
          <span className="field__error" id={urlErrorId}>
            {urlError}
          </span>
        )}
      </div>
    </>
  );
};

type SavedShellyDeviceCardProps = {
  device: ShellyDraftDevice;
  controlState: ShellyControlCardState | undefined;
  onRelayOn: (device: ShellyDraftDevice) => void;
  onRelayOff: (device: ShellyDraftDevice) => void;
  onAutomationAuto: (device: ShellyDraftDevice) => void;
  onAutomationManual: (device: ShellyDraftDevice) => void;
  onRefreshControl: (device: ShellyDraftDevice) => void;
  onClockOpen: (device: ShellyDraftDevice) => void;
  onSettingsOpen: (device: ShellyDraftDevice) => void;
};

export const SavedShellyDeviceCard = ({
  device,
  controlState,
  onRelayOn,
  onRelayOff,
  onAutomationAuto,
  onAutomationManual,
  onRefreshControl,
  onClockOpen,
  onSettingsOpen
}: SavedShellyDeviceCardProps) => {
  const { t } = useTranslation();
  const controlStatus = controlState?.status ?? null;
  const pendingAction = controlState?.pendingAction ?? null;
  const isControlBusy = pendingAction !== null;
  const relayToggleLabel = controlStatus?.relayOn ? 'OFF' : 'ON';
  const relayToggleTitle =
    controlStatus === null
      ? t('hardware.shelly.relayUnknownTitle')
      : controlStatus.relayOn
        ? t('hardware.shelly.relayOnTitle')
        : t('hardware.shelly.relayOffTitle');
  const relayToggleClass =
    controlStatus === null
      ? 'secondary-action relay-toggle relay-toggle--unknown'
      : controlStatus.relayOn
        ? 'secondary-action relay-toggle relay-toggle--on'
        : 'secondary-action relay-toggle relay-toggle--off';
  const automationMode = controlStatus?.automationMode ?? null;
  const automationToggleLabel = automationMode === 'auto' ? 'MANUAL' : 'AUTO';
  const automationToggleTitle =
    automationMode === 'auto'
      ? t('hardware.shelly.automationAutoTitle')
      : automationMode === 'manual'
        ? t('hardware.shelly.automationManualTitle')
        : automationMode === 'missing'
          ? t('hardware.shelly.automationMissingTitle')
          : t('hardware.shelly.automationUnknownTitle');
  const automationToggleClass =
    automationMode === 'auto'
      ? 'secondary-action automation-toggle automation-toggle--auto'
      : automationMode === 'manual'
        ? 'secondary-action automation-toggle automation-toggle--manual'
        : automationMode === 'missing'
          ? 'secondary-action automation-toggle automation-toggle--missing'
          : 'secondary-action automation-toggle automation-toggle--unknown';
  const telemetry = controlStatus?.telemetry;
  const clock = controlStatus?.clock;

  return (
    <article className="saved-list__item" aria-busy={isControlBusy || undefined}>
      <div className="shelly-card-header">
        <h3>{device.name}</h3>
        <button
          className="icon-action saved-list__settings-toggle"
          type="button"
          aria-label={t('hardware.shelly.settings')}
          title={t('hardware.shelly.settings')}
          onClick={() => onSettingsOpen(device)}
        >
          <IconSettings className="icon-action__svg" aria-hidden="true" />
        </button>
      </div>

      <div
        className="shelly-metrics-strip"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatPlugPower(telemetry?.powerW, t)}</span>
        <span>{formatPlugVoltage(telemetry?.voltageV, t)}</span>
        <span>{formatPlugEnergy(telemetry?.energyWh, t)}</span>
        <button
          type="button"
          title={t('hardware.shelly.clockStatusTitle')}
          onClick={() => onClockOpen(device)}
        >
          {formatShellyClock(clock, t)}
        </button>
      </div>

      <div
        className="control-action-row shelly-control-toolbar"
        aria-label={t('hardware.shelly.controlLabel', { name: device.name })}
      >
        <button
          className="icon-action"
          type="button"
          aria-label={t('common.refresh')}
          disabled={isControlBusy}
          title={t('hardware.shelly.refreshControlTitle')}
          onClick={() => onRefreshControl(device)}
        >
          <IconRefresh className="icon-action__svg" aria-hidden="true" />
        </button>
        <button
          className={automationToggleClass}
          type="button"
          disabled={isControlBusy}
          title={automationToggleTitle}
          onClick={() =>
            automationMode === 'auto'
              ? onAutomationManual(device)
              : onAutomationAuto(device)
          }
        >
          {automationToggleLabel}
        </button>
        <button
          className={relayToggleClass}
          type="button"
          disabled={isControlBusy}
          title={relayToggleTitle}
          onClick={() =>
            controlStatus?.relayOn ? onRelayOff(device) : onRelayOn(device)
          }
        >
          {relayToggleLabel}
        </button>
      </div>
    </article>
  );
};

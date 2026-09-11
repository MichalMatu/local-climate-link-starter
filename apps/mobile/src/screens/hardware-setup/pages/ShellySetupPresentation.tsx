import type { ShellyClockStatus, ShellyComponentState } from '@lcl/shelly-client';
import {
  IconBluetooth,
  IconInfoCircle,
  IconPencil,
  IconTrash
} from '@tabler/icons-react';
import { useId, useState } from 'react';
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

type ShellyAddFormProps = {
  flow: ShellySetupFlow;
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
  onNameChange: (device: ShellyDraftDevice, value: string) => void;
  onInfoOpen: (device: ShellyDraftDevice) => void;
  onBleScan: (device: ShellyDraftDevice) => void;
  onRemove: (device: ShellyDraftDevice) => void;
};

export const SavedShellyDeviceCard = ({
  device,
  controlState,
  onRelayOn,
  onRelayOff,
  onAutomationAuto,
  onAutomationManual,
  onNameChange,
  onInfoOpen,
  onBleScan,
  onRemove
}: SavedShellyDeviceCardProps) => {
  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const controlStatus = controlState?.status ?? null;
  const pendingAction = controlState?.pendingAction ?? null;
  const isControlBusy = pendingAction !== null;
  const automationMode = controlStatus?.automationMode ?? null;
  const manualControl = automationMode === 'manual';
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

      <div
        className="shelly-runtime-controls"
        aria-label={t('hardware.shelly.controlLabel', { name: device.name })}
      >
        <div className="shelly-mode-row">
          <div
            className="automation-control-group shelly-mode-control"
            role="group"
            aria-label={t('hardware.metrics.mode')}
          >
            <button
              className="automation-control-button"
              type="button"
              aria-pressed={automationMode === 'auto'}
              disabled={isControlBusy}
              onClick={() => {
                if (automationMode !== 'auto') onAutomationAuto(device);
              }}
            >
              AUTO
            </button>
            <button
              className="automation-control-button"
              type="button"
              aria-pressed={manualControl}
              disabled={isControlBusy}
              onClick={() => {
                if (!manualControl) onAutomationManual(device);
              }}
            >
              MANUAL
            </button>
          </div>
          <button
            className="icon-action"
            type="button"
            aria-label={t('hardware.shelly.settings')}
            title={t('hardware.shelly.settings')}
            onClick={() => onInfoOpen(device)}
          >
            <IconInfoCircle className="icon-action__svg" aria-hidden="true" />
          </button>
        </div>

        <div
          className="automation-relay-actions shelly-relay-actions"
          role="group"
          aria-label={t('hardware.metrics.relay')}
        >
          <button
            className="automation-relay-button"
            type="button"
            aria-pressed={controlStatus?.relayOn === true}
            disabled={isControlBusy || !manualControl}
            onClick={() => {
              if (controlStatus?.relayOn !== true) onRelayOn(device);
            }}
          >
            ON
          </button>
          <button
            className="automation-relay-button"
            type="button"
            aria-pressed={controlStatus?.relayOn === false}
            disabled={isControlBusy || !manualControl}
            onClick={() => {
              if (controlStatus?.relayOn === true) onRelayOff(device);
            }}
          >
            OFF
          </button>
        </div>
      </div>
    </article>
  );
};

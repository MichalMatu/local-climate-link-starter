import {
  DiagnosticRow,
  FeedbackPanel,
  InfoTooltip,
  Modal,
  ShellyCard,
  ToastViewport,
  type ToastMessage,
  type ToastTone
} from '@lcl/ui';
import type { ShellyClockStatus, ShellyComponentState } from '@lcl/shelly-client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { t } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import {
  SHELLY_SETUP_SCAN_CONCURRENCY,
  SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS,
  type ShellySetupScanResult
} from '../../../flows/hardware-setup/shellyRequests.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import { countIpv4RangeScanAddresses } from '../../../flows/hardware-setup/validation.js';
import { mutationError, shellyAddressLabel, type HardwarePageProps } from '../helpers.js';

type ShellyStatusModalSource = 'add' | 'recheck';
const SHELLY_AP_PANEL_URL = 'http://192.168.33.1/';

const formatNullableMetric = (
  value: number | null | undefined,
  suffix = '',
  fractionDigits = 1
): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(fractionDigits)}${suffix}`
    : 'brak';

const formatComponentState = (state: ShellyComponentState): string => {
  switch (state) {
    case 'enabled':
      return 'włączone';
    case 'disabled':
      return 'wyłączone';
    case 'missing':
      return 'brak w statusie';
  }
};

const shellyCompatibilityBadge = (status: HardwarePageProps['flow']['setupStatus']) => {
  if (!status) {
    return { label: 'nieznane', tone: 'inactive' as const };
  }
  if (status.status.matterEnabled) {
    return { label: 'blokada', tone: 'danger' as const };
  }
  if (status.status.scripts !== 'enabled' || status.status.bluetooth !== 'enabled') {
    return { label: 'sprawdź', tone: 'warning' as const };
  }
  return { label: 'zgodne', tone: 'ok' as const };
};

const formatPlugPower = (value: number | undefined): string =>
  value === undefined ? 'brak' : formatNullableMetric(value, ' W', 1);

const formatPlugVoltage = (value: number | undefined): string =>
  value === undefined ? 'brak' : formatNullableMetric(value, ' V', 0);

const formatPlugEnergy = (value: number | undefined): string => {
  if (value === undefined) {
    return 'brak';
  }
  return value >= 1000
    ? `${(value / 1000).toFixed(2)} kWh`
    : formatNullableMetric(value, ' Wh', 0);
};

const formatShellyClock = (clock: ShellyClockStatus | undefined): string =>
  clock?.localTime ?? 'brak';

const formatClockSyncState = (clock: ShellyClockStatus | undefined): string =>
  clock ? (clock.timeSynced ? 'zsynchronizowany' : 'brak synchronizacji') : 'brak danych';

const formatBleCandidateProfile = (
  profileId: BleDiscoveryCandidate['profileId']
): string => (profileId === 'tp357_custom_v1' ? 'TP357' : 'Xiaomi/PVVX BTHome v2');

const formatAddressCount = (count: number): string => {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const noun =
    count === 1
      ? 'adres'
      : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
        ? 'adresy'
        : 'adresów';

  return `${count} ${noun}`;
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

const formatClockUptime = (seconds: number | undefined): string => {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return 'brak';
  }

  const wholeSeconds = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  if (hours === 0) {
    return formatDuration(wholeSeconds);
  }

  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

const formatClockTimestamp = (unixTimeSec: number | undefined): string =>
  unixTimeSec === undefined || !Number.isFinite(unixTimeSec)
    ? 'brak'
    : new Date(unixTimeSec * 1000).toLocaleString('pl-PL', {
        dateStyle: 'short',
        timeStyle: 'short'
      });

const formatShellyScanEstimate = (startInput: string, endInput: string): string => {
  try {
    const addressCount = countIpv4RangeScanAddresses(startInput, endInput);
    const batches = Math.ceil(addressCount / SHELLY_SETUP_SCAN_CONCURRENCY);
    const seconds = Math.ceil((batches * SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS) / 1000);
    return `Wybrany zakres obejmuje ${formatAddressCount(addressCount)}. Skan sprawdza do ${SHELLY_SETUP_SCAN_CONCURRENCY} adresów naraz, limit ok. ${formatDuration(seconds)}.`;
  } catch {
    return 'Czas skanu pokażę po poprawnym zakresie.';
  }
};

type ShellyControlCardState = HardwarePageProps['flow']['shellyControlStates'][string];

type ShellyAddFormProps = {
  flow: HardwarePageProps['flow'];
  showValidationErrors: boolean;
};

const ShellyAddForm = ({ flow, showValidationErrors }: ShellyAddFormProps) => {
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
        <label htmlFor={nameInputId}>Nazwa gniazdka</label>
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
        <label htmlFor={urlInputId}>Adres IP Shelly</label>
        <input
          id={urlInputId}
          aria-describedby={urlError ? urlErrorId : undefined}
          aria-invalid={urlError ? true : undefined}
          type="url"
          inputMode="url"
          placeholder="http://192.168.x.x"
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
  onRename: (deviceId: string, name: string) => void;
  onRelayOn: (device: ShellyDraftDevice) => void;
  onRelayOff: (device: ShellyDraftDevice) => void;
  onAutomationAuto: (device: ShellyDraftDevice) => void;
  onAutomationManual: (device: ShellyDraftDevice) => void;
  onRefreshControl: (device: ShellyDraftDevice) => void;
  onClockOpen: (device: ShellyDraftDevice) => void;
  onSettingsOpen: (device: ShellyDraftDevice) => void;
};

type ActionIconName = 'refresh' | 'bluetooth' | 'trash' | 'settings';

const ActionIcon = ({ name }: { name: ActionIconName }) => {
  const content = (() => {
    switch (name) {
      case 'refresh':
        return (
          <>
            <path d="M18.5 9.5h-4v-4" />
            <path d="M18.1 9.5A6.8 6.8 0 1 0 19 13" />
          </>
        );
      case 'bluetooth':
        return <path d="m7 7 10 10-5 4V3l5 4L7 17" />;
      case 'trash':
        return (
          <>
            <path d="M7 7h10" />
            <path d="M10 7V5.5h4V7" />
            <path d="m9 9.5.5 8.5A1.5 1.5 0 0 0 11 19.5h2A1.5 1.5 0 0 0 14.5 18l.5-8.5" />
            <path d="M11 11.5v5" />
            <path d="M13 11.5v5" />
          </>
        );
      case 'settings':
        return (
          <>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6" />
          </>
        );
    }
  })();

  return (
    <svg
      aria-hidden="true"
      className="icon-action__svg"
      focusable="false"
      viewBox="0 0 24 24"
    >
      {content}
    </svg>
  );
};

const SavedShellyDeviceCard = ({
  device,
  controlState,
  onRename,
  onRelayOn,
  onRelayOff,
  onAutomationAuto,
  onAutomationManual,
  onRefreshControl,
  onClockOpen,
  onSettingsOpen
}: SavedShellyDeviceCardProps) => {
  const controlStatus = controlState?.status ?? null;
  const pendingAction = controlState?.pendingAction ?? null;
  const isControlBusy = pendingAction !== null;
  const relayToggleLabel = controlStatus?.relayOn ? 'OFF' : 'ON';
  const relayToggleTitle =
    controlStatus === null
      ? 'Stan nieznany. Kliknij ON, żeby włączyć przekaźnik.'
      : controlStatus.relayOn
        ? 'Przekaźnik jest ON. Kliknij OFF, żeby wyłączyć.'
        : 'Przekaźnik jest OFF. Kliknij ON, żeby włączyć.';
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
      ? 'Automatyzacja działa. Kliknij MANUAL, żeby zatrzymać.'
      : automationMode === 'manual'
        ? 'Automatyzacja jest zatrzymana. Kliknij AUTO, żeby uruchomić.'
        : automationMode === 'missing'
          ? 'Brak zapisanej reguły. Kliknij AUTO, żeby zobaczyć wymagany krok.'
          : 'Stan automatyzacji nieznany. Kliknij AUTO, żeby sprawdzić.';
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
  const nameInputId = useId();

  return (
    <article className="saved-list__item" aria-busy={isControlBusy || undefined}>
      <div className="saved-list__card-header">
        <div className="field saved-list__name-field">
          <label htmlFor={nameInputId}>Nazwa</label>
          <div className="saved-list__name-input-row">
            <input
              id={nameInputId}
              type="text"
              value={device.name}
              onChange={(event) => onRename(device.id, event.currentTarget.value)}
            />
            <button
              className="icon-action saved-list__settings-toggle"
              type="button"
              aria-label="Ustawienia gniazdka"
              title="Ustawienia gniazdka"
              onClick={() => onSettingsOpen(device)}
            >
              <ActionIcon name="settings" />
            </button>
          </div>
        </div>
      </div>

      <div
        className="saved-list__row shelly-metrics-row"
        aria-label="Parametry gniazdka Shelly"
      >
        <div className="saved-list__field">
          <span>Moc</span>
          <strong>{formatPlugPower(telemetry?.powerW)}</strong>
        </div>
        <div className="saved-list__field">
          <span>Napięcie</span>
          <strong>{formatPlugVoltage(telemetry?.voltageV)}</strong>
        </div>
        <div className="saved-list__field">
          <span>Energia</span>
          <strong>{formatPlugEnergy(telemetry?.energyWh)}</strong>
        </div>
        <div className="saved-list__field">
          <span>Czas</span>
          <button
            className="saved-list__field-button"
            type="button"
            title="Pokaż status czasu Shelly"
            onClick={() => onClockOpen(device)}
          >
            {formatShellyClock(clock)}
          </button>
        </div>
      </div>

      <div
        className="control-action-row shelly-control-toolbar"
        aria-label={`Sterowanie ${device.name}`}
      >
        <button
          className="icon-action"
          type="button"
          aria-label="Odśwież"
          disabled={isControlBusy}
          title="Odśwież stan gniazdka"
          onClick={() => onRefreshControl(device)}
        >
          <ActionIcon name="refresh" />
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

export const ShellySetupPage = ({ flow }: HardwarePageProps) => {
  const shellyAddress = shellyAddressLabel(flow);
  const isShellyScanActive = flow.shellyScanMutation.isPending && !flow.shellyScanStopped;
  const isAnyShellyCheckPending =
    flow.checkShellyMutation.isPending ||
    flow.recheckShellyMutation.isPending ||
    isShellyScanActive;
  const [isAddShellyModalOpen, setIsAddShellyModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isBleScanModalOpen, setIsBleScanModalOpen] = useState(false);
  const [bleScanShelly, setBleScanShelly] = useState<ShellyDraftDevice | null>(null);
  const [settingsShellyId, setSettingsShellyId] = useState<string | null>(null);
  const [clockShellyId, setClockShellyId] = useState<string | null>(null);
  const [shellyDevicePendingRemoval, setShellyDevicePendingRemoval] =
    useState<ShellyDraftDevice | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [statusModalAddress, setStatusModalAddress] = useState<string | null>(null);
  const [statusModalSource, setStatusModalSource] =
    useState<ShellyStatusModalSource>('add');
  const [statusModalReturnSettingsId, setStatusModalReturnSettingsId] = useState<
    string | null
  >(null);
  const [didSubmitShellyAdd, setDidSubmitShellyAdd] = useState(false);
  const [didSubmitShellyScan, setDidSubmitShellyScan] = useState(false);
  const scanRangeErrorId = useId();
  const activeShellyMutation =
    statusModalSource === 'recheck'
      ? flow.recheckShellyMutation
      : flow.checkShellyMutation;
  const isCheckingShelly = activeShellyMutation.isPending;
  const shellyCheckError = activeShellyMutation.isError
    ? activeShellyMutation.error
    : null;
  const modalTitle = isCheckingShelly
    ? 'Sprawdzam Shelly'
    : shellyCheckError
      ? 'Nie udało się sprawdzić Shelly'
      : 'Shelly sprawdzone';
  const statusModalShellyAddress = statusModalAddress ?? shellyAddress;
  const statusModalShellyHref = /^https?:\/\//.test(statusModalShellyAddress)
    ? statusModalShellyAddress
    : undefined;
  const shellyScanEstimate = formatShellyScanEstimate(
    flow.shellyScanStartInput,
    flow.shellyScanEndInput
  );
  const scanResults = flow.shellyScanMutation.data?.results ?? [];
  const shellyControlStates = flow.shellyControlStates;
  const shellyDevices = flow.shellyDevices;
  const refreshShellyControl = flow.refreshShellyControl;
  const acknowledgeShellyControlFeedback = flow.acknowledgeShellyControlFeedback;
  const isScanStopped =
    flow.shellyScanStopped || flow.shellyScanMutation.data?.stopped === true;
  const shouldShowEmptyScanResult =
    flow.shellyScanMutation.isSuccess && !isScanStopped && scanResults.length === 0;
  const shellyScanRangeError = (() => {
    try {
      countIpv4RangeScanAddresses(flow.shellyScanStartInput, flow.shellyScanEndInput);
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : t('hardware.shelly.scanRangeFailed');
    }
  })();
  const showShellyScanRangeError = didSubmitShellyScan && shellyScanRangeError !== null;
  const bleDiscoveryCandidates = flow.bleDiscoverySnapshot?.candidates ?? [];
  const didBleDiscoveryStartFail =
    flow.bleDiscoverySnapshot?.lastReason === 'ble-scan-start-failed';
  const compatibilityBadge = shellyCompatibilityBadge(flow.setupStatus);
  const isBleDiscoveryBusy =
    flow.startBleDiscoveryMutation.isPending ||
    flow.refreshBleDiscoveryMutation.isPending ||
    flow.restartBleDiscoveryMutation.isPending ||
    flow.stopBleDiscoveryMutation.isPending;
  const clockShelly =
    clockShellyId === null
      ? null
      : (shellyDevices.find((device) => device.id === clockShellyId) ?? null);
  const settingsShelly =
    settingsShellyId === null
      ? null
      : (shellyDevices.find((device) => device.id === settingsShellyId) ?? null);
  const clockControlState = clockShelly ? shellyControlStates[clockShelly.id] : undefined;
  const settingsControlState = settingsShelly
    ? shellyControlStates[settingsShelly.id]
    : undefined;
  const isSettingsControlBusy = settingsControlState?.pendingAction != null;
  const clockStatus = clockControlState?.status?.clock;
  const isClockRefreshPending = clockControlState?.pendingAction === 'status';
  const shouldShowBleRestart = Boolean(
    flow.bleDiscoverySession && flow.bleDiscoverySnapshot?.running === false
  );
  const pollBleDiscoveryRef = useRef<() => void>(() => undefined);
  const toastIdRef = useRef(0);
  const shownBleStopErrorRef = useRef<string | null>(null);
  const shownControlFeedbackRef = useRef<Record<string, string>>({});
  const autoRefreshShellyIdsRef = useRef<Set<string>>(new Set());
  const [returnToAddAfterScan, setReturnToAddAfterScan] = useState(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = `shelly-toast-${toastIdRef.current}`;
    const toast: ToastMessage =
      detail === undefined ? { id, tone, title } : { id, tone, title, detail };
    setToasts((current) => [...current.slice(-2), toast]);
  }, []);

  const dismissShellyScanProgressToast = useCallback(() => {
    const scanningTitle = t('hardware.shelly.scanningIpRange');
    setToasts((current) => current.filter((toast) => toast.title !== scanningTitle));
  }, []);

  const dismissShellyScanToasts = useCallback(() => {
    const scanTitles = new Set([
      t('hardware.shelly.scanningIpRange'),
      t('hardware.shelly.scanStopped')
    ]);
    setToasts((current) => current.filter((toast) => !scanTitles.has(toast.title)));
  }, []);

  useEffect(() => {
    const savedIds = new Set(shellyDevices.map((device) => device.id));
    autoRefreshShellyIdsRef.current.forEach((deviceId) => {
      if (!savedIds.has(deviceId)) {
        autoRefreshShellyIdsRef.current.delete(deviceId);
      }
    });

    shellyDevices.forEach((device) => {
      const controlState = shellyControlStates[device.id];
      if (
        controlState?.status ||
        controlState?.pendingAction ||
        autoRefreshShellyIdsRef.current.has(device.id)
      ) {
        return;
      }

      autoRefreshShellyIdsRef.current.add(device.id);
      refreshShellyControl(device);
    });
  }, [refreshShellyControl, shellyControlStates, shellyDevices]);

  useEffect(() => {
    Object.entries(shellyControlStates).forEach(([deviceId, controlState]) => {
      const message = controlState.error ?? controlState.message;
      if (!message || controlState.updatedAtMs === null) {
        return;
      }

      const feedbackKey = `${controlState.updatedAtMs}:${message}`;
      if (shownControlFeedbackRef.current[deviceId] === feedbackKey) {
        return;
      }

      shownControlFeedbackRef.current[deviceId] = feedbackKey;
      pushToast(controlState.error ? 'warning' : 'ok', message);
      acknowledgeShellyControlFeedback(deviceId, controlState.updatedAtMs, message);
    });
  }, [acknowledgeShellyControlFeedback, pushToast, shellyControlStates]);

  useEffect(() => {
    if (!flow.stopBleDiscoveryMutation.isError) {
      return;
    }

    const message = mutationError(flow.stopBleDiscoveryMutation.error);
    if (shownBleStopErrorRef.current === message) {
      return;
    }

    shownBleStopErrorRef.current = message;
    pushToast('warning', t('hardware.shelly.bleScannerCloseFailedTitle'), message);
    flow.stopBleDiscoveryMutation.reset();
  }, [flow.stopBleDiscoveryMutation, pushToast]);

  useEffect(() => {
    if (!flow.shellyScanMutation.isError) {
      return;
    }
    dismissShellyScanProgressToast();
    pushToast(
      'warning',
      t('hardware.shelly.scanNetworkFailedTitle'),
      mutationError(flow.shellyScanMutation.error)
    );
    flow.shellyScanMutation.reset();
  }, [dismissShellyScanProgressToast, flow.shellyScanMutation, pushToast]);

  useEffect(() => {
    if (!flow.shellyScanMutation.isSuccess) {
      return;
    }
    dismissShellyScanProgressToast();
  }, [dismissShellyScanProgressToast, flow.shellyScanMutation.isSuccess]);

  useEffect(() => {
    if (!flow.startBleDiscoveryMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.shelly.bleScannerStartFailedTitle'),
      mutationError(flow.startBleDiscoveryMutation.error)
    );
    flow.startBleDiscoveryMutation.reset();
  }, [flow.startBleDiscoveryMutation, pushToast]);

  pollBleDiscoveryRef.current = () => {
    if (
      !flow.bleDiscoverySession ||
      flow.bleDiscoverySnapshot?.running === false ||
      flow.startBleDiscoveryMutation.isPending ||
      flow.refreshBleDiscoveryMutation.isPending ||
      flow.restartBleDiscoveryMutation.isPending ||
      flow.refreshBleDiscoveryMutation.isError ||
      flow.restartBleDiscoveryMutation.isError ||
      flow.stopBleDiscoveryMutation.isPending
    ) {
      return;
    }
    flow.refreshBleDiscovery();
  };

  useEffect(() => {
    if (!isBleScanModalOpen || !flow.bleDiscoverySession) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      pollBleDiscoveryRef.current();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [flow.bleDiscoverySession, isBleScanModalOpen]);

  const checkShelly = () => {
    setDidSubmitShellyAdd(true);
    flow.recheckShellyMutation.reset();
    flow.checkShellyMutation.reset();
    if (!flow.shellyInputState.ok) {
      return;
    }
    flow.checkShellyMutation.mutate(undefined, {
      onSuccess: () => {
        setDidSubmitShellyAdd(false);
        setIsAddShellyModalOpen(false);
        pushToast('ok', t('hardware.shelly.added'));
      },
      onError: () => {
        pushToast(
          'warning',
          t('hardware.shelly.checkFailedTitle'),
          t('hardware.shelly.checkFailedDetail')
        );
      }
    });
  };

  const closeStatusModal = () => {
    if (isCheckingShelly) {
      return;
    }
    flow.checkShellyMutation.reset();
    flow.recheckShellyMutation.reset();
    setIsStatusModalOpen(false);
    if (statusModalReturnSettingsId) {
      const canReturnToSettings = shellyDevices.some(
        (device) => device.id === statusModalReturnSettingsId
      );
      if (canReturnToSettings) {
        setSettingsShellyId(statusModalReturnSettingsId);
      }
      setStatusModalReturnSettingsId(null);
    }
  };

  const openAddShellyModal = () => {
    flow.checkShellyMutation.reset();
    setDidSubmitShellyAdd(false);
    setIsAddShellyModalOpen(true);
  };

  const closeAddShellyModal = () => {
    flow.checkShellyMutation.reset();
    setDidSubmitShellyAdd(false);
    setIsAddShellyModalOpen(false);
  };

  const openScanModalFromAdd = () => {
    flow.resetShellyScan();
    setDidSubmitShellyScan(false);
    setReturnToAddAfterScan(true);
    setIsAddShellyModalOpen(false);
    setIsScanModalOpen(true);
  };

  const closeScanModal = (options: { returnToAdd?: boolean } = {}) => {
    const shouldReturnToAdd = options.returnToAdd ?? returnToAddAfterScan;
    flow.resetShellyScan();
    dismissShellyScanToasts();
    setDidSubmitShellyScan(false);
    setIsScanModalOpen(false);
    if (shouldReturnToAdd) {
      setIsAddShellyModalOpen(true);
      setReturnToAddAfterScan(false);
      return;
    }
    setReturnToAddAfterScan(false);
  };

  const startShellyScan = () => {
    setDidSubmitShellyScan(true);
    if (shellyScanRangeError) {
      return;
    }
    dismissShellyScanToasts();
    pushToast('ok', t('hardware.shelly.scanningIpRange'));
    flow.startShellyScan();
  };

  const stopShellyScan = () => {
    if (flow.stopShellyScan()) {
      dismissShellyScanProgressToast();
      pushToast('ok', t('hardware.shelly.scanStopped'));
    }
  };

  const addScannedShellyDevice = (result: ShellySetupScanResult) => {
    const name = flow.shellyNameInput.trim() || result.deviceInfo.model;
    flow.upsertShellyDevice({
      id: result.baseUrl,
      name,
      baseUrl: result.baseUrl,
      scriptIdInput: '1'
    });
    flow.checkShellyMutation.reset();
    closeScanModal({ returnToAdd: false });
    pushToast('ok', t('hardware.shelly.added'));
  };

  const openBleScanModal = (device: ShellyDraftDevice) => {
    flow.resetBleDiscovery();
    shownBleStopErrorRef.current = null;
    setBleScanShelly(device);
    setIsBleScanModalOpen(true);
    pushToast(
      'ok',
      t('hardware.shelly.scanningBle'),
      t('hardware.shelly.scanningBleSafeOff')
    );
    flow.startBleDiscovery(device);
  };

  const closeBleScanModal = () => {
    if (isBleDiscoveryBusy) {
      return;
    }
    flow.stopBleDiscovery();
    setIsBleScanModalOpen(false);
  };

  const restartBleDiscovery = () => {
    pushToast('ok', t('hardware.shelly.scanningBle'));
    flow.restartBleDiscovery();
  };

  const handleDiscoveredSensor = (candidate: BleDiscoveryCandidate) => {
    flow.addDiscoveredSensor(candidate);
    pushToast('ok', 'Zapisano termometr.');
  };

  const recheckSavedShelly = (
    device: ShellyDraftDevice,
    options: { returnToSettings?: boolean } = {}
  ) => {
    setStatusModalAddress(device.baseUrl);
    setStatusModalSource('recheck');
    setStatusModalReturnSettingsId(options.returnToSettings ? device.id : null);
    setIsStatusModalOpen(true);
    flow.checkShellyMutation.reset();
    flow.recheckShellyMutation.mutate(device, {
      onSuccess: () => setIsStatusModalOpen(true)
    });
  };

  const removeSavedShelly = (device: ShellyDraftDevice) => {
    setShellyDevicePendingRemoval(device);
  };

  const openSettingsModal = (device: ShellyDraftDevice) => {
    setSettingsShellyId(device.id);
  };

  const closeSettingsModal = () => {
    setSettingsShellyId(null);
  };

  const openClockModal = (device: ShellyDraftDevice) => {
    setClockShellyId(device.id);
  };

  const closeClockModal = () => {
    setClockShellyId(null);
  };

  const confirmRemoveSavedShelly = () => {
    if (!shellyDevicePendingRemoval) {
      return;
    }

    flow.removeShellyDevice(shellyDevicePendingRemoval.id);
    setShellyDevicePendingRemoval(null);
    pushToast('ok', t('hardware.shelly.removed'));
  };

  return (
    <section className="demo-panel" aria-label="Gniazdka Shelly">
      <div className="action-row add-device-action-row">
        <button
          className="secondary-action"
          type="button"
          aria-label={t('hardware.shelly.add')}
          title="Dodaj nowe gniazdko Shelly"
          onClick={openAddShellyModal}
        >
          <span aria-hidden="true">+ </span>
          {t('hardware.shelly.add')}
        </button>
      </div>

      <Modal
        closeLabel="Zamknij"
        closeOnBackdrop={false}
        closeOnEscape={!flow.checkShellyMutation.isPending}
        open={isAddShellyModalOpen}
        title={t('hardware.shelly.add')}
        actions={
          <>
            <button
              className="secondary-action"
              type="button"
              disabled={isAnyShellyCheckPending}
              title="Szukaj gniazdek Shelly w lokalnej sieci"
              onClick={openScanModalFromAdd}
            >
              Skanuj sieć
            </button>
            <button
              className="secondary-action"
              type="button"
              aria-busy={flow.checkShellyMutation.isPending || undefined}
              disabled={isAnyShellyCheckPending}
              title="Sprawdź adres i zapisz gniazdko w aplikacji"
              onClick={checkShelly}
            >
              {flow.checkShellyMutation.isPending ? 'Sprawdzam' : 'Sprawdź i dodaj'}
            </button>
          </>
        }
        onClose={closeAddShellyModal}
      >
        <ShellyAddForm flow={flow} showValidationErrors={didSubmitShellyAdd} />
      </Modal>

      <Modal
        closeLabel="Zamknij"
        closeOnBackdrop={false}
        closeOnEscape={!isShellyScanActive}
        headerActions={
          <InfoTooltip label="Informacja o skanowaniu Shelly" title="Skanowanie Shelly">
            Jeśli łączysz się bezpośrednio z Wi-Fi Shelly, panel zwykle działa pod{' '}
            {SHELLY_AP_PANEL_URL}.
            <br />
            Skan pomija już dodane gniazdka i zatrzymuje się po pierwszym nowym. Jeśli
            chcesz szukać dalej, popraw zakres ręcznie i uruchom skan ponownie.
            <br />
            {shellyScanEstimate}
          </InfoTooltip>
        }
        open={isScanModalOpen}
        title="Skanuj sieć Shelly"
        actions={
          <>
            <button
              className="secondary-action"
              type="button"
              aria-busy={isShellyScanActive || undefined}
              disabled={isShellyScanActive}
              title="Skanuj wybrany zakres adresów IP"
              onClick={startShellyScan}
            >
              {isShellyScanActive ? 'Skanuję' : 'Rozpocznij skan'}
            </button>
            {isShellyScanActive && (
              <button
                className="secondary-action"
                type="button"
                title="Zatrzymaj trwający skan sieci"
                onClick={stopShellyScan}
              >
                Stop skanu
              </button>
            )}
          </>
        }
        onClose={closeScanModal}
      >
        <div className="field-row">
          <label className={showShellyScanRangeError ? 'field field--invalid' : 'field'}>
            Od
            <input
              aria-describedby={showShellyScanRangeError ? scanRangeErrorId : undefined}
              aria-invalid={showShellyScanRangeError}
              type="text"
              inputMode="numeric"
              placeholder="192.168.0.1"
              value={flow.shellyScanStartInput}
              onChange={(event) =>
                flow.setShellyScanStartInput(event.currentTarget.value)
              }
            />
          </label>
          <label className={showShellyScanRangeError ? 'field field--invalid' : 'field'}>
            Do
            <input
              aria-describedby={showShellyScanRangeError ? scanRangeErrorId : undefined}
              aria-invalid={showShellyScanRangeError}
              type="text"
              inputMode="numeric"
              placeholder="192.168.0.99"
              value={flow.shellyScanEndInput}
              onChange={(event) => flow.setShellyScanEndInput(event.currentTarget.value)}
            />
            {showShellyScanRangeError && (
              <span className="field__error" id={scanRangeErrorId}>
                {shellyScanRangeError}
              </span>
            )}
          </label>
        </div>

        {shouldShowEmptyScanResult && (
          <p>
            Nie znalazłem gniazdka Shelly w tym zakresie. Sprawdź IP w routerze albo w
            ustawieniach Shelly.
          </p>
        )}
        {scanResults.length > 0 && (
          <div className="saved-list" aria-label="Znalezione gniazdka Shelly">
            {scanResults.map((result) => (
              <article key={result.baseUrl} className="saved-list__item">
                <div className="saved-list__row shelly-scan-result__row">
                  <div className="saved-list__field">
                    <span>Adres</span>
                    <strong>{result.baseUrl}</strong>
                  </div>
                  <div className="saved-list__field">
                    <span>Model</span>
                    <strong>
                      {result.deviceInfo.model}, gen {result.deviceInfo.gen}
                    </strong>
                  </div>
                  <button
                    aria-label={`Dodaj gniazdko ${result.baseUrl}`}
                    className="secondary-action shelly-scan-result__add"
                    title="Dodaj to sprawdzone gniazdko do aplikacji"
                    type="button"
                    onClick={() => addScannedShellyDevice(result)}
                  >
                    Dodaj
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        closeLabel="Anuluj"
        description={shellyDevicePendingRemoval?.name ?? ''}
        open={shellyDevicePendingRemoval !== null}
        title="Usunąć gniazdko?"
        actions={
          <button
            className="secondary-action secondary-action--danger"
            type="button"
            title="Usuń gniazdko tylko z aplikacji"
            onClick={confirmRemoveSavedShelly}
          >
            Usuń
          </button>
        }
        onClose={() => setShellyDevicePendingRemoval(null)}
      >
        <p>
          Gniazdko zostanie usunięte tylko z aplikacji. Skrypt zapisany w Shelly
          pozostanie bez zmian.
        </p>
      </Modal>

      <Modal
        closeLabel="Zamknij"
        description={settingsShelly?.name ?? ''}
        open={settingsShelly !== null}
        size="diagnostic"
        title="Ustawienia gniazdka"
        actions={
          <>
            <button
              className="secondary-action"
              type="button"
              disabled={settingsShelly === null || isAnyShellyCheckPending}
              title="Sprawdź ponownie stan i kompatybilność gniazdka"
              onClick={() => {
                if (settingsShelly) {
                  closeSettingsModal();
                  recheckSavedShelly(settingsShelly, { returnToSettings: true });
                }
              }}
            >
              Sprawdź
            </button>
            <button
              className="secondary-action"
              type="button"
              disabled={
                settingsShelly === null ||
                isAnyShellyCheckPending ||
                isBleDiscoveryBusy ||
                isSettingsControlBusy
              }
              title="Skanuj termometry BLE przez to gniazdko"
              onClick={() => {
                if (settingsShelly) {
                  closeSettingsModal();
                  openBleScanModal(settingsShelly);
                }
              }}
            >
              <ActionIcon name="bluetooth" />
              Skanuj BLE
            </button>
            <button
              className="secondary-action secondary-action--danger"
              type="button"
              disabled={settingsShelly === null}
              title="Usuń gniazdko tylko z aplikacji"
              onClick={() => {
                if (settingsShelly) {
                  closeSettingsModal();
                  removeSavedShelly(settingsShelly);
                }
              }}
            >
              <ActionIcon name="trash" />
              Usuń
            </button>
          </>
        }
        onClose={closeSettingsModal}
      >
        {settingsShelly && (
          <div className="status-stack">
            <DiagnosticRow
              href={settingsShelly.baseUrl}
              label="Adres IP"
              linkLabel={`Otwórz panel Shelly: ${settingsShelly.baseUrl}`}
              value={settingsShelly.baseUrl}
            />
          </div>
        )}
      </Modal>

      <Modal
        closeLabel="Zamknij"
        description={clockShelly?.name ?? ''}
        open={clockShelly !== null}
        size="diagnostic"
        title="Czas Shelly"
        actions={
          <button
            className="secondary-action"
            type="button"
            aria-busy={isClockRefreshPending || undefined}
            disabled={clockShelly === null || isClockRefreshPending}
            title="Odśwież czas i status gniazdka"
            onClick={() => {
              if (clockShelly) {
                flow.refreshShellyControl(clockShelly);
              }
            }}
          >
            {isClockRefreshPending ? 'Odświeżam' : 'Odśwież'}
          </button>
        }
        onClose={closeClockModal}
      >
        <div className="status-stack">
          <DiagnosticRow label="Czas" value={formatShellyClock(clockStatus)} />
          <DiagnosticRow
            label="Zegar"
            value={formatClockSyncState(clockStatus)}
            tone={clockStatus?.timeSynced ? 'normal' : 'warning'}
          />
          <DiagnosticRow
            label="Uptime"
            value={formatClockUptime(clockStatus?.uptimeSec)}
          />
          <DiagnosticRow
            label="Ostatnia synchronizacja"
            value={formatClockTimestamp(clockStatus?.lastSyncUnixTimeSec)}
          />
        </div>
      </Modal>

      <Modal
        closeLabel="Zamknij"
        closeOnBackdrop={false}
        closeOnEscape={!isCheckingShelly}
        open={isStatusModalOpen}
        title={modalTitle}
        onClose={closeStatusModal}
      >
        {isCheckingShelly && <p>Łączę się przez lokalne RPC.</p>}
        {shellyCheckError && (
          <FeedbackPanel tone="warning" title={mutationError(shellyCheckError)}>
            IP gniazdka możesz sprawdzić w routerze albo w ustawieniach Shelly.
          </FeedbackPanel>
        )}
        {!isCheckingShelly && !shellyCheckError && flow.setupStatus && (
          <>
            <div className="status-stack" aria-label="Wynik sprawdzania Shelly">
              {statusModalShellyHref ? (
                <DiagnosticRow
                  href={statusModalShellyHref}
                  label="Adres gniazdka"
                  linkLabel={`Otwórz panel Shelly: ${statusModalShellyAddress}`}
                  value={statusModalShellyAddress}
                />
              ) : (
                <DiagnosticRow label="Adres gniazdka" value={statusModalShellyAddress} />
              )}
              <DiagnosticRow
                label="Przekaźnik"
                value={flow.setupStatus.status.relayOn ? 'ON' : 'OFF'}
                tone={flow.setupStatus.status.relayOn ? 'warning' : 'normal'}
              />
            </div>
            <ShellyCard
              name="Shelly Plug S Gen3"
              model={`${flow.setupStatus.deviceInfo.model}, gen ${flow.setupStatus.deviceInfo.gen}`}
              badgeLabel={compatibilityBadge.label}
              badgeTone={compatibilityBadge.tone}
              rows={[
                {
                  label: 'Scripts',
                  value: formatComponentState(flow.setupStatus.status.scripts)
                },
                {
                  label: 'Bluetooth',
                  value: formatComponentState(flow.setupStatus.status.bluetooth)
                },
                {
                  label: 'Matter',
                  value: flow.setupStatus.status.matterEnabled ? 'włączony' : 'wyłączony'
                }
              ]}
            />
          </>
        )}
      </Modal>

      <Modal
        closeLabel="Zamknij"
        closeOnBackdrop={false}
        closeOnEscape={!isBleDiscoveryBusy}
        description={bleScanShelly ? bleScanShelly.name : ''}
        open={isBleScanModalOpen}
        size="diagnostic"
        title="Skanuj termometry BLE"
        headerActions={
          <InfoTooltip
            label="Informacja o skanowaniu BLE"
            title="Na czas skanowania zatrzymuję automatyzację"
          >
            Shelly uruchomi osobny skrypt skanera BLE. Przekaźnik zostanie ustawiony na
            OFF, a po zakończeniu skanu wznowię automatyzację, jeśli była uruchomiona.
          </InfoTooltip>
        }
        actions={
          shouldShowBleRestart ? (
            <button
              className="secondary-action"
              type="button"
              aria-busy={flow.restartBleDiscoveryMutation.isPending}
              disabled={isBleDiscoveryBusy}
              title="Ponownie uruchom skaner BLE na tym Shelly"
              onClick={restartBleDiscovery}
            >
              Skanuj ponownie
            </button>
          ) : null
        }
        onClose={closeBleScanModal}
      >
        {didBleDiscoveryStartFail && (
          <FeedbackPanel
            tone="warning"
            title="Nie udało się uruchomić skanera BLE na Shelly."
          >
            Kliknij Skanuj ponownie. Jeśli błąd wróci, sprawdź Bluetooth w Shelly albo
            zrestartuj gniazdko.
          </FeedbackPanel>
        )}
        {bleDiscoveryCandidates.length > 0 && (
          <div className="ble-candidate-list" aria-label="Znalezione termometry BLE">
            {bleDiscoveryCandidates.map((candidate) => {
              const hasTemperature = typeof candidate.temperatureC === 'number';
              const hasHumidity = typeof candidate.humidityPct === 'number';
              const isSavedSensor = flow.sensorDevices.some(
                (device) =>
                  device.runtimeAddress.toUpperCase() ===
                  candidate.runtimeAddress.toUpperCase()
              );
              return (
                <article key={candidate.runtimeAddress} className="ble-candidate-item">
                  <div className="ble-candidate-main">
                    <strong>{candidate.runtimeAddress}</strong>
                    <span>{formatBleCandidateProfile(candidate.profileId)}</span>
                  </div>
                  <dl className="ble-candidate-metrics">
                    <div>
                      <dt>RSSI</dt>
                      <dd>{formatNullableMetric(candidate.rssi, ' dBm', 0)}</dd>
                    </div>
                    {hasTemperature && (
                      <div>
                        <dt>Temp.</dt>
                        <dd>{formatNullableMetric(candidate.temperatureC, '°C')}</dd>
                      </div>
                    )}
                    {hasHumidity && (
                      <div>
                        <dt>Wilg.</dt>
                        <dd>{formatNullableMetric(candidate.humidityPct, '%')}</dd>
                      </div>
                    )}
                  </dl>
                  <button
                    className="secondary-action ble-candidate-action"
                    type="button"
                    disabled={isSavedSensor}
                    title={
                      isSavedSensor
                        ? 'Ten termometr jest już zapisany w aplikacji'
                        : 'Zapisz ten termometr w aplikacji'
                    }
                    onClick={() => handleDiscoveredSensor(candidate)}
                  >
                    {isSavedSensor ? 'Już zapisany' : 'Zapisz termometr'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </Modal>

      <div className="saved-list" aria-label="Dodane gniazdka">
        {flow.shellyDevices.length === 0 && <p>Brak dodanych gniazdek.</p>}
        {flow.shellyDevices.map((device) => (
          <SavedShellyDeviceCard
            key={device.id}
            controlState={flow.shellyControlStates[device.id]}
            device={device}
            onAutomationAuto={flow.setAutomationAuto}
            onAutomationManual={flow.setAutomationManual}
            onClockOpen={openClockModal}
            onRefreshControl={flow.refreshShellyControl}
            onRelayOff={flow.turnRelayOff}
            onRelayOn={flow.turnRelayOn}
            onRename={flow.setShellyDeviceName}
            onSettingsOpen={openSettingsModal}
          />
        ))}
      </div>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </section>
  );
};

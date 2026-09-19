import { App as CapacitorApp } from '@capacitor/app';
import { calculateVpdKpa } from '@lcl/automation-core';
import { Capacitor } from '@capacitor/core';
import {
  IconAlertTriangle,
  IconDotsVertical,
  IconPencil,
  IconPlug,
  IconPlus
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import type { AppNavigationKind } from '../components/AppBottomNavigation.js';
import type {
  ClimateInstalledAutomation,
  InstalledAutomation
} from '../flows/installations/model.js';
import {
  formatInstallationMetric,
  formatInstallationVpd,
  installationHealthLabel,
  installationThresholdSummary
} from '../flows/installations/presentation.js';
import { installedAutomationHealth } from '../flows/installations/runtimeDiagnostics.js';
import { installedAutomationScriptMatch } from '../flows/installations/runtimeControl.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import {
  useHardwareSetupDraftStore,
  type ShellyDraftDevice
} from '../flows/hardware-setup/setupDraftStore.js';
import {
  useInstalledAutomationActions,
  useInstalledAutomationControl,
  useInstalledAutomationDiagnostics
} from '../flows/installations/useInstalledAutomationRuntime.js';
import { usePlainShellyRuntime } from '../flows/hardware-setup/usePlainShellyRuntime.js';
import { useHardwareSetupFlow } from '../flows/hardware-setup/useHardwareSetupFlow.js';
import { TimeAutomationCard } from './TimeAutomationCard.js';
import { SensorSetupPage } from './hardware-setup/pages/SensorSetupPage.js';
import { ShellySetupPage } from './hardware-setup/pages/ShellySetupPage.js';
import './AutomationDashboardScreen.css';

const isDashboardRuntimeQuery = (query: { queryKey: readonly unknown[] }) => {
  const root = query.queryKey[0];
  return (
    root === 'installed-automation-diagnostics' ||
    root === 'installed-automation-control' ||
    root === 'time-automation-runtime' ||
    root === 'plain-shelly-runtime'
  );
};

type AutomationCardProps = {
  installation: InstalledAutomation;
  onOpen(installationId: string): void;
};

const formatPlugEnergy = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kWh` : `${value.toFixed(0)} Wh`;
};

const CLIMATE_READING_PULSE_MS = 650;
const DASHBOARD_DIAGNOSTICS_REFRESH_MS = 5_000;

const ClimateAutomationCard = ({
  installation,
  onOpen
}: {
  installation: ClimateInstalledAutomation;
  onOpen(installationId: string): void;
}) => {
  const { t } = useTranslation();
  const query = useInstalledAutomationDiagnostics(installation, {
    refetchInterval: DASHBOARD_DIAGNOSTICS_REFRESH_MS
  });
  const control = useInstalledAutomationControl(installation);
  const action = useInstalledAutomationActions(installation);

  const snapshot = query.data;
  const lastSeenUptimeMs = snapshot?.diagnostics.lastSeenUptimeMs ?? null;
  const currentUptimeMs =
    snapshot?.time.uptimeSec != null && Number.isFinite(snapshot.time.uptimeSec)
      ? snapshot.time.uptimeSec * 1000
      : null;
  const previousReadingRef = useRef<{
    lastSeenUptimeMs: number;
    currentUptimeMs: number | null;
  } | null>(null);
  const readingPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isReadingPulseActive, setIsReadingPulseActive] = useState(false);
  const [readingPulseSequence, setReadingPulseSequence] = useState(0);

  useEffect(() => {
    if (lastSeenUptimeMs === null) return;

    const previousReading = previousReadingRef.current;
    previousReadingRef.current = { lastSeenUptimeMs, currentUptimeMs };
    if (previousReading === null) return;

    const runtimeRestarted =
      previousReading.currentUptimeMs !== null &&
      currentUptimeMs !== null &&
      currentUptimeMs < previousReading.currentUptimeMs;
    if (runtimeRestarted || lastSeenUptimeMs <= previousReading.lastSeenUptimeMs) return;

    setReadingPulseSequence((current) => current + 1);
    setIsReadingPulseActive(true);
    if (readingPulseTimeoutRef.current !== null) {
      clearTimeout(readingPulseTimeoutRef.current);
    }
    readingPulseTimeoutRef.current = setTimeout(() => {
      setIsReadingPulseActive(false);
      readingPulseTimeoutRef.current = null;
    }, CLIMATE_READING_PULSE_MS);
  }, [currentUptimeMs, lastSeenUptimeMs]);

  useEffect(
    () => () => {
      if (readingPulseTimeoutRef.current !== null) {
        clearTimeout(readingPulseTimeoutRef.current);
      }
    },
    []
  );
  const health = snapshot ? installedAutomationHealth(snapshot) : null;
  const controlStatus = control.data;
  const controlMatch = controlStatus
    ? installedAutomationScriptMatch(installation, controlStatus)
    : null;
  const controlsVerified = controlMatch === 'matched';
  const runtimeControllable =
    controlsVerified &&
    (controlStatus?.automationMode === 'auto' ||
      controlStatus?.automationMode === 'manual');
  const automationRunning = controlsVerified && controlStatus?.automationMode === 'auto';
  const manualControl = controlsVerified && controlStatus?.automationMode === 'manual';
  const relayState =
    snapshot?.plug?.relayState ??
    controlStatus?.relayOn ??
    snapshot?.diagnostics.relayState;
  const controlsHumidity = installation.config.rule.control.metric === 'humidity';
  const purposeLabel = controlsHumidity
    ? t('intent.humidity.context')
    : t('intent.temperature.context');
  const thresholdSummary = installationThresholdSummary(
    installation,
    snapshot?.diagnostics.lastEffectiveOnThreshold,
    snapshot?.diagnostics.lastEffectiveOffThreshold
  );

  const primaryMetric = controlsHumidity
    ? {
        label: t('dashboard.humidity'),
        value: formatInstallationMetric(snapshot?.diagnostics.lastHumidity, '%')
      }
    : {
        label: t('dashboard.temperature'),
        value: formatInstallationMetric(snapshot?.diagnostics.lastTemp, '°C')
      };
  const secondaryMetric = controlsHumidity
    ? {
        label: t('dashboard.temperature'),
        value: formatInstallationMetric(snapshot?.diagnostics.lastTemp, '°C')
      }
    : {
        label: t('dashboard.humidity'),
        value: formatInstallationMetric(snapshot?.diagnostics.lastHumidity, '%')
      };
  const currentVpdKpa =
    snapshot?.diagnostics.lastVpd ??
    calculateVpdKpa(
      snapshot?.diagnostics.lastTemp ?? undefined,
      snapshot?.diagnostics.lastHumidity ?? undefined
    );
  const targetVpdKpa = installation.config.rule.vpdAssist.enabled
    ? installation.config.rule.vpdAssist.targetKpa
    : null;

  let warningLabel: string | null = null;
  let warningClass = 'attention';
  if (controlMatch !== null && controlMatch !== 'matched') {
    warningLabel = t('dashboard.health.attention');
  } else if (query.isError && control.isError) {
    warningLabel = t('dashboard.health.offline');
    warningClass = 'offline';
  } else if (health !== null && health !== 'ok') {
    warningLabel = installationHealthLabel(health, t);
    warningClass = health;
  } else if (control.isError || query.isError) {
    warningLabel = t('dashboard.health.attention');
  }

  return (
    <article className="automation-card automation-card--climate">
      <header className="automation-card__header">
        <span
          className={`automation-card__leading-icon${
            relayState === true ? ' automation-card__leading-icon--active' : ''
          }${isReadingPulseActive ? ' automation-card__leading-icon--fresh' : ''}`}
          aria-hidden="true"
        >
          <IconPlug key={readingPulseSequence} className="automation-card__icon" />
        </span>

        <div className="automation-card__identity">
          <h2>{installation.shelly.name}</h2>
          <p>{purposeLabel}</p>
        </div>

        <div className="automation-card__header-actions">
          <button
            className="automation-card__menu"
            type="button"
            aria-label={`${t('dashboard.openSystem')}: ${installation.shelly.name}`}
            title={t('dashboard.openSystem')}
            onClick={() => onOpen(installation.id)}
          >
            <IconDotsVertical className="automation-card__menu-icon" />
          </button>
        </div>
      </header>

      <div className="automation-card__main" aria-label={t('dashboard.currentValues')}>
        <div className="automation-card__primary-metric">
          <span>{primaryMetric.label}</span>
          <strong>{primaryMetric.value}</strong>
          <small aria-label={`${t('dashboard.thresholds')}: ${thresholdSummary}`}>
            {thresholdSummary}
          </small>
        </div>

        <div className="automation-card__secondary-metrics">
          <div>
            <span>{secondaryMetric.label}</span>
            <strong>{secondaryMetric.value}</strong>
          </div>
          <div>
            <span>{t('dashboard.vpd')}</span>
            <strong>{formatInstallationVpd(currentVpdKpa, targetVpdKpa)}</strong>
          </div>
        </div>

        <div
          className="automation-control-group automation-card__mode-control"
          role="group"
          aria-label={t('detail.automation')}
        >
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={automationRunning}
            disabled={action.isPending || !runtimeControllable}
            onClick={() => {
              if (controlStatus?.automationMode !== 'auto') action.mutate('auto');
            }}
          >
            AUTO
          </button>
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={manualControl}
            disabled={action.isPending || !runtimeControllable}
            onClick={() => {
              if (controlStatus?.automationMode !== 'manual') action.mutate('manual');
            }}
          >
            MANUAL
          </button>
        </div>
      </div>

      <div
        className="automation-card__plug-runtime"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatInstallationMetric(snapshot?.plug?.powerW, ' W', 1)}</span>
        <span>{formatInstallationMetric(snapshot?.plug?.voltageV, ' V', 0)}</span>
        <span>{formatPlugEnergy(snapshot?.plug?.energyWh)}</span>
        <span>{snapshot?.time.localTime ?? '—'}</span>
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
          disabled={action.isPending || !manualControl}
          onClick={() => {
            if (!controlStatus?.relayOn) action.mutate('on');
          }}
        >
          ON
        </button>
        <button
          className="automation-relay-button"
          type="button"
          aria-pressed={relayState === false}
          disabled={action.isPending || !manualControl}
          onClick={() => {
            if (controlStatus?.relayOn) action.mutate('off');
          }}
        >
          OFF
        </button>
      </div>

      {(warningLabel || action.isError) && (
        <footer className="automation-card__footer">
          {warningLabel && (
            <div
              className={`automation-card__status automation-card__status--${warningClass}`}
              role="status"
            >
              <IconAlertTriangle aria-hidden="true" />
              <span>{warningLabel}</span>
            </div>
          )}
          {action.isError && (
            <span className="automation-control-error" role="alert">
              {t('detail.actionFailed')}
            </span>
          )}
        </footer>
      )}
    </article>
  );
};

const AutomationCard = ({ installation, onOpen }: AutomationCardProps) =>
  installation.kind === 'time' ? (
    <TimeAutomationCard installation={installation} onOpen={onOpen} />
  ) : (
    <ClimateAutomationCard installation={installation} onOpen={onOpen} />
  );

const ThermometerDashboardSection = ({ onAdd }: { onAdd(): void }) => {
  const flow = useHardwareSetupFlow();
  return (
    <SensorSetupPage
      flow={flow}
      primaryAddAction="phone-scan"
      embedded
      onAddRequest={onAdd}
    />
  );
};

const PlugSettingsOverlay = ({
  deviceId,
  onClose
}: {
  deviceId: string;
  onClose(): void;
}) => {
  const flow = useHardwareSetupFlow();
  return (
    <ShellySetupPage
      flow={flow}
      settingsOnlyDeviceId={deviceId}
      onSettingsClose={onClose}
    />
  );
};

const PlainPlugCard = ({
  device,
  onAddAutomation,
  onOpenSettings,
  onNameChange
}: {
  device: ShellyDraftDevice;
  onAddAutomation(): void;
  onOpenSettings(): void;
  onNameChange(value: string): void;
}) => {
  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const { status, isRelayPending, turnRelayOn, turnRelayOff } =
    usePlainShellyRuntime(device);
  const relayState = status?.relayOn;
  const isBusy = isRelayPending;

  return (
    <article className="automation-card plug-card plug-card--unconfigured">
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
          {isEditingName ? (
            <input
              autoFocus
              className="plug-card__name-input"
              aria-label={t('hardware.shelly.deviceNameLabel')}
              type="text"
              value={device.name}
              onBlur={() => setIsEditingName(false)}
              onChange={(event) => onNameChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') {
                  event.currentTarget.blur();
                }
              }}
            />
          ) : (
            <div className="plug-card__title-row">
              <h2>{device.name}</h2>
              <button
                className="icon-action rule-summary-icon-action plug-card__rename"
                type="button"
                aria-label={t('hardware.shelly.deviceNameLabel')}
                title={t('hardware.shelly.deviceNameLabel')}
                onClick={() => setIsEditingName(true)}
              >
                <IconPencil className="icon-action__svg" aria-hidden="true" />
              </button>
            </div>
          )}
          <p>{t('dashboard.emptyCategory')}</p>
        </div>
        <button
          className="automation-card__menu"
          type="button"
          aria-label={`${t('hardware.shelly.settings')}: ${device.name}`}
          title={t('hardware.shelly.settings')}
          onClick={onOpenSettings}
        >
          <IconDotsVertical aria-hidden="true" />
        </button>
      </header>

      <div
        className="automation-card__plug-runtime"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatInstallationMetric(status?.telemetry.powerW, ' W', 1)}</span>
        <span>{formatInstallationMetric(status?.telemetry.voltageV, ' V', 0)}</span>
        <span>{formatPlugEnergy(status?.telemetry.energyWh)}</span>
        <span>{status?.clock.localTime ?? '—'}</span>
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
            if (relayState !== true) turnRelayOn();
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
            if (relayState !== false) turnRelayOff();
          }}
        >
          OFF
        </button>
      </div>

      <button
        className="primary-action plug-card__automation-action"
        type="button"
        onClick={onAddAutomation}
      >
        {t('dashboard.addAutomation')}
      </button>
    </article>
  );
};

type AutomationDashboardScreenProps = {
  initialKind?: AppNavigationKind;
  onAddPlug(): void;
  onAddThermometer(): void;
  onAddAutomation(kind: AppNavigationKind, shellyId?: string): void;
  onOpenInstallation(installationId: string): void;
  onOpenSettings?: () => void;
};

export const AutomationDashboardScreen = ({
  initialKind,
  onAddPlug,
  onAddThermometer,
  onAddAutomation,
  onOpenInstallation
}: AutomationDashboardScreenProps) => {
  const { t } = useTranslation();
  const installations = useInstalledAutomationStore((state) => state.installations);
  const shellyDevices = useHardwareSetupDraftStore((state) => state.shellyDevices);
  const setShellyDeviceName = useHardwareSetupDraftStore(
    (state) => state.setShellyDeviceName
  );
  const queryClient = useQueryClient();
  const activeKind = initialKind ?? 'climate';
  const [settingsDeviceId, setSettingsDeviceId] = useState<string | null>(null);
  const closePlugSettings = useCallback(() => setSettingsDeviceId(null), []);

  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;

    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void queryClient.refetchQueries({ predicate: isDashboardRuntimeQuery });
      }
    }).then((handle) => {
      if (!active) {
        void handle.remove();
        return;
      }
      removeListener = () => handle.remove();
    });

    return () => {
      active = false;
      if (removeListener) void removeListener();
    };
  }, [queryClient]);

  const normalizedBaseUrl = (value: string) =>
    value.trim().replace(/\/+$/, '').toLowerCase();
  const matchedInstallationIds = new Set<string>();
  const plugEntries = shellyDevices.map((device) => {
    const installation =
      installations.find(
        (candidate) =>
          normalizedBaseUrl(candidate.shelly.baseUrl) ===
          normalizedBaseUrl(device.baseUrl)
      ) ?? null;
    if (installation) matchedInstallationIds.add(installation.id);
    return { device, installation };
  });
  const unmatchedInstallations = installations.filter(
    (installation) => !matchedInstallationIds.has(installation.id)
  );
  const hasPlugEntries = plugEntries.length > 0 || unmatchedInstallations.length > 0;
  const fabLabel = t('hardware.shelly.add');

  return (
    <main
      className="demo-shell dashboard-shell"
      aria-label={
        activeKind === 'climate' ? t('dashboard.climateTab') : t('dashboard.timeTab')
      }
    >
      <section className="dashboard-grid" aria-label={t('dashboard.systemsLabel')}>
        {activeKind === 'time' ? (
          <ThermometerDashboardSection onAdd={onAddThermometer} />
        ) : hasPlugEntries ? (
          <>
            {plugEntries.map(({ device, installation }) =>
              installation ? (
                <AutomationCard
                  key={installation.id}
                  installation={installation}
                  onOpen={onOpenInstallation}
                />
              ) : (
                <PlainPlugCard
                  key={`plug:${device.id}`}
                  device={device}
                  onAddAutomation={() => onAddAutomation('climate', device.id)}
                  onOpenSettings={() => setSettingsDeviceId(device.id)}
                  onNameChange={(value) => setShellyDeviceName(device.id, value)}
                />
              )
            )}
            {unmatchedInstallations.map((installation) => (
              <AutomationCard
                key={installation.id}
                installation={installation}
                onOpen={onOpenInstallation}
              />
            ))}
          </>
        ) : (
          <div className="dashboard-kind-empty" role="status">
            <IconPlug className="dashboard-kind-empty__icon" aria-hidden="true" />
            <strong>{t('hardware.shelly.empty')}</strong>
          </div>
        )}
      </section>

      {settingsDeviceId && (
        <PlugSettingsOverlay
          key={settingsDeviceId}
          deviceId={settingsDeviceId}
          onClose={closePlugSettings}
        />
      )}

      {activeKind === 'climate' && (
        <button
          className="dashboard-fab"
          type="button"
          aria-label={fabLabel}
          title={fabLabel}
          onClick={onAddPlug}
        >
          <IconPlus className="dashboard-fab__icon" aria-hidden="true" />
        </button>
      )}
    </main>
  );
};

import { Capacitor } from '@capacitor/core';
import { DiagnosticRow, ToastViewport, type ToastMessage, type ToastTone } from '@lcl/ui';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import mobilePackage from '../../../../package.json';
import {
  AppSettingsModal,
  type SupportDiagnosticRow
} from '../../../app/AppSettingsModal.js';
import { SettingsGearIcon } from '../../../components/icons/SettingsGearIcon.js';
import { getRuntimeIssues } from '../../../app/runtimeDiagnostics.js';
import { type SupportReportDevice } from '../../../app/supportReport.js';
import {
  useTranslation,
  type Translate,
  type TranslationKey
} from '../../../app/i18n.js';
import {
  formatDiagnosticNumber,
  mutationError,
  type HardwarePageProps
} from '../helpers.js';

type DiagnosticTime = NonNullable<
  HardwarePageProps['flow']['diagnosticSnapshot']
>['time'];

type DiagnosticPlug = NonNullable<
  HardwarePageProps['flow']['diagnosticSnapshot']
>['plug'];

const formatShellyTime = (
  time: DiagnosticTime | undefined,
  missingLabel: string
): string => time?.localTime ?? missingLabel;

const formatTimeSyncState = (time: DiagnosticTime | undefined, t: Translate): string =>
  time?.isSynced ? 'OK' : t('hardware.status.unsynced');

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.trunc(durationMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds} s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    return seconds === 0 ? `${totalMinutes} min` : `${totalMinutes} min ${seconds} s`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

const formatUptimeAge = (
  valueUptimeMs: number | null | undefined,
  currentUptimeSec: number | null | undefined,
  missingLabel: string,
  t: Translate
): string => {
  if (valueUptimeMs == null) {
    return missingLabel;
  }

  if (currentUptimeSec == null || !Number.isFinite(currentUptimeSec)) {
    return t('hardware.diagnostics.uptimeAt', {
      duration: formatDuration(valueUptimeMs)
    });
  }

  return t('hardware.diagnostics.ageAgo', {
    duration: formatDuration(currentUptimeSec * 1000 - valueUptimeMs)
  });
};

const formatSnapshotAge = (
  fetchedAtMs: number | null,
  nowMs: number,
  missingLabel: string,
  t: Translate
): string =>
  fetchedAtMs === null
    ? missingLabel
    : t('hardware.diagnostics.ageAgo', {
        duration: formatDuration(nowMs - fetchedAtMs)
      });

const formatEnergy = (value: number | null | undefined, missingLabel: string): string => {
  if (value == null) {
    return missingLabel;
  }
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kWh` : `${value.toFixed(0)} Wh`;
};

const formatPlugRelay = (
  plug: DiagnosticPlug | undefined,
  missingLabel: string
): string => (plug ? (plug.relayState ? 'ON' : 'OFF') : missingLabel);

const createSupportReportDevice = (
  name: string,
  detail: string
): SupportReportDevice => ({
  name,
  detail
});

const diagnosticReasonKeys = new Set([
  'ab',
  'abh',
  'b',
  'bf',
  'bl',
  'blh',
  'bm',
  'bo',
  'boot',
  'bs',
  'cv',
  'ib',
  'mc',
  'mx',
  'ok',
  'pt',
  'rl',
  'se',
  'st',
  'ta',
  'tm',
  'tr',
  'ts'
]);

const formatReason = (reason: string, t: Translate): string =>
  diagnosticReasonKeys.has(reason)
    ? t(`hardware.diagnosticsReason.${reason}` as TranslationKey)
    : reason;

type DiagnosticGroupProps = {
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

const DiagnosticGroup = ({
  title,
  description,
  defaultOpen = false,
  children
}: DiagnosticGroupProps) => (
  <details className="diagnostic-group" open={defaultOpen || undefined}>
    <summary>
      <strong>{title}</strong>
      <span>{description}</span>
    </summary>
    <div className="status-stack diagnostic-group__rows">{children}</div>
  </details>
);

type DiagnosticSectionProps = {
  title: string;
  children: ReactNode;
};

const DiagnosticSection = ({ title, children }: DiagnosticSectionProps) => (
  <section className="diagnostic-section" aria-label={title}>
    <h3 className="diagnostic-section__title">{title}</h3>
    <div className="diagnostic-section__rows">{children}</div>
  </section>
);

export const DiagnosticsSetupPage = ({ flow }: HardwarePageProps) => {
  const { t } = useTranslation();
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const toastIdRef = useRef(0);
  const diagnostics = flow.diagnosticSnapshot?.diagnostics;
  const shellyTime = flow.diagnosticSnapshot?.time;
  const script = flow.diagnosticSnapshot?.script;
  const plug = flow.diagnosticSnapshot?.plug;
  const thresholdUnit =
    flow.diagnosticSnapshot?.rule?.control.metric === 'humidity' ? '%' : '°C';
  const diagnosticSensorLabel =
    flow.diagnosticSnapshot?.sensor?.displayName ??
    flow.diagnosticSnapshot?.sensor?.runtimeAddress ??
    t('common.missing');
  const runtimeIssues = getRuntimeIssues();

  const supportRows: SupportDiagnosticRow[] = [
    {
      label: t('settings.support.appVersion'),
      value: mobilePackage.version
    },
    {
      label: t('settings.support.platform'),
      value: Capacitor.getPlatform()
    },
    {
      label: t('settings.support.savedShelly'),
      value: String(flow.shellyDevices.length)
    },
    {
      label: t('settings.support.savedThermometers'),
      value: String(flow.sensorDevices.length)
    },
    {
      label: t('settings.support.runtimeErrorsLabel'),
      value: String(runtimeIssues.length),
      tone: runtimeIssues.length > 0 ? 'warning' : 'normal'
    }
  ];

  const supportShellyDevices = flow.shellyDevices.map((device) =>
    createSupportReportDevice(device.name, device.baseUrl)
  );

  const supportSensorDevices = flow.sensorDevices.map((device) =>
    createSupportReportDevice(device.name, `${device.profileId} ${device.runtimeAddress}`)
  );

  const lastDiagnostics = [
    createSupportReportDevice(
      t('hardware.rule.script'),
      script?.running
        ? t('hardware.status.running')
        : t('hardware.diagnostics.scriptMissingConfirm')
    ),
    createSupportReportDevice(
      t('hardware.metrics.shellyRelay'),
      formatPlugRelay(plug, t('common.missing'))
    ),
    createSupportReportDevice(
      t('hardware.metrics.lastMeasurement'),
      formatUptimeAge(
        diagnostics?.lastSeenUptimeMs,
        shellyTime?.uptimeSec,
        t('common.missing'),
        t
      )
    ),
    createSupportReportDevice(
      t('hardware.metrics.temperature'),
      formatDiagnosticNumber(diagnostics?.lastTemp, '°C')
    ),
    createSupportReportDevice(
      t('hardware.metrics.humidity'),
      formatDiagnosticNumber(diagnostics?.lastHumidity, '%')
    ),
    createSupportReportDevice(
      t('hardware.metrics.reason'),
      diagnostics ? formatReason(diagnostics.lastReason, t) : t('common.missing')
    )
  ];

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = `diagnostics-toast-${toastIdRef.current}`;
    const toast: ToastMessage =
      detail === undefined ? { id, tone, title } : { id, tone, title, detail };
    setToasts((current) => [...current.slice(-2), toast]);
  }, []);

  useEffect(() => {
    if (!flow.diagnosticMutation.isError) {
      return;
    }

    pushToast(
      'warning',
      mutationError(flow.diagnosticMutation.error),
      t('hardware.diagnostics.empty')
    );
    flow.diagnosticMutation.reset();
  }, [flow.diagnosticMutation, pushToast, t]);

  useEffect(() => {
    if (flow.diagnosticFetchedAtMs === null) {
      return;
    }

    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [flow.diagnosticFetchedAtMs]);

  return (
    <section className="demo-panel" aria-label={t('common.diagnostics')}>
      <div className="action-row diagnostics-settings-row">
        <button
          className="secondary-action diagnostics-settings-button"
          type="button"
          aria-label={t('settings.open')}
          title={t('settings.open')}
          onClick={() => setIsAppSettingsOpen(true)}
        >
          <SettingsGearIcon />
          {t('settings.open')}
        </button>
      </div>

      <label className="field">
        {t('hardware.rule.selectedShelly')}
        <span className="select-control">
          <select
            value={flow.diagnosticShellyId ?? ''}
            onChange={(event) => flow.setDiagnosticShellyId(event.currentTarget.value)}
          >
            <option value="" disabled>
              {t('hardware.rule.noShellySelected')}
            </option>
            {flow.shellyDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </span>
      </label>

      <div className="action-row">
        <button
          className="secondary-action diagnostics-refresh-button"
          type="button"
          aria-busy={flow.diagnosticMutation.isPending || undefined}
          disabled={flow.diagnosticShelly === null || flow.diagnosticMutation.isPending}
          title={t('hardware.diagnostics.actionRefreshTitle')}
          onClick={() => flow.diagnosticMutation.mutate(undefined)}
        >
          {flow.diagnosticMutation.isPending
            ? t('hardware.diagnostics.fetching')
            : t('hardware.diagnostics.actionRefresh')}
        </button>
      </div>
      <p className="field__hint">
        {t('hardware.diagnostics.refreshRequirement')}{' '}
        {flow.diagnosticFetchedAtMs !== null &&
          `${t('hardware.metrics.snapshotAge')}: ${formatSnapshotAge(
            flow.diagnosticFetchedAtMs,
            nowMs,
            t('common.missing'),
            t
          )}.`}
      </p>

      {diagnostics && (
        <div className="diagnostic-groups">
          <DiagnosticGroup
            defaultOpen
            title={t('hardware.diagnostics.groupDecision')}
            description={t('hardware.diagnostics.groupDecisionHint')}
          >
            <div className="diagnostic-ipo-grid">
              <DiagnosticSection title={t('hardware.diagnostics.input')}>
                <DiagnosticRow
                  label={t('hardware.metrics.lastMeasurement')}
                  value={formatUptimeAge(
                    diagnostics.lastSeenUptimeMs,
                    shellyTime?.uptimeSec,
                    t('common.missing'),
                    t
                  )}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.temperature')}
                  value={formatDiagnosticNumber(diagnostics.lastTemp, '°C')}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.humidity')}
                  value={formatDiagnosticNumber(diagnostics.lastHumidity, '%')}
                />
                <DiagnosticRow
                  label="VPD"
                  value={formatDiagnosticNumber(diagnostics.lastVpd, ' kPa', 2)}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.dataBle')}
                  value={formatReason(diagnostics.dataState, t)}
                />
              </DiagnosticSection>

              <DiagnosticSection title={t('hardware.diagnostics.processing')}>
                <DiagnosticRow
                  label={t('hardware.metrics.controlValue')}
                  value={formatDiagnosticNumber(
                    diagnostics.lastControlValue,
                    thresholdUnit
                  )}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.thresholdOn')}
                  value={formatDiagnosticNumber(
                    diagnostics.lastEffectiveOnThreshold,
                    thresholdUnit
                  )}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.thresholdOff')}
                  value={formatDiagnosticNumber(
                    diagnostics.lastEffectiveOffThreshold,
                    thresholdUnit
                  )}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.reason')}
                  value={formatReason(diagnostics.lastReason, t)}
                />
              </DiagnosticSection>

              <DiagnosticSection title={t('hardware.diagnostics.output')}>
                <DiagnosticRow
                  label={t('hardware.metrics.relayRule')}
                  value={diagnostics.relayState ? 'ON' : 'OFF'}
                  tone={diagnostics.relayState ? 'warning' : 'normal'}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.shellyRelay')}
                  value={formatPlugRelay(plug, t('common.missing'))}
                  tone={plug?.relayState ? 'warning' : 'normal'}
                />
              </DiagnosticSection>
            </div>
          </DiagnosticGroup>

          <DiagnosticGroup
            title={t('hardware.diagnostics.groupSensor')}
            description={t('hardware.diagnostics.groupSensorHint')}
          >
            <DiagnosticRow
              label={t('hardware.metrics.thermometer')}
              value={diagnosticSensorLabel}
            />
            <DiagnosticRow
              label={t('hardware.metrics.lastBlePacket')}
              value={formatUptimeAge(
                diagnostics.lastPacketSeenUptimeMs,
                shellyTime?.uptimeSec,
                t('common.missing'),
                t
              )}
            />
            <DiagnosticRow
              label={t('hardware.metrics.battery')}
              value={formatDiagnosticNumber(diagnostics.lastBattery, '%', 0)}
            />
            <DiagnosticRow
              label="RSSI"
              value={formatDiagnosticNumber(diagnostics.lastRssi, ' dBm', 0)}
            />
          </DiagnosticGroup>

          <DiagnosticGroup
            title={t('hardware.diagnostics.groupRuntime')}
            description={t('hardware.diagnostics.groupRuntimeHint')}
          >
            <DiagnosticRow
              label={t('hardware.rule.selectedShelly')}
              value={flow.diagnosticShelly?.name ?? t('common.missing')}
            />
            <DiagnosticRow
              label={t('hardware.rule.script')}
              value={
                script?.running
                  ? t('hardware.status.running')
                  : t('hardware.diagnostics.scriptMissingConfirm')
              }
              tone={script?.running ? 'normal' : 'warning'}
            />
            <DiagnosticRow
              label={t('hardware.metrics.configHash')}
              value={script?.configHash ?? t('common.missing')}
            />
            <DiagnosticRow
              label={t('hardware.metrics.snapshotAge')}
              value={formatSnapshotAge(
                flow.diagnosticFetchedAtMs,
                nowMs,
                t('common.missing'),
                t
              )}
            />
            <DiagnosticRow
              label={t('hardware.metrics.clockShelly')}
              value={formatShellyTime(shellyTime, t('common.missing'))}
            />
            <DiagnosticRow
              label={t('hardware.shelly.clockSync')}
              value={formatTimeSyncState(shellyTime, t)}
              tone={shellyTime?.isSynced ? 'normal' : 'warning'}
            />
          </DiagnosticGroup>

          <DiagnosticGroup
            title={t('hardware.diagnostics.groupShelly')}
            description={t('hardware.diagnostics.groupShellyHint')}
          >
            <DiagnosticRow
              label={t('hardware.metrics.power')}
              value={formatDiagnosticNumber(plug?.powerW, ' W')}
            />
            <DiagnosticRow
              label={t('hardware.metrics.voltage')}
              value={formatDiagnosticNumber(plug?.voltageV, ' V', 0)}
            />
            <DiagnosticRow
              label={t('hardware.metrics.current')}
              value={formatDiagnosticNumber(plug?.currentA, ' A', 2)}
            />
            <DiagnosticRow
              label={t('hardware.metrics.energy')}
              value={formatEnergy(plug?.energyWh, t('common.missing'))}
            />
            <DiagnosticRow
              label={t('hardware.metrics.plugTemperature')}
              value={formatDiagnosticNumber(plug?.deviceTemperatureC, '°C')}
            />
          </DiagnosticGroup>
        </div>
      )}
      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
      <AppSettingsModal
        open={isAppSettingsOpen}
        supportReportInput={{
          platform: Capacitor.getPlatform(),
          shellyDevices: supportShellyDevices,
          sensorDevices: supportSensorDevices,
          selectedShelly: flow.diagnosticShelly?.name ?? t('common.missing'),
          selectedSensor: flow.selectedSensor?.name ?? t('common.missing'),
          lastDiagnostics
        }}
        supportRows={supportRows}
        onClose={() => setIsAppSettingsOpen(false)}
      />
    </section>
  );
};

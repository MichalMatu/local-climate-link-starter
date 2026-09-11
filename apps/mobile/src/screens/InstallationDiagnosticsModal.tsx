import { DiagnosticRow, Modal } from '@lcl/ui';
import { IconRefresh } from '@tabler/icons-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from '../app/i18n.js';
import type { ClimateInstalledAutomation } from '../flows/installations/model.js';
import {
  useInstalledAutomationDiagnostics,
  useInstalledAutomationResourceDiagnostics
} from '../flows/installations/useInstalledAutomationRuntime.js';

export const INSTALLATION_DIAGNOSTICS_REFRESH_MS = 3_000;

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.trunc(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    return seconds === 0 ? `${totalMinutes} min` : `${totalMinutes} min ${seconds} s`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

const formatBytes = (value: number | null | undefined, missing: string): string => {
  if (value == null) return missing;
  return value < 1024 ? `${Math.round(value)} B` : `${(value / 1024).toFixed(1)} KiB`;
};

const formatNumber = (
  value: number | null | undefined,
  suffix: string,
  missing: string,
  digits = 1
): string => (value == null ? missing : `${value.toFixed(digits)}${suffix}`);

const formatEnergy = (value: number | null | undefined, missing: string): string => {
  if (value == null) return missing;
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kWh` : `${value.toFixed(0)} Wh`;
};

type TechnicalGroupProps = {
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

const TechnicalGroup = ({
  title,
  description,
  defaultOpen = false,
  children
}: TechnicalGroupProps) => (
  <details className="diagnostic-group" open={defaultOpen || undefined}>
    <summary>
      <strong>{title}</strong>
      <span>{description}</span>
    </summary>
    <div className="status-stack diagnostic-group__rows">{children}</div>
  </details>
);

type InstallationDiagnosticsModalProps = {
  installation: ClimateInstalledAutomation;
  open: boolean;
  onClose(): void;
};

export const InstallationDiagnosticsModal = ({
  installation,
  open,
  onClose
}: InstallationDiagnosticsModalProps) => {
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation, {
    enabled: open,
    refetchInterval: INSTALLATION_DIAGNOSTICS_REFRESH_MS
  });
  const resourcesQuery = useInstalledAutomationResourceDiagnostics(installation, {
    enabled: open,
    refetchInterval: INSTALLATION_DIAGNOSTICS_REFRESH_MS
  });

  useEffect(() => {
    if (!open) return undefined;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const snapshot = diagnosticsQuery.data;
  const diagnostics = snapshot?.diagnostics;
  const script = snapshot?.script;
  const plug = snapshot?.plug;
  const resources = resourcesQuery.data;
  const missing = t('common.missing');
  const isRefreshing = diagnosticsQuery.isFetching || resourcesQuery.isFetching;

  const formatUptimeAge = (valueUptimeMs: number | null | undefined): string => {
    if (valueUptimeMs == null) return missing;
    const currentUptimeSec = snapshot?.time.uptimeSec;
    if (currentUptimeSec == null || !Number.isFinite(currentUptimeSec)) {
      return t('hardware.diagnostics.uptimeAt', {
        duration: formatDuration(valueUptimeMs)
      });
    }
    return t('hardware.diagnostics.ageAgo', {
      duration: formatDuration(currentUptimeSec * 1000 - valueUptimeMs)
    });
  };

  const snapshotAge =
    diagnosticsQuery.dataUpdatedAt === 0
      ? missing
      : t('hardware.diagnostics.ageAgo', {
          duration: formatDuration(nowMs - diagnosticsQuery.dataUpdatedAt)
        });

  const refresh = () => {
    void Promise.allSettled([diagnosticsQuery.refetch(), resourcesQuery.refetch()]);
  };
  const resourceScriptRunning = resources?.script?.running ?? script?.running ?? null;

  return (
    <Modal
      closeLabel={t('common.close')}
      headerActions={
        <button
          className="icon-action"
          type="button"
          aria-busy={isRefreshing || undefined}
          aria-label={t('common.refresh')}
          title={t('common.refresh')}
          disabled={isRefreshing}
          onClick={refresh}
        >
          <IconRefresh className="icon-action__svg" aria-hidden="true" />
        </button>
      }
      open={open}
      size="diagnostic"
      title={`${t('common.diagnostics')} · ${installation.shelly.name}`}
      onClose={onClose}
    >
      {diagnosticsQuery.isPending && (
        <p className="installation-detail-note" role="status">
          {t('common.refreshing')}
        </p>
      )}
      {diagnosticsQuery.isError && (
        <p className="installation-detail-note" role="alert">
          {t('dashboard.readFailed')}
        </p>
      )}
      {snapshot && diagnostics && (
        <div className="diagnostic-groups">
          <TechnicalGroup
            defaultOpen
            title={t('hardware.diagnostics.groupRuntime')}
            description={t('hardware.diagnostics.groupRuntimeHint')}
          >
            <DiagnosticRow
              label={t('hardware.rule.script')}
              value={
                resourceScriptRunning === true
                  ? t('hardware.status.running')
                  : resourceScriptRunning === false
                    ? t('hardware.diagnostics.scriptMissingConfirm')
                    : missing
              }
              tone={resourceScriptRunning === false ? 'warning' : 'normal'}
            />
            <DiagnosticRow
              label={t('hardware.metrics.configHash')}
              value={script?.configHash ?? missing}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptMemUsed')}
              value={formatBytes(resources?.script?.memUsedBytes, missing)}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptMemPeak')}
              value={formatBytes(resources?.script?.memPeakBytes, missing)}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptMemFree')}
              value={formatBytes(resources?.script?.memFreeBytes, missing)}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.scriptCpu')}
              value={formatNumber(resources?.script?.cpuPercent, '%', missing, 1)}
            />
            <DiagnosticRow
              label={t('hardware.metrics.snapshotAge')}
              value={snapshotAge}
            />
          </TechnicalGroup>
          <TechnicalGroup
            title={t('hardware.diagnostics.groupSensor')}
            description={t('hardware.diagnostics.groupSensorHint')}
          >
            <DiagnosticRow
              label={t('hardware.metrics.lastMeasurement')}
              value={formatUptimeAge(diagnostics.lastSeenUptimeMs)}
            />
            <DiagnosticRow
              label={t('hardware.metrics.lastBlePacket')}
              value={formatUptimeAge(diagnostics.lastPacketSeenUptimeMs)}
            />
            <DiagnosticRow
              label={t('hardware.metrics.battery')}
              value={formatNumber(diagnostics.lastBattery, '%', missing, 0)}
            />
            <DiagnosticRow
              label="RSSI"
              value={formatNumber(diagnostics.lastRssi, ' dBm', missing, 0)}
            />
          </TechnicalGroup>
          <TechnicalGroup
            title={t('hardware.diagnostics.groupShelly')}
            description={t('hardware.diagnostics.groupShellyHint')}
          >
            <DiagnosticRow
              label={t('hardware.metrics.power')}
              value={formatNumber(plug?.powerW, ' W', missing, 1)}
            />
            <DiagnosticRow
              label={t('hardware.metrics.voltage')}
              value={formatNumber(plug?.voltageV, ' V', missing, 0)}
            />
            <DiagnosticRow
              label={t('hardware.metrics.current')}
              value={formatNumber(plug?.currentA, ' A', missing, 2)}
            />
            <DiagnosticRow
              label={t('hardware.metrics.energy')}
              value={formatEnergy(plug?.energyWh, missing)}
            />
            <DiagnosticRow
              label={t('hardware.metrics.plugTemperature')}
              value={formatNumber(plug?.deviceTemperatureC, '°C', missing, 1)}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.deviceRamFree')}
              value={formatBytes(resources?.system?.ramFreeBytes, missing)}
            />
            <DiagnosticRow
              label={t('hardware.diagnostics.deviceRamTotal')}
              value={formatBytes(resources?.system?.ramSizeBytes, missing)}
            />
            <DiagnosticRow
              label={t('hardware.metrics.clockShelly')}
              value={snapshot.time.localTime ?? missing}
            />
            <DiagnosticRow
              label={t('hardware.shelly.clockSync')}
              value={snapshot.time.isSynced ? 'OK' : t('hardware.status.unsynced')}
              tone={snapshot.time.isSynced ? 'normal' : 'warning'}
            />
          </TechnicalGroup>
        </div>
      )}
    </Modal>
  );
};

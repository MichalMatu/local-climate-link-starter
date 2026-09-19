import { DiagnosticRow } from '@lcl/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import { AppPageBack } from '../components/AppPageBack.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
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

type InstallationDiagnosticsScreenProps = {
  installationId: string;
  onBack(): void;
};

export const InstallationDiagnosticsScreen = ({
  installationId,
  onBack
}: InstallationDiagnosticsScreenProps) => {
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const installation = useInstalledAutomationStore((state) =>
    state.installations.find((candidate) => candidate.id === installationId)
  );

  if (!installation || installation.kind !== 'climate') {
    return (
      <main className="demo-shell installation-detail-shell">
        <div className="setup-context">
          <button className="setup-context__back" type="button" onClick={onBack}>
            {t('detail.backToDashboard')}
          </button>
        </div>
        <section className="automation-card">
          <h1>{t('detail.notFoundTitle')}</h1>
        </section>
      </main>
    );
  }

  return (
    <InstallationDiagnosticsContent
      installation={installation}
      nowMs={nowMs}
      setNowMs={setNowMs}
      onBack={onBack}
    />
  );
};

type InstallationDiagnosticsContentProps = {
  installation: Extract<
    ReturnType<typeof useInstalledAutomationStore.getState>['installations'][number],
    { kind: 'climate' }
  >;
  nowMs: number;
  setNowMs(value: number): void;
  onBack(): void;
};

const InstallationDiagnosticsContent = ({
  installation,
  nowMs,
  setNowMs,
  onBack
}: InstallationDiagnosticsContentProps) => {
  const { t } = useTranslation();
  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation, {
    refetchInterval: INSTALLATION_DIAGNOSTICS_REFRESH_MS
  });
  const resourcesQuery = useInstalledAutomationResourceDiagnostics(installation, {
    refetchInterval: INSTALLATION_DIAGNOSTICS_REFRESH_MS
  });

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [setNowMs]);

  const snapshot = diagnosticsQuery.data;
  const diagnostics = snapshot?.diagnostics;
  const script = snapshot?.script;
  const resources = resourcesQuery.data;
  const missing = t('common.missing');
  const snapshotAge =
    diagnosticsQuery.dataUpdatedAt === 0
      ? missing
      : t('hardware.diagnostics.ageAgo', {
          duration: formatDuration(nowMs - diagnosticsQuery.dataUpdatedAt)
        });

  return (
    <main className="demo-shell installation-detail-shell installation-diagnostics-page">
      <AppPageBack label={installation.shelly.name} onBack={onBack} />

      <section className="automation-card installation-diagnostics-page__card">
        <div className="installation-section-heading">
          <h1>{t('common.diagnostics')}</h1>
        </div>

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
          <div className="installation-diagnostics">
            <section
              className="installation-diagnostics__section"
              aria-label={t('hardware.rule.script')}
            >
              <h2>{t('hardware.rule.script')}</h2>
              <div className="installation-diagnostics__rows">
                <DiagnosticRow
                  label={t('hardware.rule.script')}
                  value={
                    script?.running === true
                      ? t('hardware.status.running')
                      : script?.running === false
                        ? t('hardware.diagnostics.scriptMissingConfirm')
                        : missing
                  }
                  tone={script?.running === false ? 'warning' : 'normal'}
                />
                <DiagnosticRow
                  label={t('hardware.diagnostics.scriptRpcState')}
                  value={
                    resources?.script?.running === true
                      ? 'RUNNING'
                      : resources?.script?.running === false
                        ? 'STOPPED'
                        : missing
                  }
                />
                <DiagnosticRow
                  label={t('hardware.metrics.configHash')}
                  value={script?.configHash ?? missing}
                />
                <DiagnosticRow
                  label={t('hardware.diagnostics.scriptCpu')}
                  value={formatNumber(resources?.script?.cpuPercent, '%', missing, 1)}
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
                  label={t('hardware.metrics.snapshotAge')}
                  value={snapshotAge}
                />
              </div>
            </section>

            <section className="installation-diagnostics__section" aria-label="Shelly">
              <h2>Shelly</h2>
              <div className="installation-diagnostics__rows">
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
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
};

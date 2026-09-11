#!/usr/bin/env sh
set -eu

BASE=5a4a109f6d69bf468b6b408241e46cee1ecf75aa
BRANCH=work/installation-controls-diagnostics-20260911

git fetch --prune origin
test "$(git rev-parse origin/main)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "$BASE" >/dev/null
test -z "$(git status --porcelain)"

cat > apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts <<'EOF'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { readShellyResourceDiagnostics } from '../hardware-setup/resourceDiagnostics.js';
import type { ClimateInstalledAutomation } from './model.js';
import {
  pauseInstalledAutomation,
  readInstalledAutomationControlStatus,
  recoverInstalledAutomation,
  resumeInstalledAutomation,
  setInstalledAutomationRelayState
} from './runtimeControl.js';
import { fetchInstalledAutomationDiagnostics } from './runtimeDiagnostics.js';
import { useInstalledAutomationStore } from './store.js';

const DEFAULT_RUNTIME_REFRESH_MS = 30_000;

type RuntimeQueryOptions = {
  enabled?: boolean;
  refetchInterval?: number | false;
};

const installationQueryIdentity = (installation: ClimateInstalledAutomation) =>
  [
    installation.id,
    installation.shelly.baseUrl,
    installation.script.id,
    installation.script.hash,
    installation.updatedAtMs
  ] as const;

export const installedAutomationDiagnosticsQueryKey = (
  installation: ClimateInstalledAutomation
) =>
  [
    'installed-automation-diagnostics',
    ...installationQueryIdentity(installation)
  ] as const;

export const installedAutomationResourceDiagnosticsQueryKey = (
  installation: ClimateInstalledAutomation
) =>
  [
    'installed-automation-resource-diagnostics',
    ...installationQueryIdentity(installation)
  ] as const;

export const installedAutomationControlQueryKey = (
  installation: ClimateInstalledAutomation
) =>
  ['installed-automation-control', ...installationQueryIdentity(installation)] as const;

export const useInstalledAutomationDiagnostics = (
  installation: ClimateInstalledAutomation,
  options: RuntimeQueryOptions = {}
) =>
  useQuery({
    queryKey: installedAutomationDiagnosticsQueryKey(installation),
    queryFn: () => fetchInstalledAutomationDiagnostics(installation),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: options.refetchInterval ?? DEFAULT_RUNTIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

export const useInstalledAutomationResourceDiagnostics = (
  installation: ClimateInstalledAutomation,
  options: RuntimeQueryOptions = {}
) =>
  useQuery({
    queryKey: installedAutomationResourceDiagnosticsQueryKey(installation),
    queryFn: () =>
      readShellyResourceDiagnostics(installation.shelly.baseUrl, installation.script.id),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: options.refetchInterval ?? DEFAULT_RUNTIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

export const useInstalledAutomationControl = (
  installation: ClimateInstalledAutomation,
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    queryKey: installedAutomationControlQueryKey(installation),
    queryFn: () => readInstalledAutomationControlStatus(installation),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: DEFAULT_RUNTIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

export type InstalledAutomationControlAction =
  | 'auto'
  | 'manual'
  | 'on'
  | 'off'
  | 'recover';

export const useInstalledAutomationActions = (
  installation: ClimateInstalledAutomation
) => {
  const queryClient = useQueryClient();
  const upsertInstallation = useInstalledAutomationStore(
    (state) => state.upsertInstallation
  );

  return useMutation({
    mutationFn: (action: InstalledAutomationControlAction) => {
      switch (action) {
        case 'auto':
          return resumeInstalledAutomation(installation);
        case 'manual':
          return pauseInstalledAutomation(installation);
        case 'on':
          return setInstalledAutomationRelayState(installation, true);
        case 'off':
          return setInstalledAutomationRelayState(installation, false);
        case 'recover':
          return recoverInstalledAutomation(installation);
      }
    },
    onSuccess: ({ installation: nextInstallation, status }) => {
      if (
        nextInstallation.script.hash !== installation.script.hash ||
        nextInstallation.updatedAtMs !== installation.updatedAtMs
      ) {
        upsertInstallation(nextInstallation);
      }
      queryClient.setQueryData(
        installedAutomationControlQueryKey(nextInstallation),
        status
      );
      void queryClient.invalidateQueries({
        queryKey: installedAutomationDiagnosticsQueryKey(nextInstallation)
      });
      void queryClient.invalidateQueries({
        queryKey: installedAutomationResourceDiagnosticsQueryKey(nextInstallation)
      });
    }
  });
};
EOF

cat > apps/mobile/src/screens/InstallationRuntimeControls.tsx <<'EOF'
import { useTranslation } from '../app/i18n.js';

type InstallationRuntimeControlsProps = {
  automationMode: 'auto' | 'manual' | null;
  canToggleAutomation: boolean;
  relayState: boolean | undefined;
  actionBusy: boolean;
  deleteBusy: boolean;
  deleteLabel: string;
  onAuto(): void;
  onManual(): void;
  onRelayOn(): void;
  onRelayOff(): void;
  onOpenDiagnostics(): void;
  onDelete(): void;
};

export const InstallationRuntimeControls = ({
  automationMode,
  canToggleAutomation,
  relayState,
  actionBusy,
  deleteBusy,
  deleteLabel,
  onAuto,
  onManual,
  onRelayOn,
  onRelayOff,
  onOpenDiagnostics,
  onDelete
}: InstallationRuntimeControlsProps) => {
  const { t } = useTranslation();
  const manualControl = automationMode === 'manual';
  const controlsBusy = actionBusy || deleteBusy;

  return (
    <>
      <div className="installation-detail-actions installation-detail-mode-actions">
        <div
          className="automation-control-group installation-detail-mode-control"
          role="group"
          aria-label={t('detail.automation')}
        >
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={automationMode === 'auto'}
            disabled={!canToggleAutomation || controlsBusy}
            onClick={onAuto}
          >
            AUTO
          </button>
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={manualControl}
            disabled={!canToggleAutomation || controlsBusy}
            onClick={onManual}
          >
            MANUAL
          </button>
        </div>
      </div>

      <div className="installation-detail-actions installation-detail-mode-actions">
        <div
          className="automation-control-group installation-detail-mode-control"
          role="group"
          aria-label={t('dashboard.output')}
        >
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={relayState === true}
            disabled={!manualControl || controlsBusy}
            onClick={onRelayOn}
          >
            ON
          </button>
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={relayState === false}
            disabled={!manualControl || controlsBusy}
            onClick={onRelayOff}
          >
            OFF
          </button>
        </div>
      </div>

      <div className="installation-detail-actions">
        <button className="secondary-action" type="button" onClick={onOpenDiagnostics}>
          {t('common.diagnostics')}
        </button>
        <button
          className="secondary-action secondary-action--danger"
          type="button"
          disabled={controlsBusy}
          onClick={onDelete}
        >
          {deleteLabel}
        </button>
      </div>
    </>
  );
};
EOF

cat > apps/mobile/src/screens/InstallationDiagnosticsModal.tsx <<'EOF'
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
            <DiagnosticRow label={t('hardware.metrics.configHash')} value={script?.configHash ?? missing} />
            <DiagnosticRow label={t('hardware.diagnostics.scriptMemUsed')} value={formatBytes(resources?.script?.memUsedBytes, missing)} />
            <DiagnosticRow label={t('hardware.diagnostics.scriptMemPeak')} value={formatBytes(resources?.script?.memPeakBytes, missing)} />
            <DiagnosticRow label={t('hardware.diagnostics.scriptMemFree')} value={formatBytes(resources?.script?.memFreeBytes, missing)} />
            <DiagnosticRow label={t('hardware.diagnostics.scriptCpu')} value={formatNumber(resources?.script?.cpuPercent, '%', missing, 1)} />
            <DiagnosticRow label={t('hardware.metrics.snapshotAge')} value={snapshotAge} />
          </TechnicalGroup>
          <TechnicalGroup title={t('hardware.diagnostics.groupSensor')} description={t('hardware.diagnostics.groupSensorHint')}>
            <DiagnosticRow label={t('hardware.metrics.lastMeasurement')} value={formatUptimeAge(diagnostics.lastSeenUptimeMs)} />
            <DiagnosticRow label={t('hardware.metrics.lastBlePacket')} value={formatUptimeAge(diagnostics.lastPacketSeenUptimeMs)} />
            <DiagnosticRow label={t('hardware.metrics.battery')} value={formatNumber(diagnostics.lastBattery, '%', missing, 0)} />
            <DiagnosticRow label="RSSI" value={formatNumber(diagnostics.lastRssi, ' dBm', missing, 0)} />
          </TechnicalGroup>
          <TechnicalGroup title={t('hardware.diagnostics.groupShelly')} description={t('hardware.diagnostics.groupShellyHint')}>
            <DiagnosticRow label={t('hardware.metrics.power')} value={formatNumber(plug?.powerW, ' W', missing, 1)} />
            <DiagnosticRow label={t('hardware.metrics.voltage')} value={formatNumber(plug?.voltageV, ' V', missing, 0)} />
            <DiagnosticRow label={t('hardware.metrics.current')} value={formatNumber(plug?.currentA, ' A', missing, 2)} />
            <DiagnosticRow label={t('hardware.metrics.energy')} value={formatEnergy(plug?.energyWh, missing)} />
            <DiagnosticRow label={t('hardware.metrics.plugTemperature')} value={formatNumber(plug?.deviceTemperatureC, '°C', missing, 1)} />
            <DiagnosticRow label={t('hardware.diagnostics.deviceRamFree')} value={formatBytes(resources?.system?.ramFreeBytes, missing)} />
            <DiagnosticRow label={t('hardware.diagnostics.deviceRamTotal')} value={formatBytes(resources?.system?.ramSizeBytes, missing)} />
            <DiagnosticRow label={t('hardware.metrics.clockShelly')} value={snapshot.time.localTime ?? missing} />
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
EOF

python3 - <<'PY'
from pathlib import Path

p = Path('apps/mobile/src/screens/InstallationDetailScreen.tsx')
s = p.read_text()
def rep(old, new, label):
    global s
    n=s.count(old)
    if n != 1: raise SystemExit(f'{label}: expected one match, got {n}')
    s=s.replace(old,new,1)
rep("import { ShellyLedSettingsCard } from './ShellyLedSettingsCard.js';\nimport { TimeInstallationDetail } from './TimeInstallationDetail.js';", "import { InstallationDiagnosticsModal } from './InstallationDiagnosticsModal.js';\nimport { InstallationRuntimeControls } from './InstallationRuntimeControls.js';\nimport { ShellyLedSettingsCard } from './ShellyLedSettingsCard.js';\nimport { TimeInstallationDetail } from './TimeInstallationDetail.js';", 'screen imports')
rep("  installedAutomationControlQueryKey,\n  installedAutomationDiagnosticsQueryKey,", "  installedAutomationControlQueryKey,\n  installedAutomationDiagnosticsQueryKey,\n  installedAutomationResourceDiagnosticsQueryKey,", 'resource key import')
rep("  const [deleteOpen, setDeleteOpen] = useState(false);\n  const [scriptOpen, setScriptOpen] = useState(false);", "  const [deleteOpen, setDeleteOpen] = useState(false);\n  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);\n  const [scriptOpen, setScriptOpen] = useState(false);", 'modal state')
rep("      queryClient.removeQueries({\n        queryKey: installedAutomationControlQueryKey(installation),\n        exact: true\n      });\n      queryClient.removeQueries({ queryKey: scriptQueryKey, exact: true });", "      queryClient.removeQueries({\n        queryKey: installedAutomationControlQueryKey(installation),\n        exact: true\n      });\n      queryClient.removeQueries({\n        queryKey: installedAutomationResourceDiagnosticsQueryKey(installation),\n        exact: true\n      });\n      queryClient.removeQueries({ queryKey: scriptQueryKey, exact: true });", 'delete cache cleanup')
old='''          <div className="installation-detail-actions installation-detail-mode-actions">
            <div
              className="automation-control-group installation-detail-mode-control"
              role="group"
              aria-label={t('detail.automation')}
            >
              <button
                className="automation-control-button"
                type="button"
                aria-pressed={control?.automationMode === 'auto'}
                disabled={
                  !canToggleAutomation ||
                  automationAction.isPending ||
                  deleteMutation.isPending
                }
                onClick={() => {
                  if (isPaused) {
                    automationAction.mutate('auto', {
                      onSuccess: () => pushToast('ok', t('detail.resumeSuccess'))
                    });
                  }
                }}
              >
                AUTO
              </button>
              <button
                className="automation-control-button"
                type="button"
                aria-pressed={isPaused}
                disabled={
                  !canToggleAutomation ||
                  automationAction.isPending ||
                  deleteMutation.isPending
                }
                onClick={() => {
                  if (control?.automationMode === 'auto') {
                    automationAction.mutate('manual', {
                      onSuccess: () => pushToast('ok', t('detail.pauseSuccess'))
                    });
                  }
                }}
              >
                MANUAL
              </button>
            </div>
            <button
              className="secondary-action secondary-action--danger"
              type="button"
              disabled={automationAction.isPending || deleteMutation.isPending}
              onClick={() => setDeleteOpen(true)}
            >
              {deleteCopy.action}
            </button>
          </div>'''
new='''          <InstallationRuntimeControls
            actionBusy={automationAction.isPending}
            automationMode={control?.automationMode ?? null}
            canToggleAutomation={canToggleAutomation}
            deleteBusy={deleteMutation.isPending}
            deleteLabel={deleteCopy.action}
            relayState={relayState}
            onAuto={() => {
              if (isPaused) {
                automationAction.mutate('auto', {
                  onSuccess: () => pushToast('ok', t('detail.resumeSuccess'))
                });
              }
            }}
            onManual={() => {
              if (control?.automationMode === 'auto') {
                automationAction.mutate('manual', {
                  onSuccess: () => pushToast('ok', t('detail.pauseSuccess'))
                });
              }
            }}
            onRelayOn={() => {
              if (relayState !== true) {
                automationAction.mutate('on', {
                  onError: () => pushToast('warning', t('detail.actionFailed'))
                });
              }
            }}
            onRelayOff={() => {
              if (relayState !== false) {
                automationAction.mutate('off', {
                  onError: () => pushToast('warning', t('detail.actionFailed'))
                });
              }
            }}
            onOpenDiagnostics={() => setDiagnosticsOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />'''
rep(old,new,'controls extraction')
rep("      <Modal\n        closeLabel={t('common.close')}\n        open={scriptOpen}", "      <InstallationDiagnosticsModal\n        installation={installation}\n        open={diagnosticsOpen}\n        onClose={() => setDiagnosticsOpen(false)}\n      />\n\n      <Modal\n        closeLabel={t('common.close')}\n        open={scriptOpen}", 'diagnostics modal')
p.write_text(s)

p=Path('apps/mobile/src/__tests__/automation-detail.test.tsx')
s=p.read_text()
def trep(old,new,label):
    global s
    n=s.count(old)
    if n != 1: raise SystemExit(f'{label}: expected one match, got {n}')
    s=s.replace(old,new,1)
trep("      case 'Script.GetCode':\n        result = { data: '// deployed exact source', left: 0 };\n        break;", "      case 'Script.GetCode':\n        result = { data: '// deployed exact source', left: 0 };\n        break;\n      case 'Script.GetStatus':\n        result = { running: scriptRunning, mem_used: 2660, mem_peak: 6804, mem_free: 22442, cpu: 15.2 };\n        break;\n      case 'Sys.GetStatus':\n        result = { ram_size: 259128, ram_free: 90000 };\n        break;", 'resource mocks')
trep("    const auto = screen.getByRole('button', { name: 'AUTO' });\n    const manual = screen.getByRole('button', { name: 'MANUAL' });\n    await waitFor(() => expect(auto).toHaveAttribute('aria-pressed', 'true'));", "    const automationCard = screen.getByRole('heading', { name: 'Automatyka' }).closest('article');\n    expect(automationCard).not.toBeNull();\n    const auto = within(automationCard!).getByRole('button', { name: 'AUTO' });\n    const manual = within(automationCard!).getByRole('button', { name: 'MANUAL' });\n    const relayOnButton = within(automationCard!).getByRole('button', { name: 'ON' });\n    const relayOffButton = within(automationCard!).getByRole('button', { name: 'OFF' });\n    await waitFor(() => expect(auto).toHaveAttribute('aria-pressed', 'true'));\n    expect(relayOnButton).toBeDisabled();\n    expect(relayOffButton).toBeDisabled();", 'control lookup')
trep("    await waitFor(() => expect(manual).toHaveAttribute('aria-pressed', 'true'));\n    expect(screen.queryByRole('heading', { name: 'Skrypt zatrzymany' })).toBeNull();", "    await waitFor(() => expect(manual).toHaveAttribute('aria-pressed', 'true'));\n    await waitFor(() => expect(relayOnButton).toBeEnabled());\n    expect(relayOffButton).toBeEnabled();\n    expect(relayOffButton).toHaveAttribute('aria-pressed', 'true');\n    fireEvent.click(relayOnButton);\n    await waitFor(() => expect(relayOnButton).toHaveAttribute('aria-pressed', 'true'));\n    fireEvent.click(relayOffButton);\n    await waitFor(() => expect(relayOffButton).toHaveAttribute('aria-pressed', 'true'));\n    expect(screen.queryByRole('heading', { name: 'Skrypt zatrzymany' })).toBeNull();", 'relay behavior')
marker="  it('shows the current deployed script for the saved climate automation', async () => {"
test='''  it('opens scoped technical diagnostics without duplicating the installation summary', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    const { rpcMethods } = installShellyFetchMock();
    renderDetail(saved.id);
    expect(await screen.findByText('21.4°C')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Diagnostyka' }));
    const dialog = await screen.findByRole('dialog', { name: 'Diagnostyka · Salon' });
    expect(await within(dialog).findByText('JS użyte teraz')).toBeVisible();
    expect(within(dialog).getByText('CPU skryptu')).toBeVisible();
    expect(within(dialog).getByText('RAM Shelly wolny')).toBeVisible();
    expect(within(dialog).getByText('Bateria')).toBeVisible();
    expect(within(dialog).getByText('RSSI')).toBeVisible();
    expect(within(dialog).queryByText('Temperatura', { exact: true })).toBeNull();
    expect(within(dialog).queryByText('Wilgotność', { exact: true })).toBeNull();
    expect(within(dialog).queryByText('VPD', { exact: true })).toBeNull();
    expect(within(dialog).queryByText('Aktywne progi ON / OFF', { exact: true })).toBeNull();
    expect(within(dialog).queryByText('Wyjście', { exact: true })).toBeNull();
    await waitFor(() => expect(rpcMethods).toContain('Script.GetStatus'));
    expect(rpcMethods).toContain('Sys.GetStatus');
    const before = rpcMethods.filter((method) => method === 'Script.GetStatus').length;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Odśwież' }));
    await waitFor(() => expect(rpcMethods.filter((method) => method === 'Script.GetStatus').length).toBeGreaterThan(before));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    expect(screen.queryByRole('dialog', { name: 'Diagnostyka · Salon' })).toBeNull();
  });

'''
if s.count(marker)!=1: raise SystemExit('diagnostics test marker mismatch')
s=s.replace(marker,test+marker,1)
p.write_text(s)

p=Path('docs/HANDOFF_NEXT_CHAT.md')
s=p.read_text()
section='''\n\n## Installation detail controls + scoped diagnostics (2026-09-11)\n\nCurrent feature branch: `work/installation-controls-diagnostics-20260911`.\n\nThis tranche adds verified MANUAL-only relay `ON/OFF` to the climate installation detail by reusing the existing `useInstalledAutomationActions` / `setInstalledAutomationRelayState` safety path. It also adds a direct installation-scoped `Diagnostyka` modal.\n\nThe modal intentionally omits the normal summary data already visible on the detail cards (climate temperature/humidity/VPD, thresholds and output summary). It shows technical runtime/resource, BLE freshness/battery/RSSI and Shelly electrical/device telemetry. Resource data reuses `readShellyResourceDiagnostics` (`Script.GetStatus` + `Sys.GetStatus`) and the existing `/script/<id>/diag` query.\n\nDiagnostics uses a 3-second refresh interval only while the modal observer is enabled, with `refetchIntervalInBackground: false`; manual refresh remains available. The generic 30-second dashboard/detail polling remains unchanged. LED configuration is explicitly out of scope for this tranche.\n'''
if '## Installation detail controls + scoped diagnostics (2026-09-11)' in s: raise SystemExit('handoff section already exists')
p.write_text(s.rstrip()+section)
PY

pnpm exec prettier --write apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts apps/mobile/src/screens/InstallationRuntimeControls.tsx apps/mobile/src/screens/InstallationDiagnosticsModal.tsx apps/mobile/src/screens/InstallationDetailScreen.tsx apps/mobile/src/__tests__/automation-detail.test.tsx docs/HANDOFF_NEXT_CHAT.md

echo '=== SCOPE AUDIT ==='
test -z "$(git diff --name-only "$BASE" -- apps/mobile/src/screens/ShellyLedSettingsCard.tsx packages/shelly-client/src/plugsUi.ts)"
if git grep -n -E 'lastTemp|lastHumidity|lastVpd|lastEffectiveOnThreshold|lastEffectiveOffThreshold|relayState' -- apps/mobile/src/screens/InstallationDiagnosticsModal.tsx; then
  echo 'diagnostics modal duplicates primary summary data' >&2
  exit 31
fi
grep -q 'INSTALLATION_DIAGNOSTICS_REFRESH_MS = 3_000' apps/mobile/src/screens/InstallationDiagnosticsModal.tsx
grep -q 'refetchIntervalInBackground: false' apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts
grep -q 'readShellyResourceDiagnostics' apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts
grep -q "automationAction.mutate('on'" apps/mobile/src/screens/InstallationDetailScreen.tsx
grep -q "automationAction.mutate('off'" apps/mobile/src/screens/InstallationDetailScreen.tsx
git diff --check

echo '=== TARGETED TESTS ==='
pnpm --filter @lcl/mobile test -- resourceDiagnostics.test.ts automation-detail.test.tsx automation-dashboard-controls.test.tsx modal.test.tsx
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile lint
pnpm quality:ux
pnpm quality:repo

echo '=== FULL VALIDATION ==='
pnpm check:full

test -n "$(git status --porcelain)"
git add apps/mobile/src docs/HANDOFF_NEXT_CHAT.md
git commit -m 'feat(mobile): add installation controls and diagnostics'
git push -u origin "$BRANCH"

echo INSTALLATION_CONTROLS_DIAGNOSTICS_SHA=$(git rev-parse HEAD)
echo INSTALLATION_CONTROLS_DIAGNOSTICS_BRANCH=$BRANCH
echo INSTALLATION_CONTROLS_DIAGNOSTICS_OK=1

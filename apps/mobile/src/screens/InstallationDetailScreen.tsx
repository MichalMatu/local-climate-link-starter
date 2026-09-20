import { ClimateAutomationManagementActions } from '../features/automations/index.js';
import { isSameShellyDevice } from '../features/plugs/index.js';
import { FeedbackPanel, Modal, type ToastMessage, type ToastTone } from '@lcl/ui';
import { IconCode } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import type { AppNavigationKind } from '../components/AppBottomNavigation.js';
import { AppPageBack } from '../components/AppPageBack.js';
import { AppToastViewport } from '../components/AppToastViewport.js';
import { EditablePlugName } from '../components/EditablePlugName.js';
import { installationDeleteCopy } from '../app/locales/installationDelete.js';
import { installationHealthCopy } from '../app/locales/installationHealth.js';
import { installationScriptPreviewCopy } from '../app/locales/installationScriptPreview.js';
import type { ClimateInstalledAutomation } from '../flows/installations/model.js';
import { installationRecoveryState } from '../flows/installations/healthRecovery.js';
import {
  formatBleDataState,
  formatDiagnosticNumber,
  formatDiagnosticReason,
  formatDiagnosticUptimeAge,
  formatRelayState
} from '../flows/installations/diagnosticPresentation.js';
import { INSTALLATION_MODE_KEYS } from '../flows/installations/presentation.js';
import { installedAutomationHealth } from '../flows/installations/runtimeDiagnostics.js';
import {
  deleteInstalledAutomation,
  installedAutomationScriptMatch
} from '../flows/installations/runtimeControl.js';
import { installedAutomationScriptSourceQueryKey } from '../flows/installations/scriptPreview.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import { useHardwareSetupDraftStore } from '../flows/hardware-setup/setupDraftStore.js';
import { ShellyLedSettingsCard } from './ShellyLedSettingsCard.js';
import { TimeInstallationDetail } from './TimeInstallationDetail.js';
import {
  installedAutomationControlQueryKey,
  installedAutomationDiagnosticsQueryKey,
  installedAutomationResourceDiagnosticsQueryKey,
  useInstalledAutomationActions,
  useInstalledAutomationControl,
  useInstalledAutomationDiagnostics
} from '../flows/installations/useInstalledAutomationRuntime.js';

type InstallationDetailScreenProps = {
  installationId: string;
  onBack(): void;
  onNavigateDashboard?: (kind: AppNavigationKind) => void;
  onOpenSettings?: () => void;
  onOpenDiagnostics?: () => void;
  onOpenScript?: () => void;
  onEdit?: () => void;
};

export const InstallationDetailScreen = ({
  installationId,
  onBack,
  onOpenDiagnostics,
  onOpenScript,
  onEdit
}: InstallationDetailScreenProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const installation = useInstalledAutomationStore((state) =>
    state.installations.find((candidate) => candidate.id === installationId)
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string) => {
    toastIdRef.current += 1;
    setToasts((current) => [
      ...current.slice(-2),
      { id: `installation-toast-${toastIdRef.current}`, tone, title }
    ]);
  }, []);

  if (!installation) {
    return (
      <main className="demo-shell installation-detail-shell">
        <AppPageBack label={t('dashboard.climateTab')} onBack={onBack} />
        <section className="automation-card installation-detail-identity">
          <div className="installation-detail-identity__copy">
            <h1>{t('detail.notFoundTitle')}</h1>
            <p className="installation-detail-note">{t('detail.notFoundDescription')}</p>
          </div>
        </section>
      </main>
    );
  }

  if (installation.kind === 'time') {
    return (
      <TimeInstallationDetail
        installation={installation}
        onBack={onBack}
        {...(onEdit ? { onEdit } : {})}
      />
    );
  }

  return (
    <InstalledAutomationDetail
      installation={installation}
      onBack={onBack}
      pushToast={pushToast}
      dismissToast={dismissToast}
      toasts={toasts}
      queryClient={queryClient}
      {...(onOpenDiagnostics ? { onOpenDiagnostics } : {})}
      {...(onOpenScript ? { onOpenScript } : {})}
      {...(onEdit ? { onEdit } : {})}
    />
  );
};

type InstalledAutomationDetailProps = {
  installation: ClimateInstalledAutomation;
  onBack(): void;
  pushToast(tone: ToastTone, title: string): void;
  dismissToast(id: string): void;
  toasts: ToastMessage[];
  queryClient: ReturnType<typeof useQueryClient>;
  onNavigateDashboard?: (kind: AppNavigationKind) => void;
  onOpenSettings?: () => void;
  onOpenDiagnostics?: () => void;
  onOpenScript?: () => void;
  onEdit?: () => void;
};

const InstalledAutomationDetail = ({
  installation,
  onBack,
  pushToast,
  dismissToast,
  toasts,
  queryClient,
  onOpenDiagnostics,
  onOpenScript,
  onEdit
}: InstalledAutomationDetailProps) => {
  const { locale, t } = useTranslation();
  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation);
  const controlQuery = useInstalledAutomationControl(installation);
  const automationAction = useInstalledAutomationActions(installation);
  const removeInstallation = useInstalledAutomationStore(
    (state) => state.removeInstallation
  );
  const renameShellyDevice = useInstalledAutomationStore(
    (state) => state.renameShellyDevice
  );
  const shellyDevices = useHardwareSetupDraftStore((state) => state.shellyDevices);
  const setShellyDeviceName = useHardwareSetupDraftStore(
    (state) => state.setShellyDeviceName
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteCopy = installationDeleteCopy[locale];
  const scriptCopy = installationScriptPreviewCopy[locale];
  const scriptQueryKey = installedAutomationScriptSourceQueryKey(installation);
  const snapshot = diagnosticsQuery.isSuccess ? diagnosticsQuery.data : undefined;
  const control = controlQuery.data;
  const scriptMatch = control
    ? installedAutomationScriptMatch(installation, control)
    : null;
  const runtimeHealth = snapshot ? installedAutomationHealth(snapshot) : null;
  const recovery = installationRecoveryState({
    diagnosticsError: diagnosticsQuery.isError,
    controlError: controlQuery.isError,
    scriptMatch,
    automationMode: control?.automationMode ?? null,
    runtimeHealth
  });
  const visibleRecovery = recovery;
  const recoveryCopy = visibleRecovery
    ? installationHealthCopy[locale].issues[visibleRecovery.issue]
    : null;

  const deleteMutation = useMutation({
    mutationFn: () => deleteInstalledAutomation(installation),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: installedAutomationDiagnosticsQueryKey(installation),
        exact: true
      });
      queryClient.removeQueries({
        queryKey: installedAutomationControlQueryKey(installation),
        exact: true
      });
      queryClient.removeQueries({
        queryKey: installedAutomationResourceDiagnosticsQueryKey(installation),
        exact: true
      });
      queryClient.removeQueries({ queryKey: scriptQueryKey, exact: true });
      removeInstallation(installation.id);
      setDeleteOpen(false);
      onBack();
    },
    onError: () => pushToast('warning', deleteCopy.failed)
  });

  const refreshAll = async () => {
    await Promise.allSettled([diagnosticsQuery.refetch(), controlQuery.refetch()]);
  };

  const missing = t('common.missing');
  const diagnostics = snapshot?.diagnostics;
  const shellyRelayState = snapshot?.plug?.relayState ?? control?.relayOn;
  const diagnosticSensorLabel =
    snapshot?.sensor?.displayName ??
    snapshot?.sensor?.runtimeAddress ??
    installation.config.sensor.displayName ??
    installation.config.sensor.runtimeAddress ??
    missing;
  const purposeLabel =
    installation.config.rule.control.metric === 'humidity'
      ? t('intent.humidity.context')
      : t('intent.temperature.context');
  const renamePlug = (value: string) => {
    renameShellyDevice(installation.shelly.deviceId, value);
    const savedDevice = shellyDevices.find((device) =>
      isSameShellyDevice(device.id, installation.shelly.deviceId)
    );
    if (savedDevice) {
      setShellyDeviceName(savedDevice.id, value);
    }
  };

  return (
    <main className="demo-shell installation-detail-shell">
      <section className="installation-detail-grid" aria-label={t('detail.currentState')}>
        <article className="automation-card installation-detail-identity">
          <div className="installation-detail-identity__copy">
            <EditablePlugName
              name={installation.shelly.name}
              variant="detail"
              onCommit={renamePlug}
            />
            <p className="installation-detail-purpose">{purposeLabel}</p>
          </div>
        </article>

        {visibleRecovery && recoveryCopy && (
          <article className="automation-card installation-detail-recovery" role="status">
            <div className="installation-section-heading">
              <div>
                <p className="automation-card__eyebrow">
                  {installationHealthCopy[locale].eyebrow}
                </p>
                <h2>{recoveryCopy.title}</h2>
              </div>
            </div>
            <p className="installation-detail-note">{recoveryCopy.description}</p>
            <div className="installation-detail-actions">
              <button
                className={
                  visibleRecovery.action === 'resume'
                    ? 'primary-action'
                    : 'secondary-action'
                }
                type="button"
                disabled={
                  visibleRecovery.action === 'resume'
                    ? automationAction.isPending
                    : diagnosticsQuery.isFetching || controlQuery.isFetching
                }
                onClick={() => {
                  if (visibleRecovery.action === 'resume') {
                    automationAction.mutate('recover', {
                      onSuccess: () => pushToast('ok', t('detail.resumeSuccess'))
                    });
                    return;
                  }
                  void refreshAll();
                }}
              >
                {visibleRecovery.action === 'resume' && automationAction.isPending
                  ? t('detail.changingState')
                  : visibleRecovery.action === 'refresh' &&
                      (diagnosticsQuery.isFetching || controlQuery.isFetching)
                    ? t('common.refreshing')
                    : recoveryCopy.action}
              </button>
            </div>
          </article>
        )}

        <article className="automation-card installation-detail-config">
          <div className="installation-section-heading">
            <h2>{t('detail.automation')}</h2>
            <button
              aria-label={scriptCopy.action}
              className="icon-action"
              disabled={scriptMatch !== 'matched' || deleteMutation.isPending}
              title={scriptCopy.action}
              type="button"
              onClick={() => onOpenScript?.()}
            >
              <IconCode className="icon-action__svg" aria-hidden="true" />
            </button>
          </div>
          <dl className="automation-summary installation-detail-summary">
            <div>
              <dt>{t('hardware.metrics.mode')}</dt>
              <dd>{t(INSTALLATION_MODE_KEYS[installation.config.rule.mode])}</dd>
            </div>
            <div>
              <dt>{t('hardware.metrics.reason')}</dt>
              <dd>
                {diagnostics
                  ? formatDiagnosticReason(diagnostics.lastReason, t)
                  : missing}
              </dd>
            </div>
            <div>
              <dt>{t('hardware.metrics.relayRule')}</dt>
              <dd>{formatRelayState(diagnostics?.relayState, missing)}</dd>
            </div>
            <div>
              <dt>{t('hardware.metrics.shellyRelay')}</dt>
              <dd>{formatRelayState(shellyRelayState, missing)}</dd>
            </div>
          </dl>
        </article>

        <article className="automation-card installation-detail-sensor">
          <div className="installation-section-heading">
            <h2>{t('hardware.diagnostics.groupSensor')}</h2>
          </div>
          <dl className="automation-summary installation-detail-summary">
            <div>
              <dt>{t('hardware.metrics.thermometer')}</dt>
              <dd>{diagnosticSensorLabel}</dd>
            </div>
            <div>
              <dt>{t('hardware.metrics.lastMeasurement')}</dt>
              <dd>
                {formatDiagnosticUptimeAge(
                  diagnostics?.lastSeenUptimeMs,
                  snapshot?.time.uptimeSec,
                  missing,
                  t
                )}
              </dd>
            </div>
            <div>
              <dt>{t('hardware.metrics.lastBlePacket')}</dt>
              <dd>
                {formatDiagnosticUptimeAge(
                  diagnostics?.lastPacketSeenUptimeMs,
                  snapshot?.time.uptimeSec,
                  missing,
                  t
                )}
              </dd>
            </div>
            <div>
              <dt>{t('hardware.metrics.battery')}</dt>
              <dd>{formatDiagnosticNumber(diagnostics?.lastBattery, '%', missing, 0)}</dd>
            </div>
            <div>
              <dt>RSSI</dt>
              <dd>{formatDiagnosticNumber(diagnostics?.lastRssi, ' dBm', missing, 0)}</dd>
            </div>
            <div>
              <dt>{t('hardware.metrics.dataBle')}</dt>
              <dd>{diagnostics ? formatBleDataState(diagnostics, t) : missing}</dd>
            </div>
          </dl>
        </article>

        <article className="automation-card installation-detail-shelly">
          <div className="installation-section-heading">
            <h2>{t('hardware.diagnostics.groupShelly')}</h2>
          </div>
          <dl className="automation-summary installation-detail-summary">
            <div>
              <dt>{t('hardware.metrics.current')}</dt>
              <dd>
                {formatDiagnosticNumber(snapshot?.plug?.currentA, ' A', missing, 2)}
              </dd>
            </div>
            <div>
              <dt>{t('hardware.metrics.plugTemperature')}</dt>
              <dd>
                {formatDiagnosticNumber(
                  snapshot?.plug?.deviceTemperatureC,
                  '°C',
                  missing,
                  1
                )}
              </dd>
            </div>
            <div>
              <dt>{t('hardware.shelly.clockSync')}</dt>
              <dd>
                {snapshot
                  ? snapshot.time.isSynced
                    ? 'OK'
                    : t('hardware.status.unsynced')
                  : missing}
              </dd>
            </div>
          </dl>
        </article>

        <ClimateAutomationManagementActions
          editLabel={t('detail.edit')}
          diagnosticsLabel={t('common.diagnostics')}
          deleteLabel={deleteCopy.action}
          deletePending={deleteMutation.isPending}
          onEdit={onEdit}
          onDiagnostics={onOpenDiagnostics}
          onDelete={() => setDeleteOpen(true)}
        />

        <ShellyLedSettingsCard installation={installation} onFeedback={pushToast} />
      </section>

      <Modal
        actions={
          <button
            className="secondary-action secondary-action--danger"
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? deleteCopy.busy : t('common.confirmDelete')}
          </button>
        }
        busy={deleteMutation.isPending}
        closeLabel={t('common.close')}
        open={deleteOpen}
        title={deleteCopy.title}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteOpen(false);
          }
        }}
      >
        <FeedbackPanel tone="warning" title={deleteCopy.action}>
          {deleteCopy.detail}
        </FeedbackPanel>
      </Modal>

      <AppToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </main>
  );
};

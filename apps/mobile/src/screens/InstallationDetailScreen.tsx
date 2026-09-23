import { climateSensorsForConfig } from '@lcl/script-generator';
import { FeedbackPanel, Modal, type ToastMessage, type ToastTone } from '@lcl/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { installationDeleteCopy } from '../app/locales/installationDelete.js';
import { installationHealthCopy } from '../app/locales/installationHealth.js';
import { installationScriptPreviewCopy } from '../app/locales/installationScriptPreview.js';
import { useTranslation } from '../app/i18n.js';
import { AppPageBack } from '../components/AppPageBack.js';
import { AppToastViewport } from '../components/AppToastViewport.js';
import {
  ClimateAutomationDetailSection,
  ClimateRecoverySection,
  ClimateBleDetailSection,
  ClimateScriptDetailSection,
  ClimateScriptDiagnosticsSection
} from '../features/automations/index.js';
import {
  PlugButtonModeSettingsCard,
  PlugCloudSettingsCard,
  PlugDeleteConfirmModal,
  PlugDetailTabs,
  PlugInfoPanel,
  PlugLedSettingsCard,
  isSameShellyDevice,
  usePlugInformationFlow,
  type PlugDetailTab
} from '../features/plugs/index.js';
import { installationRecoveryState } from '../flows/installations/healthRecovery.js';
import {
  formatClimateDetailDiagnostics,
  formatDiagnosticReason,
  formatRelayState
} from '../flows/installations/diagnosticPresentation.js';
import type { ClimateInstalledAutomation } from '../flows/installations/model.js';
import { installedAutomationHealth } from '../flows/installations/runtimeDiagnostics.js';
import {
  deleteInstalledAutomation,
  installedAutomationScriptMatch
} from '../flows/installations/runtimeControl.js';
import {
  copyInstalledAutomationScriptSource,
  installedAutomationScriptSourceQueryKey,
  useInstalledAutomationScriptSource
} from '../flows/installations/scriptPreview.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import {
  installedAutomationControlQueryKey,
  installedAutomationDiagnosticsQueryKey,
  installedAutomationResourceDiagnosticsQueryKey,
  useInstalledAutomationActions,
  useInstalledAutomationControl,
  useInstalledAutomationDiagnostics,
  useInstalledAutomationResourceDiagnostics
} from '../flows/installations/useInstalledAutomationRuntime.js';
import { useHardwareSetupDraftStore } from '../flows/hardware-setup/setupDraftStore.js';
import { useHardwareSetupFlow } from '../flows/hardware-setup/useHardwareSetupFlow.js';
import { RuleSetupPage } from './hardware-setup/pages/RuleSetupPage.js';
import { TimeInstallationDetail } from './TimeInstallationDetail.js';

const TECHNICAL_DIAGNOSTICS_REFRESH_MS = 3_000;

type InstallationDetailScreenProps = {
  installationId: string;
  onBack(): void;
  onOpenBleDiscovery?: (deviceId: string) => void;
  onEdit?: () => void;
};

export const InstallationDetailScreen = ({
  installationId,
  onBack,
  onOpenBleDiscovery,
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
          <h1>{t('detail.notFoundTitle')}</h1>
          <p className="installation-detail-note">{t('detail.notFoundDescription')}</p>
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
    <ClimateInstallationDetail
      installation={installation}
      onBack={onBack}
      pushToast={pushToast}
      dismissToast={dismissToast}
      toasts={toasts}
      queryClient={queryClient}
      {...(onOpenBleDiscovery ? { onOpenBleDiscovery } : {})}
    />
  );
};

type ClimateInstallationDetailProps = {
  installation: ClimateInstalledAutomation;
  onBack(): void;
  pushToast(tone: ToastTone, title: string): void;
  dismissToast(id: string): void;
  toasts: ToastMessage[];
  queryClient: ReturnType<typeof useQueryClient>;
  onOpenBleDiscovery?: (deviceId: string) => void;
};

const ClimateInstallationDetail = ({
  installation,
  onBack,
  pushToast,
  dismissToast,
  toasts,
  queryClient,
  onOpenBleDiscovery
}: ClimateInstallationDetailProps) => {
  const { locale, t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PlugDetailTab>('automation');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [forgetOpen, setForgetOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [preparedAutomationDraftId, setPreparedAutomationDraftId] = useState<
    string | null
  >(null);
  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation);
  const controlQuery = useInstalledAutomationControl(installation);
  const automationAction = useInstalledAutomationActions(installation);
  const resourcesQuery = useInstalledAutomationResourceDiagnostics(installation, {
    enabled: activeTab === 'info',
    refetchInterval: TECHNICAL_DIAGNOSTICS_REFRESH_MS
  });
  const informationQuery = usePlugInformationFlow(installation.shelly, {
    enabled: activeTab === 'ble' || activeTab === 'info'
  });
  const removeInstallation = useInstalledAutomationStore(
    (state) => state.removeInstallation
  );
  const automationEditFlow = useHardwareSetupFlow(installation.id);
  const shellyDevices = useHardwareSetupDraftStore((state) => state.shellyDevices);
  const loadClimateAutomationDraft = useHardwareSetupDraftStore(
    (state) => state.loadClimateAutomationDraft
  );
  const removeShellyDevice = useHardwareSetupDraftStore(
    (state) => state.removeShellyDevice
  );
  const savedDevice = shellyDevices.find((device) =>
    isSameShellyDevice(device.id, installation.shelly.deviceId)
  );

  const deleteCopy = installationDeleteCopy[locale];
  const scriptCopy = installationScriptPreviewCopy[locale];
  const scriptQueryKey = installedAutomationScriptSourceQueryKey(installation);
  const snapshot = diagnosticsQuery.isSuccess ? diagnosticsQuery.data : undefined;
  const diagnostics = snapshot?.diagnostics;
  const control = controlQuery.data;
  const scriptMatch = control
    ? installedAutomationScriptMatch(installation, control)
    : null;
  const recovery = installationRecoveryState({
    diagnosticsError: diagnosticsQuery.isError,
    controlError: controlQuery.isError,
    scriptMatch,
    automationMode: control?.automationMode ?? null,
    runtimeHealth: snapshot ? installedAutomationHealth(snapshot) : null
  });
  const recoveryCopy = recovery
    ? installationHealthCopy[locale].issues[recovery.issue]
    : null;
  const scriptQuery = useInstalledAutomationScriptSource(
    installation,
    activeTab === 'script' && scriptMatch === 'matched'
  );

  useEffect(() => {
    if (preparedAutomationDraftId === installation.id) return;
    loadClimateAutomationDraft(installation);
    setPreparedAutomationDraftId(installation.id);
  }, [installation, loadClimateAutomationDraft, preparedAutomationDraftId]);

  useEffect(() => {
    if (activeTab !== 'info') return undefined;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

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

  const missing = t('common.missing');
  const configuredSensors = climateSensorsForConfig(installation.config);
  const shellyRelayState = snapshot?.plug?.relayState ?? control?.relayOn;
  const resources = resourcesQuery.data;
  const { bleSensors, scriptRows } = formatClimateDetailDiagnostics({
    sensors: configuredSensors,
    snapshot,
    componentState: informationQuery.data?.status.scripts,
    resources,
    dataUpdatedAt: diagnosticsQuery.dataUpdatedAt,
    nowMs,
    missing,
    t
  });
  const automationHasChanges =
    automationEditFlow.configState.ok &&
    JSON.stringify(automationEditFlow.configState.config) !==
      JSON.stringify(installation.config);

  const copyScript = () =>
    copyInstalledAutomationScriptSource(
      scriptQuery.data,
      () => pushToast('ok', scriptCopy.copyDone),
      () => pushToast('warning', scriptCopy.copyFailed)
    );

  return (
    <main className="demo-shell installation-detail-shell">
      <PlugDetailTabs activeTab={activeTab} onChange={setActiveTab} />

      <section className="plug-detail-surface" aria-label={t('detail.currentState')}>
        {activeTab === 'automation' && (
          <>
            {recovery && recoveryCopy && (
              <ClimateRecoverySection
                title={recoveryCopy.title}
                description={recoveryCopy.description}
                actionLabel={
                  recovery.action === 'resume' && automationAction.isPending
                    ? t('detail.changingState')
                    : recovery.action === 'refresh' &&
                        (diagnosticsQuery.isFetching || controlQuery.isFetching)
                      ? t('common.refreshing')
                      : recoveryCopy.action
                }
                primary={recovery.action === 'resume'}
                busy={
                  recovery.action === 'resume'
                    ? automationAction.isPending
                    : diagnosticsQuery.isFetching || controlQuery.isFetching
                }
                onAction={() => {
                  if (recovery.action === 'resume') {
                    automationAction.mutate('recover', {
                      onSuccess: () => pushToast('ok', t('detail.resumeSuccess'))
                    });
                  } else {
                    void Promise.allSettled([
                      diagnosticsQuery.refetch(),
                      controlQuery.refetch()
                    ]);
                  }
                }}
              />
            )}
            <ClimateAutomationDetailSection
              reason={
                diagnostics ? formatDiagnosticReason(diagnostics.lastReason, t) : missing
              }
              relayRule={formatRelayState(diagnostics?.relayState, missing)}
              shellyRelay={formatRelayState(shellyRelayState, missing)}
            />
            {preparedAutomationDraftId === installation.id ? (
              <RuleSetupPage
                flow={automationEditFlow}
                showShellySelector={false}
                inline
                canSubmit={automationHasChanges}
              />
            ) : (
              <div
                className="plug-detail-loading plug-detail-loading--section"
                role="status"
              >
                <span className="plug-detail-loading__spinner" aria-hidden="true" />
                <span>{t('app.loadingConfigurator')}</span>
              </div>
            )}
            <div className="installation-detail-delete-action">
              <button
                className="secondary-action secondary-action--danger"
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteOpen(true)}
              >
                {deleteCopy.action}
              </button>
            </div>
          </>
        )}

        {activeTab === 'ble' && (
          <ClimateBleDetailSection
            sensors={bleSensors}
            {...(informationQuery.data?.status.bluetooth === 'enabled'
              ? { bluetoothState: t('common.enabled') }
              : informationQuery.data?.status.bluetooth === 'disabled'
                ? { bluetoothState: t('common.disabled') }
                : {})}
            {...(onOpenBleDiscovery
              ? { onScan: () => onOpenBleDiscovery(installation.shelly.deviceId) }
              : {})}
          />
        )}

        {activeTab === 'device' && (
          <div className="plug-settings-surface">
            <PlugLedSettingsCard target={installation.shelly} />
            <PlugButtonModeSettingsCard target={installation.shelly} />
            <PlugCloudSettingsCard target={installation.shelly} />
          </div>
        )}

        {activeTab === 'script' && (
          <ClimateScriptDetailSection
            attentionTitle={t('dashboard.health.attention')}
            {...(scriptMatch !== 'matched'
              ? { attentionMessage: t('detail.scriptNeedsAttention') }
              : {})}
            copyAriaLabel={scriptCopy.copy}
            copyLabel={scriptCopy.copy}
            error={scriptQuery.isError}
            errorTitle={scriptCopy.failed}
            loading={scriptMatch === 'matched' && scriptQuery.isPending}
            loadingLabel={scriptCopy.loading}
            previewLabel={scriptCopy.label}
            retryLabel={scriptCopy.retry}
            {...(scriptQuery.data !== undefined ? { source: scriptQuery.data } : {})}
            onCopy={copyScript}
            onRetry={() => void scriptQuery.refetch()}
          />
        )}

        {activeTab === 'info' && (
          <section>
            <PlugInfoPanel
              target={installation.shelly}
              information={informationQuery.data}
              loading={informationQuery.isPending}
              error={informationQuery.isError}
              deviceRamFreeBytes={resources?.system?.ramFreeBytes}
              deviceRamTotalBytes={resources?.system?.ramSizeBytes}
              title={t('hardware.nav.shelly')}
            />
            <ClimateScriptDiagnosticsSection
              title={t('common.diagnostics')}
              rows={scriptRows}
            />
            {savedDevice && (
              <div className="installation-detail-delete-action">
                <button
                  className="secondary-action secondary-action--danger"
                  type="button"
                  onClick={() => setForgetOpen(true)}
                >
                  {t('hardware.shelly.deleteTitle')}
                </button>
              </div>
            )}
          </section>
        )}
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
          if (!deleteMutation.isPending) setDeleteOpen(false);
        }}
      >
        <FeedbackPanel tone="warning" title={deleteCopy.action}>
          {deleteCopy.detail}
        </FeedbackPanel>
      </Modal>

      <PlugDeleteConfirmModal
        deviceName={forgetOpen && savedDevice ? savedDevice.name : null}
        onClose={() => setForgetOpen(false)}
        onConfirm={() => {
          if (!savedDevice) return;
          removeShellyDevice(savedDevice.id);
          setForgetOpen(false);
          pushToast('ok', t('hardware.shelly.removed'));
        }}
      />

      <AppToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </main>
  );
};

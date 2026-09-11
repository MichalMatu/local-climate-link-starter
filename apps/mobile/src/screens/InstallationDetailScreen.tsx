import {
  FeedbackPanel,
  Modal,
  ScriptPreview,
  ToastViewport,
  type ToastMessage,
  type ToastTone
} from '@lcl/ui';
import { IconCode } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import {
  AppBottomNavigation,
  type AppNavigationKind
} from '../components/AppBottomNavigation.js';
import { installationDeleteCopy } from '../app/locales/installationDelete.js';
import { installationHealthCopy } from '../app/locales/installationHealth.js';
import { installationScriptPreviewCopy } from '../app/locales/installationScriptPreview.js';
import type { ClimateInstalledAutomation } from '../flows/installations/model.js';
import { installationRecoveryState } from '../flows/installations/healthRecovery.js';
import {
  formatInstallationMetric,
  INSTALLATION_MODE_KEYS,
  installationThresholdSummary
} from '../flows/installations/presentation.js';
import { installedAutomationHealth } from '../flows/installations/runtimeDiagnostics.js';
import {
  deleteInstalledAutomation,
  installedAutomationScriptMatch
} from '../flows/installations/runtimeControl.js';
import {
  installedAutomationScriptSourceQueryKey,
  loadInstalledAutomationScriptSource
} from '../flows/installations/scriptPreview.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import { InstallationDiagnosticsModal } from './InstallationDiagnosticsModal.js';
import { InstallationRuntimeControls } from './InstallationRuntimeControls.js';
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
};

const configuredThresholdSummary = (installation: ClimateInstalledAutomation) =>
  installationThresholdSummary(installation);

export const InstallationDetailScreen = ({
  installationId,
  onBack,
  onNavigateDashboard,
  onOpenSettings
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
      <main className="demo-shell installation-detail-shell app-bottom-nav-shell">
        <header className="demo-header installation-detail-header">
          <div>
            <p className="demo-kicker">Local Climate Link</p>
            <h1>{t('detail.notFoundTitle')}</h1>
            <p>{t('detail.notFoundDescription')}</p>
          </div>
          <button className="secondary-action" type="button" onClick={onBack}>
            {t('detail.backToDashboard')}
          </button>
        </header>
      </main>
    );
  }

  if (installation.kind === 'time') {
    return <TimeInstallationDetail installation={installation} onBack={onBack} />;
  }

  return (
    <InstalledAutomationDetail
      installation={installation}
      onBack={onBack}
      pushToast={pushToast}
      dismissToast={dismissToast}
      toasts={toasts}
      queryClient={queryClient}
      {...(onNavigateDashboard ? { onNavigateDashboard } : {})}
      {...(onOpenSettings ? { onOpenSettings } : {})}
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
};

const InstalledAutomationDetail = ({
  installation,
  onBack,
  pushToast,
  dismissToast,
  toasts,
  queryClient,
  onNavigateDashboard,
  onOpenSettings
}: InstalledAutomationDetailProps) => {
  const { locale, t } = useTranslation();
  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation);
  const controlQuery = useInstalledAutomationControl(installation);
  const automationAction = useInstalledAutomationActions(installation);
  const removeInstallation = useInstalledAutomationStore(
    (state) => state.removeInstallation
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const deleteCopy = installationDeleteCopy[locale];
  const scriptCopy = installationScriptPreviewCopy[locale];
  const scriptQueryKey = installedAutomationScriptSourceQueryKey(installation);
  const scriptSourceQuery = useQuery({
    queryKey: scriptQueryKey,
    queryFn: () => loadInstalledAutomationScriptSource(installation),
    enabled: scriptOpen,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0
  });
  const snapshot = diagnosticsQuery.isSuccess ? diagnosticsQuery.data : undefined;
  const control = controlQuery.data;
  const scriptMatch = control
    ? installedAutomationScriptMatch(installation, control)
    : null;
  const isPaused = scriptMatch === 'matched' && control?.automationMode === 'manual';
  const canToggleAutomation =
    scriptMatch === 'matched' &&
    (control?.automationMode === 'auto' || control?.automationMode === 'manual');
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

  const closeScriptPreview = () => {
    setScriptOpen(false);
    queryClient.removeQueries({ queryKey: scriptQueryKey, exact: true });
  };

  const copyScriptSource = () => {
    const source = scriptSourceQuery.data;
    if (!source || typeof navigator === 'undefined' || !navigator.clipboard) {
      pushToast('warning', scriptCopy.copyFailed);
      return;
    }

    void navigator.clipboard
      .writeText(source)
      .then(() => pushToast('ok', scriptCopy.copyDone))
      .catch(() => pushToast('warning', scriptCopy.copyFailed));
  };

  const relayState =
    control?.relayOn ?? snapshot?.plug?.relayState ?? snapshot?.diagnostics.relayState;
  const purposeLabel =
    installation.config.rule.control.metric === 'humidity'
      ? t('intent.humidity.context')
      : t('intent.temperature.context');

  return (
    <main className="demo-shell installation-detail-shell app-bottom-nav-shell">
      <header className="demo-header installation-detail-header">
        <div>
          <h1>{installation.shelly.name}</h1>
          <p className="installation-detail-purpose">{purposeLabel}</p>
        </div>
      </header>

      <section className="installation-detail-grid" aria-label={t('detail.currentState')}>
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

        <article className="automation-card installation-detail-live">
          <div className="installation-section-heading">
            <h2>{t('detail.climateNow')}</h2>
          </div>

          <div className="automation-metrics" aria-label={t('dashboard.currentValues')}>
            <div>
              <span>{t('dashboard.temperature')}</span>
              <strong>
                {formatInstallationMetric(snapshot?.diagnostics.lastTemp, '°C')}
              </strong>
            </div>
            <div>
              <span>{t('dashboard.humidity')}</span>
              <strong>
                {formatInstallationMetric(snapshot?.diagnostics.lastHumidity, '%')}
              </strong>
            </div>
            <div>
              <span>{t('dashboard.vpd')}</span>
              <strong>
                {formatInstallationMetric(snapshot?.diagnostics.lastVpd, ' kPa', 2)}
              </strong>
            </div>
          </div>

          <dl className="automation-summary installation-detail-summary">
            <div>
              <dt>{t('dashboard.output')}</dt>
              <dd>{relayState == null ? '—' : relayState ? 'ON' : 'OFF'}</dd>
            </div>
            <div>
              <dt>{t('detail.activeThresholds')}</dt>
              <dd>
                {installationThresholdSummary(
                  installation,
                  snapshot?.diagnostics.lastEffectiveOnThreshold,
                  snapshot?.diagnostics.lastEffectiveOffThreshold
                )}
              </dd>
            </div>
          </dl>
        </article>

        <article className="automation-card installation-detail-config">
          <div className="installation-section-heading">
            <div>
              <h2>{t('detail.automation')}</h2>
            </div>
            <button
              aria-label={scriptCopy.action}
              className="icon-action"
              disabled={scriptMatch !== 'matched' || deleteMutation.isPending}
              title={scriptCopy.action}
              type="button"
              onClick={() => setScriptOpen(true)}
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
              <dt>{t('dashboard.thresholds')}</dt>
              <dd>{configuredThresholdSummary(installation)}</dd>
            </div>
            <div>
              <dt>{t('dashboard.sensor')}</dt>
              <dd>{installation.config.sensor.displayName}</dd>
            </div>
          </dl>

          <InstallationRuntimeControls
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
          />
        </article>

        <ShellyLedSettingsCard installation={installation} onFeedback={pushToast} />
      </section>

      <AppBottomNavigation
        activeKind="climate"
        onOpenClimate={() =>
          onNavigateDashboard ? onNavigateDashboard('climate') : onBack()
        }
        onOpenTime={() => (onNavigateDashboard ? onNavigateDashboard('time') : onBack())}
        {...(onOpenSettings ? { onOpenSettings } : {})}
      />

      <InstallationDiagnosticsModal
        installation={installation}
        open={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
      />

      <Modal
        closeLabel={t('common.close')}
        open={scriptOpen}
        size="workspace"
        title={scriptCopy.title}
        onClose={closeScriptPreview}
      >
        {scriptSourceQuery.isPending && (
          <p className="installation-detail-note" role="status">
            {scriptCopy.loading}
          </p>
        )}
        {scriptSourceQuery.isError && (
          <FeedbackPanel tone="danger" title={scriptCopy.failed}>
            <button
              className="secondary-action"
              type="button"
              onClick={() => void scriptSourceQuery.refetch()}
            >
              {scriptCopy.retry}
            </button>
          </FeedbackPanel>
        )}
        {scriptSourceQuery.isSuccess && (
          <ScriptPreview
            code={scriptSourceQuery.data}
            copyAriaLabel={scriptCopy.copy}
            copyLabel={scriptCopy.copy}
            label={scriptCopy.label}
            variant="fill"
            onCopy={copyScriptSource}
          />
        )}
      </Modal>

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

      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </main>
  );
};

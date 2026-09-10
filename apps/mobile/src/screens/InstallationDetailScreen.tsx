import { ToastViewport, type ToastMessage, type ToastTone } from '@lcl/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import { installationHealthCopy } from '../app/locales/installationHealth.js';
import { RefreshIconButton } from '../components/RefreshIconButton.js';
import type { ClimateInstalledAutomation } from '../flows/installations/model.js';
import { installationRecoveryState } from '../flows/installations/healthRecovery.js';
import {
  formatInstallationMetric,
  installationHealthLabel,
  INSTALLATION_MODE_KEYS,
  installationThresholdSummary
} from '../flows/installations/presentation.js';
import { installedAutomationHealth } from '../flows/installations/runtimeDiagnostics.js';
import {
  installedAutomationScriptMatch,
  pauseInstalledAutomation,
  resumeInstalledAutomation
} from '../flows/installations/runtimeControl.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import { ShellyLedSettingsCard } from './ShellyLedSettingsCard.js';
import { TimeInstallationDetail } from './TimeInstallationDetail.js';
import {
  installedAutomationControlQueryKey,
  installedAutomationDiagnosticsQueryKey,
  useInstalledAutomationControl,
  useInstalledAutomationDiagnostics
} from '../flows/installations/useInstalledAutomationRuntime.js';

type InstallationDetailScreenProps = {
  installationId: string;
  onBack(): void;
};

type DetailHealthTone = 'ok' | 'warning' | 'offline' | 'paused';

const healthClass = (tone: DetailHealthTone) =>
  `automation-health automation-health--${
    tone === 'warning' ? 'attention' : tone
  }`;

const configuredThresholdSummary = (installation: ClimateInstalledAutomation) =>
  installationThresholdSummary(installation);

export const InstallationDetailScreen = ({
  installationId,
  onBack
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
};

const InstalledAutomationDetail = ({
  installation,
  onBack,
  pushToast,
  dismissToast,
  toasts,
  queryClient
}: InstalledAutomationDetailProps) => {
  const { locale, t } = useTranslation();
  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation);
  const controlQuery = useInstalledAutomationControl(installation);
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
  const recoveryCopy = recovery
    ? installationHealthCopy[locale].issues[recovery.issue]
    : null;

  const automationMutation = useMutation({
    mutationFn: () =>
      isPaused
        ? resumeInstalledAutomation(installation)
        : pauseInstalledAutomation(installation),
    onSuccess: async (nextControl) => {
      queryClient.setQueryData(
        installedAutomationControlQueryKey(installation),
        nextControl
      );
      if (nextControl.automationMode === 'manual') {
        queryClient.removeQueries({
          queryKey: installedAutomationDiagnosticsQueryKey(installation),
          exact: true
        });
        pushToast('ok', t('detail.pauseSuccess'));
      } else {
        await queryClient.invalidateQueries({
          queryKey: installedAutomationDiagnosticsQueryKey(installation),
          exact: true
        });
        pushToast('ok', t('detail.resumeSuccess'));
      }
    },
    onError: () => pushToast('warning', t('detail.actionFailed'))
  });

  const refreshAll = async () => {
    await Promise.allSettled([diagnosticsQuery.refetch(), controlQuery.refetch()]);
  };

  let healthLabel = t('dashboard.health.loading');
  let healthTone: DetailHealthTone = 'warning';
  if (recovery?.issue === 'offline') {
    healthLabel = t('dashboard.health.offline');
    healthTone = 'offline';
  } else if (recovery?.issue === 'script-stopped') {
    healthLabel = t('dashboard.health.paused');
    healthTone = 'paused';
  } else if (recovery?.issue === 'ownership-problem') {
    healthLabel = t('dashboard.health.attention');
  } else if (recovery?.issue === 'sensor-missing') {
    healthLabel = t('dashboard.health.stale');
  } else if (diagnosticsQuery.isError) {
    healthLabel = t('dashboard.health.attention');
  } else if (runtimeHealth) {
    healthLabel = installationHealthLabel(runtimeHealth, t);
    healthTone = runtimeHealth === 'ok' ? 'ok' : 'warning';
  }

  const relayState =
    control?.relayOn ?? snapshot?.plug?.relayState ?? snapshot?.diagnostics.relayState;

  return (
    <main className="demo-shell installation-detail-shell">
      <header className="demo-header installation-detail-header">
        <div>
          <button className="detail-back-link" type="button" onClick={onBack}>
            ← {t('detail.backToDashboard')}
          </button>
          <div className="automation-status-row">
            <span className={healthClass(healthTone)}>{healthLabel}</span>
            <span className="automation-status-mode">
              {t(INSTALLATION_MODE_KEYS[installation.config.rule.mode])}
            </span>
          </div>
          <h1>{installation.shelly.name}</h1>
          <p>{t('detail.description')}</p>
        </div>
        <RefreshIconButton
          busy={diagnosticsQuery.isFetching || controlQuery.isFetching}
          label={t('common.refresh')}
          onRefresh={() => void refreshAll()}
        />
      </header>

      <section className="installation-detail-grid" aria-label={t('detail.currentState')}>
        {recovery && recoveryCopy && (
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
                  recovery.action === 'resume' ? 'primary-action' : 'secondary-action'
                }
                type="button"
                disabled={
                  recovery.action === 'resume'
                    ? automationMutation.isPending
                    : diagnosticsQuery.isFetching || controlQuery.isFetching
                }
                onClick={() => {
                  if (recovery.action === 'resume') {
                    automationMutation.mutate();
                    return;
                  }
                  void refreshAll();
                }}
              >
                {recovery.action === 'resume' && automationMutation.isPending
                  ? t('detail.changingState')
                  : recovery.action === 'refresh' &&
                      (diagnosticsQuery.isFetching || controlQuery.isFetching)
                    ? t('common.refreshing')
                    : recoveryCopy.action}
              </button>
            </div>
          </article>
        )}

        <article className="automation-card installation-detail-live">
          <div className="installation-section-heading">
            <div>
              <p className="automation-card__eyebrow">{t('detail.currentState')}</p>
              <h2>{t('detail.climateNow')}</h2>
            </div>
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
            <div>
              <dt>{t('detail.source')}</dt>
              <dd>{t('dashboard.liveFromShelly')}</dd>
            </div>
          </dl>
        </article>

        <article className="automation-card installation-detail-config">
          <div className="installation-section-heading">
            <div>
              <p className="automation-card__eyebrow">{t('detail.configuration')}</p>
              <h2>{t('detail.automation')}</h2>
            </div>
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

          {canToggleAutomation && recovery?.issue !== 'script-stopped' && (
            <div className="installation-detail-actions">
              <button
                className={isPaused ? 'primary-action' : 'secondary-action'}
                type="button"
                disabled={automationMutation.isPending}
                onClick={() => automationMutation.mutate()}
              >
                {automationMutation.isPending
                  ? t('detail.changingState')
                  : isPaused
                    ? t('detail.resume')
                    : t('detail.pause')}
              </button>
            </div>
          )}
        </article>

        <ShellyLedSettingsCard installation={installation} onFeedback={pushToast} />
      </section>

      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </main>
  );
};

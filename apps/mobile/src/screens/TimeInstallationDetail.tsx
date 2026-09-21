import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FeedbackPanel, Modal, type ToastMessage, type ToastTone } from '@lcl/ui';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import { AppPageBack } from '../components/AppPageBack.js';
import { AppToastViewport } from '../components/AppToastViewport.js';
import { RefreshIconButton } from '../components/RefreshIconButton.js';
import {
  deleteTimeAutomation,
  pauseTimeAutomation,
  resumeTimeAutomation,
  useInstalledAutomationStore,
  type TimeInstalledAutomation
} from '../features/automations/index.js';
import {
  timeAutomationRuntimeQueryKey,
  useTimeAutomationRuntime
} from '../flows/time-automation/useTimeAutomationRuntime.js';
import { PlugLedSettingsCard } from '../features/plugs/index.js';

const healthClass = (state: 'running' | 'paused' | 'attention' | 'offline' | 'loading') =>
  `automation-health automation-health--${
    state === 'running'
      ? 'ok'
      : state === 'paused'
        ? 'paused'
        : state === 'offline'
          ? 'offline'
          : state === 'loading'
            ? 'unknown'
            : 'attention'
  }`;

type TimeInstallationDetailProps = {
  installation: TimeInstalledAutomation;
  onBack(): void;
  onEdit?: () => void;
};

export const TimeInstallationDetail = ({
  installation,
  onBack,
  onEdit
}: TimeInstallationDetailProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const runtimeQuery = useTimeAutomationRuntime(installation);
  const removeInstallation = useInstalledAutomationStore(
    (state) => state.removeInstallation
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  const pushToast = useCallback((tone: ToastTone, title: string) => {
    toastIdRef.current += 1;
    setToasts((current) => [
      ...current.slice(-2),
      { id: `time-toast-${toastIdRef.current}`, tone, title }
    ]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pauseMutation = useMutation({
    mutationFn: () => pauseTimeAutomation(installation),
    onSuccess: async (runtime) => {
      queryClient.setQueryData(timeAutomationRuntimeQueryKey(installation), runtime);
      pushToast('ok', t('time.detail.pauseSuccess'));
    },
    onError: () => pushToast('warning', t('time.detail.actionFailed'))
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeTimeAutomation(installation),
    onSuccess: async (runtime) => {
      queryClient.setQueryData(timeAutomationRuntimeQueryKey(installation), runtime);
      pushToast('ok', t('time.detail.resumeSuccess'));
    },
    onError: () => pushToast('warning', t('time.detail.actionFailed'))
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTimeAutomation(installation),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: timeAutomationRuntimeQueryKey(installation),
        exact: true
      });
      removeInstallation(installation.id);
      setDeleteOpen(false);
      onBack();
    },
    onError: () => pushToast('warning', t('time.detail.deleteFailed'))
  });

  const runtimeState = runtimeQuery.isPending
    ? 'loading'
    : runtimeQuery.isError
      ? 'offline'
      : (runtimeQuery.data?.scheduleState ?? 'attention');
  const stateLabel =
    runtimeState === 'running'
      ? t('dashboard.health.ok')
      : runtimeState === 'paused'
        ? t('dashboard.health.paused')
        : runtimeState === 'offline'
          ? t('dashboard.health.offline')
          : runtimeState === 'loading'
            ? t('dashboard.health.loading')
            : t('dashboard.health.attention');
  const actionBusy = pauseMutation.isPending || resumeMutation.isPending;

  return (
    <main className="demo-shell installation-detail-shell">
      <AppPageBack label={t('dashboard.climateTab')} onBack={onBack} />
      <header className="demo-header installation-detail-header">
        <div>
          <div className="automation-status-row">
            <span className={healthClass(runtimeState)}>{stateLabel}</span>
            <span className="automation-status-mode">{t('time.family')}</span>
          </div>
          <h1>{installation.shelly.name}</h1>
        </div>
        <RefreshIconButton
          busy={runtimeQuery.isFetching}
          label={t('common.refresh')}
          onRefresh={() => void runtimeQuery.refetch()}
        />
      </header>

      <section className="installation-detail-grid" aria-label={t('detail.currentState')}>
        <article className="automation-card installation-detail-live">
          <div className="installation-section-heading">
            <h2>{t('time.scheduleSummary')}</h2>
          </div>

          <div className="automation-metrics" aria-label={t('time.scheduleSummary')}>
            <div>
              <span>{t('time.onTime')}</span>
              <strong>{installation.config.onTime}</strong>
            </div>
            <div>
              <span>{t('time.offTime')}</span>
              <strong>{installation.config.offTime}</strong>
            </div>
            <div>
              <span>{t('dashboard.output')}</span>
              <strong>
                {runtimeQuery.data ? (runtimeQuery.data.relayOn ? 'ON' : 'OFF') : '—'}
              </strong>
            </div>
          </div>

          <dl className="automation-summary installation-detail-summary">
            <div>
              <dt>{t('time.clock')}</dt>
              <dd>{runtimeQuery.data?.clock.localTime ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('time.owner')}</dt>
              <dd>{t('time.nativeSchedule')}</dd>
            </div>
          </dl>

          <div className="installation-detail-actions">
            {runtimeState === 'paused' ? (
              <button
                className="primary-action"
                type="button"
                disabled={actionBusy}
                onClick={() => resumeMutation.mutate()}
              >
                {actionBusy ? t('detail.changingState') : t('detail.resume')}
              </button>
            ) : (
              <button
                className="secondary-action"
                type="button"
                disabled={actionBusy || runtimeState !== 'running'}
                onClick={() => pauseMutation.mutate()}
              >
                {actionBusy ? t('detail.changingState') : t('detail.pause')}
              </button>
            )}
          </div>
        </article>

        <article className="automation-card installation-detail-config">
          <div className="installation-section-heading">
            <h2>{t('time.detail.editTitle')}</h2>
          </div>
          <div className="installation-detail-actions">
            {onEdit && (
              <button className="primary-action" type="button" onClick={onEdit}>
                {t('detail.edit')}
              </button>
            )}
            <button
              className="secondary-action secondary-action--danger"
              type="button"
              onClick={() => setDeleteOpen(true)}
            >
              {t('time.detail.delete')}
            </button>
          </div>

          {runtimeState === 'attention' && (
            <p className="installation-detail-note">{t('time.detail.needsAttention')}</p>
          )}
        </article>

        <PlugLedSettingsCard target={installation.shelly} />
      </section>

      <Modal
        actions={
          <button
            className="secondary-action secondary-action--danger"
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? t('time.deleting') : t('common.confirmDelete')}
          </button>
        }
        busy={deleteMutation.isPending}
        closeLabel={t('common.close')}
        open={deleteOpen}
        title={t('time.detail.deleteConfirmTitle')}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteOpen(false);
          }
        }}
      >
        <FeedbackPanel tone="warning" title={t('time.detail.delete')}>
          {t('time.detail.deleteConfirmDetail')}
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

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FeedbackPanel,
  Modal,
  ToastViewport,
  type ToastMessage,
  type ToastTone
} from '@lcl/ui';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import type { TimeInstalledAutomation } from '../flows/installations/model.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import { dailyTimeAutomationConfigSchema } from '../flows/time-automation/config.js';
import {
  deleteTimeAutomation,
  pauseTimeAutomation,
  resumeTimeAutomation,
  updateDailyTimeAutomation
} from '../flows/time-automation/runtime.js';
import {
  timeAutomationRuntimeQueryKey,
  useTimeAutomationRuntime
} from '../flows/time-automation/useTimeAutomationRuntime.js';

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
};

export const TimeInstallationDetail = ({
  installation,
  onBack
}: TimeInstallationDetailProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const runtimeQuery = useTimeAutomationRuntime(installation);
  const upsertInstallation = useInstalledAutomationStore(
    (state) => state.upsertInstallation
  );
  const removeInstallation = useInstalledAutomationStore(
    (state) => state.removeInstallation
  );
  const [onTime, setOnTime] = useState(installation.config.onTime);
  const [offTime, setOffTime] = useState(installation.config.offTime);
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

  const updateMutation = useMutation({
    mutationFn: async () => {
      const parsed = dailyTimeAutomationConfigSchema.safeParse({
        relayId: installation.config.relayId,
        onTime,
        offTime
      });
      if (!parsed.success) {
        throw new Error(t('time.validation.invalidTimes'));
      }
      const runtime = await updateDailyTimeAutomation({
        installation,
        config: parsed.data
      });
      const updatedInstallation: TimeInstalledAutomation = {
        ...installation,
        config: parsed.data,
        updatedAtMs: Date.now()
      };
      upsertInstallation(updatedInstallation);
      return { runtime, updatedInstallation };
    },
    onSuccess: ({ runtime, updatedInstallation }) => {
      queryClient.removeQueries({
        queryKey: timeAutomationRuntimeQueryKey(installation),
        exact: true
      });
      queryClient.setQueryData(
        timeAutomationRuntimeQueryKey(updatedInstallation),
        runtime
      );
      pushToast('ok', t('time.detail.updateSuccess'));
    },
    onError: () => pushToast('warning', t('time.detail.updateFailed'))
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
  const timesValid = dailyTimeAutomationConfigSchema.safeParse({
    relayId: installation.config.relayId,
    onTime,
    offTime
  }).success;

  return (
    <main className="demo-shell installation-detail-shell">
      <header className="demo-header installation-detail-header">
        <div>
          <button className="detail-back-link" type="button" onClick={onBack}>
            ← {t('detail.backToDashboard')}
          </button>
          <p className="automation-card__eyebrow">{t('time.family')}</p>
          <h1>{installation.shelly.name}</h1>
          <p>{t('time.detail.description')}</p>
        </div>
        <span className={healthClass(runtimeState)}>{stateLabel}</span>
      </header>

      <section className="installation-detail-grid" aria-label={t('detail.currentState')}>
        <article className="automation-card installation-detail-live">
          <div className="installation-section-heading">
            <div>
              <p className="automation-card__eyebrow">{t('detail.currentState')}</p>
              <h2>{t('time.scheduleSummary')}</h2>
            </div>
            <button
              className="secondary-action"
              type="button"
              disabled={runtimeQuery.isFetching}
              onClick={() => void runtimeQuery.refetch()}
            >
              {t('common.refresh')}
            </button>
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
            <div>
              <p className="automation-card__eyebrow">{t('detail.configuration')}</p>
              <h2>{t('time.detail.editTitle')}</h2>
            </div>
          </div>

          <div className="time-schedule-grid">
            <label className="field-stack">
              <span>{t('time.onTime')}</span>
              <input
                type="time"
                value={onTime}
                onChange={(event) => setOnTime(event.target.value)}
              />
            </label>
            <label className="field-stack">
              <span>{t('time.offTime')}</span>
              <input
                type="time"
                value={offTime}
                onChange={(event) => setOffTime(event.target.value)}
              />
            </label>
          </div>
          {!timesValid && (
            <p className="field__error" role="alert">
              {t('time.validation.invalidTimes')}
            </p>
          )}

          <div className="installation-detail-actions">
            <button
              className="primary-action"
              type="button"
              disabled={
                !timesValid ||
                updateMutation.isPending ||
                (runtimeState !== 'running' && runtimeState !== 'paused')
              }
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? t('time.updating') : t('time.detail.save')}
            </button>
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

      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </main>
  );
};

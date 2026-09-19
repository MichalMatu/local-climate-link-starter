import { FeedbackPanel, ScriptPreview, ToastViewport, type ToastMessage } from '@lcl/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { installationScriptPreviewCopy } from '../app/locales/installationScriptPreview.js';
import { useTranslation } from '../app/i18n.js';
import {
  installedAutomationScriptSourceQueryKey,
  loadInstalledAutomationScriptSource
} from '../flows/installations/scriptPreview.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';

type InstallationScriptScreenProps = {
  installationId: string;
  onBack(): void;
};

export const InstallationScriptScreen = ({
  installationId,
  onBack
}: InstallationScriptScreenProps) => {
  const { locale, t } = useTranslation();
  const installation = useInstalledAutomationStore((state) =>
    state.installations.find((candidate) => candidate.id === installationId)
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const copy = installationScriptPreviewCopy[locale];
  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const pushToast = useCallback((title: string, tone: 'ok' | 'warning') => {
    toastIdRef.current += 1;
    setToasts((current) => [
      ...current.slice(-2),
      { id: `script-page-toast-${toastIdRef.current}`, title, tone }
    ]);
  }, []);

  const isClimate = installation?.kind === 'climate';
  const scriptQuery = useQuery({
    queryKey: isClimate
      ? installedAutomationScriptSourceQueryKey(installation)
      : ['installed-automation-script-source', installationId, 'missing'],
    queryFn: () => {
      if (!installation || installation.kind !== 'climate') {
        throw new Error('Installation unavailable.');
      }
      return loadInstalledAutomationScriptSource(installation);
    },
    enabled: isClimate,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0
  });

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

  const copySource = () => {
    const source = scriptQuery.data;
    if (!source || typeof navigator === 'undefined' || !navigator.clipboard) {
      pushToast(copy.copyFailed, 'warning');
      return;
    }
    void navigator.clipboard
      .writeText(source)
      .then(() => pushToast(copy.copyDone, 'ok'))
      .catch(() => pushToast(copy.copyFailed, 'warning'));
  };

  return (
    <main className="demo-shell installation-detail-shell installation-script-page">
      <div className="setup-context app-page-back-row">
        <button className="setup-context__back" type="button" onClick={onBack}>
          ‹ {installation.shelly.name}
        </button>
      </div>

      <section className="automation-card installation-script-page__card">
        <div className="installation-section-heading">
          <h1>{copy.title}</h1>
        </div>
        {scriptQuery.isPending && (
          <p className="installation-detail-note" role="status">
            {copy.loading}
          </p>
        )}
        {scriptQuery.isError && (
          <FeedbackPanel tone="danger" title={copy.failed}>
            <button
              className="secondary-action"
              type="button"
              onClick={() => void scriptQuery.refetch()}
            >
              {copy.retry}
            </button>
          </FeedbackPanel>
        )}
        {scriptQuery.isSuccess && (
          <ScriptPreview
            code={scriptQuery.data}
            copyAriaLabel={copy.copy}
            copyLabel={copy.copy}
            label={copy.label}
            variant="fill"
            onCopy={copySource}
          />
        )}
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

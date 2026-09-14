import { Modal, ToastViewport } from '@lcl/ui';
import { IconPlus, IconSettings, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from '../../app/i18n.js';
import { usePlugManagementFlow } from '../../flows/devices/plugs/usePlugManagementFlow.js';
import { useShellySetupScanFlow } from '../../flows/hardware-setup/useShellySetupScanFlow.js';
import { normalizeShellyUrl } from '../../flows/hardware-setup/validation.js';
import { useToastQueue } from '../hardware-setup/useToastQueue.js';
import type { PlugManagementResult } from '../../flows/devices/plugs/management.js';

export const PlugManagementScreen = ({
  onOpenRule
}: {
  onOpenRule(id: string): void;
}) => {
  const { t } = useTranslation();
  const flow = usePlugManagementFlow();
  const scan = useShellySetupScanFlow(
    flow.plugs.map((plug) => ({
      id: plug.id,
      name: plug.name,
      baseUrl: plug.baseUrl,
      scriptIdInput: ''
    }))
  );
  const [dialog, setDialog] = useState<'none' | 'add' | 'detail' | 'remove' | 'orphan'>(
    'none'
  );
  const [name, setName] = useState('Shelly Plug S Gen3');
  const [address, setAddress] = useState('');
  const [scriptId, setScriptId] = useState<number | null>(null);
  const toast = useToastQueue('plug-management');
  const report = <T,>(result: PlugManagementResult<T>): boolean => {
    if (result.ok) return true;
    const owners =
      'ruleIds' in result.error
        ? result.error.ruleIds
            .map((id) => flow.rules.find((rule) => rule.id === id)?.name ?? id)
            .join(', ')
        : '';
    toast.pushToast(
      'warning',
      t('detail.actionFailed'),
      owners || t('hardware.shelly.checkFailedDetail')
    );
    return false;
  };
  const selected = flow.selectedPlug;
  const busy =
    flow.registration.isPending ||
    flow.relay.isPending ||
    flow.orphanRemoval.isPending ||
    flow.removal.isPending;
  return (
    <main className="demo-shell hardware-shell app-bottom-nav-shell">
      <header className="demo-header app-page-header">
        <h1>{t('navigation.plugs')}</h1>
      </header>
      <section className="demo-panel">
        <button
          className="primary-action setup-add-fab"
          type="button"
          aria-label={t('hardware.shelly.add')}
          onClick={() => {
            scan.resetShellyScan();
            setDialog('add');
          }}
        >
          <IconPlus className="setup-add-fab__icon" />
        </button>
        {flow.loadError && <p role="alert">{t('detail.actionFailed')}</p>}
        <div className="saved-list">
          {!flow.plugs.length && <p>{t('hardware.shelly.empty')}</p>}
          {flow.plugs.map((plug) => (
            <article className="saved-list__item" key={plug.id}>
              <div className="saved-list__row">
                <div className="saved-list__field">
                  <h2>{plug.name}</h2>
                  <span>{plug.baseUrl}</span>
                </div>
                <button
                  className="secondary-action"
                  type="button"
                  aria-label={`${t('hardware.shelly.settings')}: ${plug.name}`}
                  onClick={() => {
                    flow.selectPlug(plug.id);
                    setDialog('detail');
                  }}
                >
                  <IconSettings />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <Modal
        open={dialog === 'add'}
        busy={busy}
        closeLabel={t('common.cancel')}
        title={t('hardware.shelly.add')}
        onClose={() => {
          scan.resetShellyScan();
          setDialog('none');
        }}
        actions={
          <button
            className="primary-action"
            type="button"
            disabled={busy}
            onClick={async () => {
              try {
                if (
                  report(
                    await flow.registration.mutateAsync({
                      name,
                      baseUrl: normalizeShellyUrl(address)
                    })
                  )
                )
                  setDialog('none');
              } catch {
                toast.pushToast(
                  'warning',
                  t('hardware.shelly.checkFailedTitle'),
                  t('hardware.shelly.checkFailedDetail')
                );
              }
            }}
          >
            {t('common.add')}
          </button>
        }
      >
        <label className="field">
          {t('hardware.shelly.deviceNameLabel')}
          <input value={name} onChange={(event) => setName(event.currentTarget.value)} />
        </label>
        <section className="saved-list" aria-label={t('hardware.shelly.foundListLabel')}>
          <h3>{t('hardware.shelly.networkScanTitle')}</h3>
          <div className="action-row">
            <label className="field">
              {t('hardware.shelly.scanRangeStart')}
              <input
                value={scan.shellyScanStartInput}
                onChange={(event) =>
                  scan.setShellyScanStartInput(event.currentTarget.value)
                }
              />
            </label>
            <label className="field">
              {t('hardware.shelly.scanRangeEnd')}
              <input
                value={scan.shellyScanEndInput}
                onChange={(event) =>
                  scan.setShellyScanEndInput(event.currentTarget.value)
                }
              />
            </label>
          </div>
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              if (scan.shellyScanMutation.isPending) scan.stopShellyScan();
              else scan.startShellyScan();
            }}
          >
            {scan.shellyScanMutation.isPending
              ? t('hardware.shelly.scanStop')
              : t('hardware.shelly.scanNetwork')}
          </button>
          {scan.shellyScanMutation.isPending && (
            <p role="status">{t('hardware.shelly.scanningIpRange')}</p>
          )}
          {scan.shellyScanStopped && <p>{t('hardware.shelly.scanStopped')}</p>}
          {scan.shellyScanMutation.isError && (
            <p role="alert">{t('hardware.shelly.scanNetworkFailedTitle')}</p>
          )}
          {scan.shellyScanMutation.isSuccess &&
            !scan.shellyScanMutation.data.stopped &&
            scan.shellyScanMutation.data.results.length === 0 && (
              <p>{t('hardware.shelly.scanResultEmpty')}</p>
            )}
          {scan.shellyScanMutation.data?.results.map((result) => (
            <button
              key={result.baseUrl}
              className="secondary-action"
              type="button"
              onClick={() => setAddress(result.baseUrl)}
            >
              {result.baseUrl}
            </button>
          ))}
        </section>
        <label className="field">
          {t('common.address')}
          <input
            value={address}
            placeholder="192.168.0.16"
            onChange={(event) => setAddress(event.currentTarget.value)}
          />
        </label>
      </Modal>
      <Modal
        open={dialog === 'detail' && selected !== null}
        busy={busy}
        closeLabel={t('common.close')}
        title={selected?.name ?? ''}
        description={selected?.baseUrl ?? ''}
        onClose={() => setDialog('none')}
        actions={
          <>
            <button
              className="secondary-action"
              type="button"
              onClick={() => {
                void flow.runtime.refetch();
              }}
            >
              {t('common.refresh')}
            </button>
            <button
              className="secondary-action secondary-action--danger"
              type="button"
              aria-label={t('common.delete')}
              onClick={() => setDialog('remove')}
            >
              <IconTrash />
            </button>
          </>
        }
      >
        {flow.runtime.isFetching && (
          <p role="status">{t('hardware.shelly.localRpcConnecting')}</p>
        )}
        {(flow.runtimeError || flow.runtime.isError) && (
          <p role="alert">{t('hardware.shelly.checkFailedDetail')}</p>
        )}
        {selected && (
          <>
            <div className="automation-relay-actions">
              {[true, false].map((on) => (
                <button
                  key={String(on)}
                  className="automation-relay-button"
                  type="button"
                  aria-pressed={flow.snapshot?.relayOn === on}
                  disabled={!flow.canControlRelay}
                  onClick={async () => {
                    report(await flow.relay.mutateAsync({ id: selected.id, on }));
                  }}
                >
                  {on ? 'ON' : 'OFF'}
                </button>
              ))}
            </div>
            {flow.rules
              .filter((rule) => rule.plugId === selected.id)
              .map((rule) => (
                <div className="action-row" key={rule.id}>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => onOpenRule(rule.id)}
                  >
                    {rule.name}
                  </button>
                </div>
              ))}
            {flow.snapshot?.managedScripts.map((script) => (
              <div className="saved-list__row" key={script.id}>
                <span>
                  {script.name} · #{script.id}
                </span>
                {!script.ruleIds.length && (
                  <button
                    className="secondary-action secondary-action--danger"
                    type="button"
                    onClick={() => {
                      setScriptId(script.id);
                      setDialog('orphan');
                    }}
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </Modal>
      <Modal
        open={dialog === 'remove' || dialog === 'orphan'}
        busy={busy}
        closeLabel={t('common.cancel')}
        title={t('hardware.shelly.deleteConfirmTitle')}
        description={dialog === 'orphan' ? `#${scriptId}` : (selected?.name ?? '')}
        onClose={() => setDialog('detail')}
        actions={
          <button
            className="secondary-action secondary-action--danger"
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!selected) return;
              const result =
                dialog === 'orphan' && scriptId !== null
                  ? await flow.orphanRemoval.mutateAsync({ id: selected.id, scriptId })
                  : await flow.removal.mutateAsync(selected.id);
              if (report(result)) setDialog('none');
            }}
          >
            {t('common.delete')}
          </button>
        }
      >
        <p>{t('hardware.shelly.deleteDescription')}</p>
      </Modal>
      <ToastViewport
        toasts={toast.toasts}
        onDismiss={toast.dismissToast}
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
      />
    </main>
  );
};

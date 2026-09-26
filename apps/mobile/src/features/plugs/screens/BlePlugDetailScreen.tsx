import { useTranslation } from '../../../app/i18n.js';
import { AppPageBack } from '../../../components/AppPageBack.js';
import { BlePlugDeviceReadOnlyPanel } from '../components/BlePlugDeviceReadOnlyPanel.js';
import { PlugInfoPanel } from '../components/PlugInfoPanel.js';
import { useBlePlugReadOnlyDetailFlow } from '../flows/useBlePlugReadOnlyDetailFlow.js';
import { useSavedBlePlugStore } from '../state/savedBlePlugStore.js';

export type BlePlugDetailScreenProps = {
  physicalId: string;
  onBack(): void;
};

export const BlePlugDetailScreen = ({ physicalId, onBack }: BlePlugDetailScreenProps) => {
  const { t } = useTranslation();
  const plug = useSavedBlePlugStore((state) =>
    state.plugs.find((candidate) => candidate.physicalId === physicalId)
  );
  const detailQuery = useBlePlugReadOnlyDetailFlow(plug);

  if (!plug) {
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

  return (
    <main className="demo-shell installation-detail-shell">
      <AppPageBack label={t('dashboard.climateTab')} onBack={onBack} />
      <section className="automation-card installation-detail-identity">
        <h1>{plug.name}</h1>
        <p className="installation-detail-note">
          {t('common.bluetooth')} · {plug.model}
        </p>
      </section>
      <section className="plug-detail-surface">
        {detailQuery.isPending && (
          <section className="plug-detail-framed-section">
            <h3 className="plug-detail-framed-section__title">
              {t('hardware.shelly.settings')}
            </h3>
            <div className="plug-detail-loading" role="status">
              <span className="plug-detail-loading__spinner" aria-hidden="true" />
              <span>{t('common.refreshing')}</span>
            </div>
          </section>
        )}
        {detailQuery.isError && (
          <section className="plug-detail-framed-section">
            <h3 className="plug-detail-framed-section__title">
              {t('hardware.shelly.settings')}
            </h3>
            <p className="plug-settings-feedback plug-settings-feedback--warning">
              {t('dashboard.readFailed')}
            </p>
          </section>
        )}
        {detailQuery.data && (
          <>
            <BlePlugDeviceReadOnlyPanel
              settings={detailQuery.data.deviceSettings}
              cloud={detailQuery.data.cloud}
            />
            <PlugInfoPanel
              connection={{
                transport: 'bluetooth',
                bleDeviceId: plug.bleDeviceId,
                advertisementName: plug.advertisementName
              }}
              information={detailQuery.data.information}
              showResourceRows={false}
            />
          </>
        )}
      </section>
    </main>
  );
};

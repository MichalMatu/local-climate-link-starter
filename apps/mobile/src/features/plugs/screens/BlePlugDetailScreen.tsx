import { useTranslation } from '../../../app/i18n.js';
import { AppPageBack } from '../../../components/AppPageBack.js';
import { PlugInfoPanel } from '../components/PlugInfoPanel.js';
import { useBlePlugInformationFlow } from '../flows/useBlePlugInformationFlow.js';
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
  const informationQuery = useBlePlugInformationFlow(plug);

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
      <section className="plug-detail-surface" aria-label={t('common.info')}>
        <PlugInfoPanel
          connection={{
            transport: 'bluetooth',
            bleDeviceId: plug.bleDeviceId,
            advertisementName: plug.advertisementName
          }}
          information={informationQuery.data}
          loading={informationQuery.isPending}
          error={informationQuery.isError}
          showResourceRows={false}
        />
      </section>
    </main>
  );
};

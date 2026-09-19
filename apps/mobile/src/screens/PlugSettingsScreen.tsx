import { useTranslation } from '../app/i18n.js';
import { AppPageBack } from '../components/AppPageBack.js';
import { useHardwareSetupFlow } from '../flows/hardware-setup/useHardwareSetupFlow.js';
import { ShellySetupPage } from './hardware-setup/pages/ShellySetupPage.js';

type PlugSettingsScreenProps = {
  deviceId: string;
  onBack(): void;
};

export const PlugSettingsScreen = ({ deviceId, onBack }: PlugSettingsScreenProps) => {
  const { t } = useTranslation();
  const flow = useHardwareSetupFlow();

  return (
    <main className="demo-shell hardware-shell">
      <AppPageBack label={t('dashboard.climateTab')} onBack={onBack} />
      <ShellySetupPage
        flow={flow}
        settingsOnlyDeviceId={deviceId}
        onSettingsClose={onBack}
      />
    </main>
  );
};

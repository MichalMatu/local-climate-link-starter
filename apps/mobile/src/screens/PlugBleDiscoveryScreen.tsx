import { useTranslation } from '../app/i18n.js';
import { AppPageBack } from '../components/AppPageBack.js';
import { useHardwareSetupFlow } from '../flows/hardware-setup/useHardwareSetupFlow.js';
import { ShellySetupPage } from './hardware-setup/pages/ShellySetupPage.js';

type PlugBleDiscoveryScreenProps = {
  deviceId: string;
  onBack(): void;
};

export const PlugBleDiscoveryScreen = ({
  deviceId,
  onBack
}: PlugBleDiscoveryScreenProps) => {
  const { t } = useTranslation();
  const flow = useHardwareSetupFlow();
  const device = flow.shellyDevices.find((candidate) => candidate.id === deviceId);

  return (
    <main className="demo-shell hardware-shell">
      <AppPageBack
        label={device?.name ?? t('hardware.shelly.settings')}
        onBack={onBack}
      />
      <ShellySetupPage
        flow={flow}
        bleScanOnlyDeviceId={deviceId}
        onBleScanClose={onBack}
      />
    </main>
  );
};

import { useEffect, useRef } from 'react';
import { useTranslation } from '../../app/i18n.js';
import { useSensorManagementFlow } from '../../flows/devices/sensors/useSensorManagementFlow.js';
import { SensorSetupPage } from '../hardware-setup/pages/SensorSetupPage.js';
export const SensorManagementScreen = () => {
  const { t } = useTranslation();
  const flow = useSensorManagementFlow();
  const cleanup = useRef(() => {});
  cleanup.current = () => {
    flow.stopPhoneBleScan();
    flow.stopSavedSensorLiveScan();
  };
  useEffect(() => {
    const stop = () => cleanup.current();
    window.addEventListener('pagehide', stop);
    return () => {
      stop();
      window.removeEventListener('pagehide', stop);
    };
  }, []);
  return (
    <main className="demo-shell hardware-shell app-bottom-nav-shell">
      <header className="demo-header app-page-header">
        <h1>{t('navigation.sensors')}</h1>
      </header>
      <SensorSetupPage flow={flow} />
    </main>
  );
};

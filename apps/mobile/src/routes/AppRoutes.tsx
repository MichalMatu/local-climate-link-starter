import { Suspense, lazy } from 'react';
import { useTranslation } from '../app/i18n.js';

const HardwareSetupScreen = lazy(async () => {
  const module = await import('../screens/hardware-setup/HardwareSetupScreen.js');
  return { default: module.HardwareSetupScreen };
});

const RouteFallback = () => {
  const { t } = useTranslation();

  return (
    <main className="demo-shell hardware-shell">
      <section className="demo-panel">
        <p role="status">{t('app.loadingConfigurator')}</p>
      </section>
    </main>
  );
};

export const AppRoutes = () => (
  <Suspense fallback={<RouteFallback />}>
    <HardwareSetupScreen />
  </Suspense>
);

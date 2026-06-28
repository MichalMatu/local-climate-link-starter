import { Suspense, lazy } from 'react';

const HardwareSetupScreen = lazy(async () => {
  const module = await import('../screens/hardware-setup/HardwareSetupScreen.js');
  return { default: module.HardwareSetupScreen };
});

export const AppRoutes = () => (
  <Suspense
    fallback={
      <main className="demo-shell hardware-shell">
        <section className="demo-panel">
          <p role="status">Ładuję konfigurator.</p>
        </section>
      </main>
    }
  >
    <HardwareSetupScreen />
  </Suspense>
);

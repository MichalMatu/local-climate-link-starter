import { Suspense, lazy, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import type { SetupIntent } from '../flows/setup-intent.js';
import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';
import { SetupIntentScreen } from '../screens/SetupIntentScreen.js';

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

type AppView = 'intent' | 'dashboard' | Exclude<SetupIntent, 'manage'>;

export const AppRoutes = () => {
  const installations = useInstalledAutomationStore((state) => state.installations);
  const [view, setView] = useState<AppView>(() =>
    installations.length > 0 ? 'dashboard' : 'intent'
  );

  if (view === 'intent') {
    return (
      <SetupIntentScreen
        onSelect={(intent) => setView(intent === 'manage' ? 'dashboard' : intent)}
      />
    );
  }

  if (view === 'dashboard') {
    return <AutomationDashboardScreen onAddAutomation={() => setView('intent')} />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <HardwareSetupScreen setupIntent={view} onBackToIntent={() => setView('intent')} />
    </Suspense>
  );
};

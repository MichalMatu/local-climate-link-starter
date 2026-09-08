import { Suspense, lazy, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import type { SetupIntent } from '../flows/setup-intent.js';
import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';
import { InstallationDetailScreen } from '../screens/InstallationDetailScreen.js';
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

type SetupRouteIntent = Exclude<SetupIntent, 'manage'>;
type AppRoute =
  | { type: 'intent' }
  | { type: 'dashboard' }
  | { type: 'setup'; intent: SetupRouteIntent }
  | { type: 'installation'; installationId: string };

export const AppRoutes = () => {
  const installations = useInstalledAutomationStore((state) => state.installations);
  const [route, setRoute] = useState<AppRoute>(() =>
    installations.length > 0 ? { type: 'dashboard' } : { type: 'intent' }
  );

  if (route.type === 'intent') {
    return (
      <SetupIntentScreen
        onSelect={(intent) =>
          setRoute(
            intent === 'manage' ? { type: 'dashboard' } : { type: 'setup', intent }
          )
        }
      />
    );
  }

  if (route.type === 'dashboard') {
    return (
      <AutomationDashboardScreen
        onAddAutomation={() => setRoute({ type: 'intent' })}
        onOpenInstallation={(installationId) =>
          setRoute({ type: 'installation', installationId })
        }
      />
    );
  }

  if (route.type === 'installation') {
    return (
      <InstallationDetailScreen
        installationId={route.installationId}
        onBack={() => setRoute({ type: 'dashboard' })}
      />
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <HardwareSetupScreen
        setupIntent={route.intent}
        onBackToIntent={() => setRoute({ type: 'intent' })}
      />
    </Suspense>
  );
};

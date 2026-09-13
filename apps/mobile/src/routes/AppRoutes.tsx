import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AppSettingsScreen } from '../app/AppSettingsScreen.js';
import { useTranslation } from '../app/i18n.js';
import {
  AppBottomNavigation,
  type AppNavigationKind
} from '../components/AppBottomNavigation.js';
import type { SetupIntent } from '../flows/setup-intent.js';
import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';
import { InstallationDetailScreen } from '../screens/InstallationDetailScreen.js';
import { SetupIntentScreen } from '../screens/SetupIntentScreen.js';
import { PlugManagementScreen } from '../screens/devices/PlugManagementScreen.js';
import { SensorManagementScreen } from '../screens/devices/SensorManagementScreen.js';

const HardwareSetupScreen = lazy(async () => {
  const module = await import('../screens/hardware-setup/HardwareSetupScreen.js');
  return { default: module.HardwareSetupScreen };
});

type PrimaryAppRoute =
  | { type: 'dashboard' }
  | { type: 'plugs' }
  | { type: 'sensors' }
  | { type: 'intent' }
  | { type: 'setup'; intent: SetupIntent }
  | { type: 'installation'; installationId: string };
type AppRoute = PrimaryAppRoute | { type: 'settings'; returnTo: PrimaryAppRoute };

const resolveAndroidBackRoute = (route: AppRoute): AppRoute | null => {
  switch (route.type) {
    case 'settings':
      return route.returnTo;
    case 'setup':
      return { type: 'intent' };
    case 'installation':
    case 'intent':
    case 'plugs':
    case 'sensors':
      return { type: 'dashboard' };
    case 'dashboard':
      return null;
  }
};

export const AppRoutes = () => {
  const { t } = useTranslation();
  const [route, setRoute] = useState<AppRoute>({ type: 'dashboard' });
  const routeRef = useRef(route);
  const navigate = useCallback((nextRoute: AppRoute) => {
    routeRef.current = nextRoute;
    setRoute(nextRoute);
  }, []);
  const navigateTopLevel = useCallback(
    (kind: AppNavigationKind) => {
      if (kind === 'settings') {
        const current = routeRef.current;
        if (current.type !== 'settings') {
          navigate({ type: 'settings', returnTo: current });
        }
      } else {
        navigate({ type: kind === 'rules' ? 'dashboard' : kind });
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    void App.addListener('backButton', () => {
      const nextRoute = resolveAndroidBackRoute(routeRef.current);
      if (nextRoute === null) {
        void App.exitApp();
      } else {
        navigate(nextRoute);
      }
    }).then((handle) => {
      if (!active) {
        void handle.remove();
      } else {
        removeListener = () => handle.remove();
      }
    });
    return () => {
      active = false;
      if (removeListener) void removeListener();
    };
  }, [navigate]);

  const content = () => {
    switch (route.type) {
      case 'settings':
        return <AppSettingsScreen />;
      case 'plugs':
        return (
          <PlugManagementScreen onOpenRule={() => navigate({ type: 'dashboard' })} />
        );
      case 'sensors':
        return <SensorManagementScreen />;
      case 'intent':
        return (
          <SetupIntentScreen
            onCancel={() => navigate({ type: 'dashboard' })}
            onSelect={(intent) => navigate({ type: 'setup', intent })}
          />
        );
      case 'dashboard':
        return (
          <AutomationDashboardScreen
            onAddAutomation={() => navigate({ type: 'intent' })}
            onOpenInstallation={(installationId) =>
              navigate({ type: 'installation', installationId })
            }
          />
        );
      case 'installation':
        return (
          <InstallationDetailScreen
            installationId={route.installationId}
            onBack={() => navigate({ type: 'dashboard' })}
          />
        );
      case 'setup':
        return (
          <HardwareSetupScreen
            setupIntent={route.intent}
            onBackToIntent={() => navigate({ type: 'intent' })}
            onSetupComplete={() => navigate({ type: 'dashboard' })}
          />
        );
    }
  };
  const activeKind: AppNavigationKind =
    route.type === 'plugs' || route.type === 'sensors' || route.type === 'settings'
      ? route.type
      : 'rules';

  return (
    <>
      <Suspense
        fallback={
          <main className="demo-shell hardware-shell app-bottom-nav-shell">
            <p role="status">{t('app.loadingConfigurator')}</p>
          </main>
        }
      >
        {content()}
      </Suspense>
      <AppBottomNavigation activeKind={activeKind} onNavigate={navigateTopLevel} />
    </>
  );
};

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
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

const resolveAndroidBackRoute = (
  route: AppRoute,
  hasInstallations: boolean
): AppRoute | null => {
  if (route.type === 'installation') {
    return { type: 'dashboard' };
  }
  if (route.type === 'setup') {
    return { type: 'intent' };
  }
  if (route.type === 'intent' && hasInstallations) {
    return { type: 'dashboard' };
  }
  if (route.type === 'dashboard' && !hasInstallations) {
    return { type: 'intent' };
  }
  return null;
};

export const AppRoutes = () => {
  const installations = useInstalledAutomationStore((state) => state.installations);
  const [route, setRoute] = useState<AppRoute>(() =>
    installations.length > 0 ? { type: 'dashboard' } : { type: 'intent' }
  );
  const routeRef = useRef(route);
  const hasInstallationsRef = useRef(installations.length > 0);
  const navigate = useCallback((nextRoute: AppRoute) => {
    routeRef.current = nextRoute;
    setRoute(nextRoute);
  }, []);

  useEffect(() => {
    hasInstallationsRef.current = installations.length > 0;
  }, [installations.length]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    let active = true;
    let removeListener: (() => Promise<void>) | undefined;

    void App.addListener('backButton', () => {
      const nextRoute = resolveAndroidBackRoute(
        routeRef.current,
        hasInstallationsRef.current
      );
      if (nextRoute === null) {
        void App.exitApp();
        return;
      }
      navigate(nextRoute);
    }).then((handle) => {
      if (!active) {
        void handle.remove();
        return;
      }
      removeListener = () => handle.remove();
    });

    return () => {
      active = false;
      if (removeListener !== undefined) {
        void removeListener();
      }
    };
  }, [navigate]);

  if (route.type === 'intent') {
    return (
      <SetupIntentScreen
        onSelect={(intent) =>
          navigate(
            intent === 'manage' ? { type: 'dashboard' } : { type: 'setup', intent }
          )
        }
      />
    );
  }

  if (route.type === 'dashboard') {
    return (
      <AutomationDashboardScreen
        onAddAutomation={() => navigate({ type: 'intent' })}
        onOpenInstallation={(installationId) =>
          navigate({ type: 'installation', installationId })
        }
      />
    );
  }

  if (route.type === 'installation') {
    return (
      <InstallationDetailScreen
        installationId={route.installationId}
        onBack={() => navigate({ type: 'dashboard' })}
      />
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <HardwareSetupScreen
        setupIntent={route.intent}
        onBackToIntent={() => navigate({ type: 'intent' })}
        onSetupComplete={() => navigate({ type: 'dashboard' })}
      />
    </Suspense>
  );
};

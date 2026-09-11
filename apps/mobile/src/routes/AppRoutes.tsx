import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AppSettingsScreen } from '../app/AppSettingsScreen.js';
import { useTranslation } from '../app/i18n.js';
import {
  AppBottomNavigation,
  type AppNavigationKind
} from '../components/AppBottomNavigation.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import type { SetupIntent } from '../flows/setup-intent.js';
import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';
import { InstallationDetailScreen } from '../screens/InstallationDetailScreen.js';
import { SetupIntentScreen } from '../screens/SetupIntentScreen.js';

const HardwareSetupScreen = lazy(async () => {
  const module = await import('../screens/hardware-setup/HardwareSetupScreen.js');
  return { default: module.HardwareSetupScreen };
});

type SetupRouteIntent = SetupIntent;
type PrimaryAppRoute =
  | { type: 'dashboard'; kind?: AppNavigationKind }
  | { type: 'intent'; sourceKind: AppNavigationKind }
  | { type: 'setup'; intent: SetupRouteIntent; sourceKind: AppNavigationKind }
  | { type: 'installation'; installationId: string; kind: AppNavigationKind };
type AppRoute = PrimaryAppRoute | { type: 'settings'; returnTo: PrimaryAppRoute };

type RouteFallbackProps = {
  activeKind: AppNavigationKind;
  onOpenClimate(): void;
  onOpenTime(): void;
  onOpenSettings(): void;
};

const RouteFallback = ({
  activeKind,
  onOpenClimate,
  onOpenTime,
  onOpenSettings
}: RouteFallbackProps) => {
  const { t } = useTranslation();

  return (
    <main className="demo-shell hardware-shell app-bottom-nav-shell">
      <section className="demo-panel">
        <p role="status">{t('app.loadingConfigurator')}</p>
      </section>
      <AppBottomNavigation
        activeKind={activeKind}
        onOpenClimate={onOpenClimate}
        onOpenTime={onOpenTime}
        onOpenSettings={onOpenSettings}
      />
    </main>
  );
};

const resolveAndroidBackRoute = (route: AppRoute): AppRoute | null => {
  if (route.type === 'settings') {
    return route.returnTo;
  }
  if (route.type === 'installation') {
    return { type: 'dashboard', kind: route.kind };
  }
  if (route.type === 'setup') {
    return { type: 'intent', sourceKind: route.sourceKind };
  }
  if (route.type === 'intent') {
    return { type: 'dashboard', kind: route.sourceKind };
  }
  return null;
};

const setupKindForIntent = (intent: SetupRouteIntent): AppNavigationKind =>
  intent === 'time' ? 'time' : 'climate';

export const AppRoutes = () => {
  const installations = useInstalledAutomationStore((state) => state.installations);
  const [route, setRoute] = useState<AppRoute>({ type: 'dashboard' });
  const routeRef = useRef(route);
  const navigate = useCallback((nextRoute: AppRoute) => {
    routeRef.current = nextRoute;
    setRoute(nextRoute);
  }, []);
  const openSettings = useCallback(() => {
    const current = routeRef.current;
    if (current.type === 'settings') {
      return;
    }
    navigate({ type: 'settings', returnTo: current });
  }, [navigate]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    let active = true;
    let removeListener: (() => Promise<void>) | undefined;

    void App.addListener('backButton', () => {
      const nextRoute = resolveAndroidBackRoute(routeRef.current);
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

  const selectIntent = (intent: SetupIntent) => {
    const nextKind = setupKindForIntent(intent);
    navigate({ type: 'setup', intent, sourceKind: nextKind });
  };

  if (route.type === 'settings') {
    return (
      <AppSettingsScreen
        onOpenClimate={() => navigate({ type: 'dashboard', kind: 'climate' })}
        onOpenTime={() => navigate({ type: 'dashboard', kind: 'time' })}
      />
    );
  }

  if (route.type === 'intent') {
    return (
      <SetupIntentScreen
        activeKind={route.sourceKind}
        onCancel={() => navigate({ type: 'dashboard', kind: route.sourceKind })}
        onOpenClimate={() => navigate({ type: 'dashboard', kind: 'climate' })}
        onOpenTime={() => navigate({ type: 'dashboard', kind: 'time' })}
        onOpenSettings={openSettings}
        onSelect={selectIntent}
      />
    );
  }

  if (route.type === 'dashboard') {
    return (
      <AutomationDashboardScreen
        {...(route.kind ? { initialKind: route.kind } : {})}
        onAddAutomation={(kind) => navigate({ type: 'intent', sourceKind: kind })}
        onOpenInstallation={(installationId) => {
          const installation = installations.find(
            (candidate) => candidate.id === installationId
          );
          navigate({
            type: 'installation',
            installationId,
            kind: installation?.kind === 'time' ? 'time' : 'climate'
          });
        }}
        onOpenSettings={openSettings}
      />
    );
  }

  if (route.type === 'installation') {
    return (
      <InstallationDetailScreen
        installationId={route.installationId}
        onBack={() => navigate({ type: 'dashboard', kind: route.kind })}
        onNavigateDashboard={(kind) => navigate({ type: 'dashboard', kind })}
        onOpenSettings={openSettings}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <RouteFallback
          activeKind={route.sourceKind}
          onOpenClimate={() => navigate({ type: 'dashboard', kind: 'climate' })}
          onOpenTime={() => navigate({ type: 'dashboard', kind: 'time' })}
          onOpenSettings={openSettings}
        />
      }
    >
      <HardwareSetupScreen
        navigationKind={route.sourceKind}
        setupIntent={route.intent}
        onBackToIntent={() => navigate({ type: 'intent', sourceKind: route.sourceKind })}
        onNavigateDashboard={(kind) => navigate({ type: 'dashboard', kind })}
        onOpenSettings={openSettings}
        onSetupComplete={() => navigate({ type: 'dashboard', kind: route.sourceKind })}
      />
    </Suspense>
  );
};

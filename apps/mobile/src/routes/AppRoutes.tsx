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
import type { AutomationCategory } from '../flows/rules/navigation.js';
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

type SetupRouteIntent = SetupIntent;
type PrimaryAppRoute =
  | { type: 'dashboard'; kind?: AutomationCategory }
  | { type: 'plugs' }
  | { type: 'sensors' }
  | { type: 'intent'; sourceKind: AutomationCategory }
  | { type: 'setup'; intent: SetupRouteIntent; sourceKind: AutomationCategory }
  | { type: 'installation'; installationId: string; kind: AutomationCategory };
type AppRoute = PrimaryAppRoute | { type: 'settings'; returnTo: PrimaryAppRoute };

type RouteFallbackProps = {
  activeKind: AppNavigationKind;
  onNavigate(kind: AppNavigationKind): void;
};

const RouteFallback = ({ activeKind, onNavigate }: RouteFallbackProps) => {
  const { t } = useTranslation();

  return (
    <main className="demo-shell hardware-shell app-bottom-nav-shell">
      <section className="demo-panel">
        <p role="status">{t('app.loadingConfigurator')}</p>
      </section>
      <AppBottomNavigation activeKind={activeKind} onNavigate={onNavigate} />
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
    return route.intent === 'time'
      ? { type: 'dashboard', kind: 'time' }
      : { type: 'intent', sourceKind: route.sourceKind };
  }
  if (route.type === 'intent') {
    return { type: 'dashboard', kind: route.sourceKind };
  }
  return null;
};

const setupKindForIntent = (intent: SetupRouteIntent): AutomationCategory =>
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
  const navigateTopLevel = useCallback(
    (kind: AppNavigationKind) => {
      if (kind === 'settings') {
        openSettings();
      } else if (kind === 'rules') {
        navigate({ type: 'dashboard' });
      } else if (kind === 'plugs') {
        navigate({ type: 'plugs' });
      } else {
        navigate({ type: 'sensors' });
      }
    },
    [navigate, openSettings]
  );

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
      <>
        <AppSettingsScreen />
        <AppBottomNavigation activeKind="settings" onNavigate={navigateTopLevel} />
      </>
    );
  }

  if (route.type === 'plugs') {
    return (
      <>
        <PlugManagementScreen onOpenRule={() => navigate({ type: 'dashboard' })} />
        <AppBottomNavigation activeKind="plugs" onNavigate={navigateTopLevel} />
      </>
    );
  }

  if (route.type === 'sensors') {
    return (
      <>
        <SensorManagementScreen />
        <AppBottomNavigation activeKind="sensors" onNavigate={navigateTopLevel} />
      </>
    );
  }

  if (route.type === 'intent') {
    return (
      <SetupIntentScreen
        onCancel={() => navigate({ type: 'dashboard', kind: route.sourceKind })}
        onSelect={selectIntent}
      />
    );
  }

  if (route.type === 'dashboard') {
    return (
      <>
        <AutomationDashboardScreen
          {...(route.kind ? { initialKind: route.kind } : {})}
          onAddAutomation={(kind) =>
            kind === 'time'
              ? navigate({ type: 'setup', intent: 'time', sourceKind: 'time' })
              : navigate({ type: 'intent', sourceKind: 'climate' })
          }
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
        />
        <AppBottomNavigation activeKind="rules" onNavigate={navigateTopLevel} />
      </>
    );
  }

  if (route.type === 'installation') {
    return (
      <InstallationDetailScreen
        installationId={route.installationId}
        onBack={() => navigate({ type: 'dashboard', kind: route.kind })}
      />
    );
  }

  return (
    <Suspense
      fallback={<RouteFallback activeKind="rules" onNavigate={navigateTopLevel} />}
    >
      <HardwareSetupScreen
        setupIntent={route.intent}
        onBackToIntent={() =>
          navigate(
            route.intent === 'time'
              ? { type: 'dashboard', kind: 'time' }
              : { type: 'intent', sourceKind: route.sourceKind }
          )
        }
        onSetupComplete={() => navigate({ type: 'dashboard', kind: route.sourceKind })}
      />
    </Suspense>
  );
};

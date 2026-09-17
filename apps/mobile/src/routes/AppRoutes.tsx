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
import { useHardwareSetupDraftStore } from '../flows/hardware-setup/setupDraftStore.js';
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
  | { type: 'plug-add' }
  | { type: 'intent'; sourceKind: AppNavigationKind; shellyId?: string }
  | {
      type: 'setup';
      intent: SetupRouteIntent;
      sourceKind: AppNavigationKind;
      shellyId?: string;
    }
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
  if (route.type === 'plug-add') {
    return { type: 'dashboard', kind: 'climate' };
  }
  if (route.type === 'setup') {
    return route.intent === 'time'
      ? { type: 'dashboard', kind: 'time' }
      : {
          type: 'intent',
          sourceKind: route.sourceKind,
          ...(route.shellyId ? { shellyId: route.shellyId } : {})
        };
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
  const selectShellyDevice = useHardwareSetupDraftStore(
    (state) => state.selectShellyDevice
  );
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

  const selectIntent = (intent: SetupIntent, shellyId?: string) => {
    const nextKind = setupKindForIntent(intent);
    if (shellyId) selectShellyDevice(shellyId);
    navigate({
      type: 'setup',
      intent,
      sourceKind: nextKind,
      ...(shellyId ? { shellyId } : {})
    });
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
        onSelect={(intent) => selectIntent(intent, route.shellyId)}
      />
    );
  }

  if (route.type === 'dashboard') {
    return (
      <AutomationDashboardScreen
        {...(route.kind ? { initialKind: route.kind } : {})}
        onAddPlug={() => navigate({ type: 'plug-add' })}
        onAddAutomation={(kind, shellyId) => {
          if (shellyId) selectShellyDevice(shellyId);
          if (kind === 'time') {
            navigate({ type: 'setup', intent: 'time', sourceKind: 'time' });
            return;
          }
          navigate({
            type: 'intent',
            sourceKind: 'climate',
            ...(shellyId ? { shellyId } : {})
          });
        }}
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

  if (route.type === 'plug-add') {
    const backToPlugs = () => navigate({ type: 'dashboard', kind: 'climate' });
    return (
      <Suspense
        fallback={
          <RouteFallback
            activeKind="climate"
            onOpenClimate={backToPlugs}
            onOpenTime={() => navigate({ type: 'dashboard', kind: 'time' })}
            onOpenSettings={openSettings}
          />
        }
      >
        <HardwareSetupScreen
          plugAddOnly
          navigationKind="climate"
          onPlugAddComplete={backToPlugs}
          onPlugAddCancel={backToPlugs}
        />
      </Suspense>
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
        {...(route.shellyId ? { fixedShellyId: route.shellyId } : {})}
        onBackToIntent={() =>
          navigate(
            route.intent === 'time'
              ? { type: 'dashboard', kind: 'time' }
              : {
                  type: 'intent',
                  sourceKind: route.sourceKind,
                  ...(route.shellyId ? { shellyId: route.shellyId } : {})
                }
          )
        }
        onNavigateDashboard={(kind) => navigate({ type: 'dashboard', kind })}
        onOpenSettings={openSettings}
        onSetupComplete={() => navigate({ type: 'dashboard', kind: route.sourceKind })}
      />
    </Suspense>
  );
};

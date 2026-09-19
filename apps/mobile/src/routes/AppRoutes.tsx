import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { AppSettingsScreen } from '../app/AppSettingsScreen.js';
import { useTranslation } from '../app/i18n.js';
import { AppShell } from '../components/AppShell.js';
import type { AppNavigationKind } from '../components/AppBottomNavigation.js';
import { useHardwareSetupDraftStore } from '../flows/hardware-setup/setupDraftStore.js';
import type { SetupIntent } from '../flows/setup-intent.js';
import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';
import { InstallationDetailScreen } from '../screens/InstallationDetailScreen.js';
import { InstallationDiagnosticsScreen } from '../screens/InstallationDiagnosticsScreen.js';
import { InstallationScriptScreen } from '../screens/InstallationScriptScreen.js';
import { SetupIntentScreen } from '../screens/SetupIntentScreen.js';

const HardwareSetupScreen = lazy(async () => {
  const module = await import('../screens/hardware-setup/HardwareSetupScreen.js');
  return { default: module.HardwareSetupScreen };
});

type SetupRouteIntent = SetupIntent;
type InstallationPage = 'detail' | 'diagnostics' | 'script';
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
  | {
      type: 'installation';
      installationId: string;
      kind: AppNavigationKind;
      page: InstallationPage;
    };
type AppRoute = PrimaryAppRoute | { type: 'settings'; returnTo: PrimaryAppRoute };

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

const activeNavigationForRoute = (route: AppRoute): AppNavigationKind | 'settings' => {
  if (route.type === 'settings') return 'settings';
  if (route.type === 'dashboard') return route.kind ?? 'climate';
  if (route.type === 'installation') return route.kind;
  if (route.type === 'plug-add') return 'climate';
  return route.sourceKind;
};

const installationDetailRoute = (
  route: Extract<PrimaryAppRoute, { type: 'installation' }>
): PrimaryAppRoute => ({ ...route, page: 'detail' });

const resolveAndroidBackRoute = (route: AppRoute): AppRoute | null => {
  if (route.type === 'settings') return route.returnTo;
  if (route.type === 'installation') {
    if (route.page !== 'detail') return installationDetailRoute(route);
    return { type: 'dashboard', kind: route.kind };
  }
  if (route.type === 'plug-add') return { type: 'dashboard', kind: 'climate' };
  if (route.type === 'setup') {
    return {
      type: 'intent',
      sourceKind: route.sourceKind,
      ...(route.shellyId ? { shellyId: route.shellyId } : {})
    };
  }
  if (route.type === 'intent') return { type: 'dashboard', kind: route.sourceKind };
  return null;
};

export const AppRoutes = () => {
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
    if (current.type === 'settings') return;
    navigate({ type: 'settings', returnTo: current });
  }, [navigate]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

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
      if (removeListener !== undefined) void removeListener();
    };
  }, [navigate]);

  const selectIntent = (
    intent: SetupIntent,
    sourceKind: AppNavigationKind,
    shellyId?: string
  ) => {
    if (shellyId) selectShellyDevice(shellyId);
    navigate({
      type: 'setup',
      intent,
      sourceKind,
      ...(shellyId ? { shellyId } : {})
    });
  };

  let content: ReactNode;

  if (route.type === 'settings') {
    content = <AppSettingsScreen />;
  } else if (route.type === 'intent') {
    content = (
      <SetupIntentScreen
        onCancel={() => navigate({ type: 'dashboard', kind: route.sourceKind })}
        onSelect={(intent) => selectIntent(intent, route.sourceKind, route.shellyId)}
      />
    );
  } else if (route.type === 'dashboard') {
    content = (
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
        onOpenInstallation={(installationId) =>
          navigate({
            type: 'installation',
            installationId,
            kind: 'climate',
            page: 'detail'
          })
        }
      />
    );
  } else if (route.type === 'plug-add') {
    const backToPlugs = () => navigate({ type: 'dashboard', kind: 'climate' });
    content = (
      <Suspense fallback={<RouteFallback />}>
        <HardwareSetupScreen
          plugAddOnly
          onPlugAddComplete={backToPlugs}
          onPlugAddCancel={backToPlugs}
        />
      </Suspense>
    );
  } else if (route.type === 'installation') {
    const backToDetail = () => navigate(installationDetailRoute(route));
    if (route.page === 'diagnostics') {
      content = (
        <InstallationDiagnosticsScreen
          installationId={route.installationId}
          onBack={backToDetail}
        />
      );
    } else if (route.page === 'script') {
      content = (
        <InstallationScriptScreen
          installationId={route.installationId}
          onBack={backToDetail}
        />
      );
    } else {
      content = (
        <InstallationDetailScreen
          installationId={route.installationId}
          onBack={() => navigate({ type: 'dashboard', kind: route.kind })}
          onOpenDiagnostics={() => navigate({ ...route, page: 'diagnostics' })}
          onOpenScript={() => navigate({ ...route, page: 'script' })}
        />
      );
    }
  } else {
    content = (
      <Suspense fallback={<RouteFallback />}>
        <HardwareSetupScreen
          setupIntent={route.intent}
          {...(route.shellyId ? { fixedShellyId: route.shellyId } : {})}
          onBackToIntent={() =>
            navigate({
              type: 'intent',
              sourceKind: route.sourceKind,
              ...(route.shellyId ? { shellyId: route.shellyId } : {})
            })
          }
          onSetupComplete={() => navigate({ type: 'dashboard', kind: route.sourceKind })}
        />
      </Suspense>
    );
  }

  return (
    <AppShell
      activeKind={activeNavigationForRoute(route)}
      onOpenClimate={() => navigate({ type: 'dashboard', kind: 'climate' })}
      onOpenTime={() => navigate({ type: 'dashboard', kind: 'time' })}
      onOpenSettings={openSettings}
    >
      {content}
    </AppShell>
  );
};

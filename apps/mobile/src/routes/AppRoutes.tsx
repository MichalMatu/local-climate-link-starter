import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IconSettings } from '@tabler/icons-react';
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
import type { AppNavigationKind } from '../components/AppBottomNavigation.js';
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
type PrimaryAppRoute =
  | { type: 'intent' }
  | { type: 'dashboard'; kind?: AppNavigationKind }
  | { type: 'setup'; intent: SetupRouteIntent }
  | { type: 'installation'; installationId: string };
type AppRoute = PrimaryAppRoute | { type: 'settings'; returnTo: PrimaryAppRoute };

const resolveAndroidBackRoute = (
  route: AppRoute,
  hasInstallations: boolean
): AppRoute | null => {
  if (route.type === 'settings') {
    return route.returnTo;
  }
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
  const { t } = useTranslation();
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
  const openSettings = useCallback(() => {
    const current = routeRef.current;
    if (current.type === 'settings') {
      return;
    }
    navigate({ type: 'settings', returnTo: current });
  }, [navigate]);

  useEffect(() => {
    hasInstallationsRef.current = installations.length > 0;
    if (installations.length === 0 && routeRef.current.type === 'dashboard') {
      navigate({ type: 'intent' });
    }
  }, [installations.length, navigate]);

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

  const selectIntent = (intent: SetupIntent) => {
    if (intent === 'manage') {
      if (installations.length > 0) {
        navigate({ type: 'dashboard' });
      }
      return;
    }
    navigate({ type: 'setup', intent });
  };

  const withSettingsTrigger = (content: ReactNode) => (
    <>
      <button
        className="app-settings-trigger"
        type="button"
        aria-label={t('settings.open')}
        title={t('settings.open')}
        onClick={openSettings}
      >
        <IconSettings className="app-settings-trigger__icon" aria-hidden="true" />
      </button>
      {content}
    </>
  );

  if (route.type === 'settings') {
    return (
      <AppSettingsScreen
        onOpenClimate={() => navigate({ type: 'dashboard', kind: 'climate' })}
        onOpenTime={() => navigate({ type: 'dashboard', kind: 'time' })}
      />
    );
  }

  if (route.type === 'intent') {
    return withSettingsTrigger(
      <SetupIntentScreen
        {...(installations.length > 0
          ? { onCancel: () => navigate({ type: 'dashboard' }) }
          : {})}
        showManage={installations.length > 0}
        onSelect={selectIntent}
      />
    );
  }

  if (route.type === 'dashboard') {
    if (installations.length === 0) {
      return withSettingsTrigger(
        <SetupIntentScreen showManage={false} onSelect={selectIntent} />
      );
    }
    return (
      <AutomationDashboardScreen
        {...(route.kind ? { initialKind: route.kind } : {})}
        onAddAutomation={() => navigate({ type: 'intent' })}
        onOpenInstallation={(installationId) =>
          navigate({ type: 'installation', installationId })
        }
        onOpenSettings={openSettings}
      />
    );
  }

  if (route.type === 'installation') {
    return (
      <InstallationDetailScreen
        installationId={route.installationId}
        onBack={() => navigate({ type: 'dashboard' })}
        onNavigateDashboard={(kind) => navigate({ type: 'dashboard', kind })}
        onOpenSettings={openSettings}
      />
    );
  }

  return withSettingsTrigger(
    <Suspense fallback={<RouteFallback />}>
      <HardwareSetupScreen
        setupIntent={route.intent}
        onBackToIntent={() => navigate({ type: 'intent' })}
        onSetupComplete={() => navigate({ type: 'dashboard' })}
      />
    </Suspense>
  );
};

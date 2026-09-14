import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AppSettingsScreen } from '../app/AppSettingsScreen.js';
import { useTranslation } from '../app/i18n.js';
import {
  AppBottomNavigation,
  type AppNavigationKind
} from '../components/AppBottomNavigation.js';
import type { SetupIntent } from '../flows/setup-intent.js';
import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';
import { SetupIntentScreen } from '../screens/SetupIntentScreen.js';
import { PlugManagementScreen } from '../screens/devices/PlugManagementScreen.js';
import { SensorManagementScreen } from '../screens/devices/SensorManagementScreen.js';
import { RuleDetailScreen } from '../screens/rules/RuleDetailScreen.js';
import { RuleEditorScreen } from '../screens/rules/RuleEditorScreen.js';

type PrimaryAppRoute =
  | { type: 'dashboard' }
  | { type: 'plugs' }
  | { type: 'sensors' }
  | { type: 'intent' }
  | { type: 'setup'; intent: SetupIntent }
  | { type: 'rule'; ruleId: string }
  | { type: 'rule-edit'; ruleId: string };
type AppRoute = PrimaryAppRoute | { type: 'settings'; returnTo: PrimaryAppRoute };

const resolveAndroidBackRoute = (route: AppRoute): AppRoute | null => {
  switch (route.type) {
    case 'settings':
      return route.returnTo;
    case 'setup':
      return { type: 'intent' };
    case 'rule-edit':
      return { type: 'rule', ruleId: route.ruleId };
    case 'rule':
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
        if (current.type !== 'settings')
          navigate({ type: 'settings', returnTo: current });
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
      if (nextRoute === null) void App.exitApp();
      else navigate(nextRoute);
    }).then((handle) => {
      if (!active) void handle.remove();
      else removeListener = () => handle.remove();
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
          <PlugManagementScreen
            onOpenRule={(ruleId) => navigate({ type: 'rule', ruleId })}
          />
        );
      case 'sensors':
        return (
          <SensorManagementScreen
            onOpenRule={(ruleId) => navigate({ type: 'rule', ruleId })}
          />
        );
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
            onOpenRule={(ruleId) => navigate({ type: 'rule', ruleId })}
          />
        );
      case 'rule':
        return (
          <RuleDetailScreen
            ruleId={route.ruleId}
            onBack={() => navigate({ type: 'dashboard' })}
            onEdit={() => navigate({ type: 'rule-edit', ruleId: route.ruleId })}
          />
        );
      case 'setup':
        return (
          <RuleEditorScreen
            intent={route.intent}
            onCancel={() => navigate({ type: 'intent' })}
            onComplete={(ruleId) => navigate({ type: 'rule', ruleId })}
          />
        );
      case 'rule-edit':
        return (
          <RuleEditorScreen
            ruleId={route.ruleId}
            onCancel={() => navigate({ type: 'rule', ruleId: route.ruleId })}
            onComplete={(ruleId) => navigate({ type: 'rule', ruleId })}
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
            <p>{t('app.loadingConfigurator')}</p>
          </main>
        }
      >
        {content()}
      </Suspense>
      <AppBottomNavigation activeKind={activeKind} onNavigate={navigateTopLevel} />
    </>
  );
};

#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='71b6c8f3390644c581769dbb1a7f6c29d9699ae7'

git fetch --prune origin "$BRANCH" agent-control
test -z "$(git status --porcelain)"
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

cat > apps/mobile/src/routes/AppRoutes.tsx <<'EOF'
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
      fallback={
        <RouteFallback activeKind="rules" onNavigate={navigateTopLevel} />
      }
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
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
s = p.read_text()
anchor = "vi.mock('../screens/hardware-setup/HardwareSetupScreen.js', () => ({\n"
insert = """vi.mock('../screens/devices/PlugManagementScreen.js', () => ({\n  PlugManagementScreen: () => <section>mock-plugs</section>\n}));\n\nvi.mock('../screens/devices/SensorManagementScreen.js', () => ({\n  SensorManagementScreen: () => <section>mock-sensors</section>\n}));\n\n"""
if insert not in s:
    if anchor not in s:
        raise SystemExit('device-screen mock insertion anchor missing')
    s = s.replace(anchor, insert + anchor, 1)

test_anchor = "  it('opens Add automation only from plus and does not expose legacy manage choice', () => {\n"
test = """  it('routes the four-item bottom navigation through top-level sections', () => {\n    renderRoutes();\n\n    expect(screen.getByRole('button', { name: 'Reguły' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n\n    fireEvent.click(screen.getByRole('button', { name: 'Gniazdka' }));\n    expect(screen.getByText('mock-plugs')).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n\n    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));\n    expect(screen.getByText('mock-sensors')).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Termometry' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n\n    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }));\n    expect(screen.getByRole('heading', { name: 'Ustawienia' })).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Ustawienia' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n\n    fireEvent.click(screen.getByRole('button', { name: 'Reguły' }));\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Reguły' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n  });\n\n"""
if test not in s:
    if test_anchor not in s:
        raise SystemExit('route test insertion anchor missing')
    s = s.replace(test_anchor, test + test_anchor, 1)
p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/src/routes/AppRoutes.tsx apps/mobile/src/__tests__/app-routes.test.tsx
git diff --check
pnpm --dir apps/mobile exec vitest run src/__tests__/app-routes.test.tsx src/__tests__/navigation-settings-regression.test.tsx
pnpm quality:ux
pnpm quality:repo
pnpm typecheck

python3 - <<'PY'
from pathlib import Path
p = Path('docs/implementation/device-rule-decoupling-progress.md')
s = p.read_text()
entry = """\n### Routing checkpoint — four top-level sections\n\n- Wired the existing `Rules / Plugs / Thermometers / Settings` bottom navigation into `AppRoutes`.\n- Made standalone Plug and Thermometer management screens reachable from normal product navigation.\n- Settings returns through the same shell; Android back semantics remain fail-simple for top-level routes.\n- Added route coverage for all four active navigation states.\n- Focused route/navigation tests, UX/repository gates and workspace typecheck passed before commit.\n- This checkpoint intentionally does not claim the rule persistence/runtime cutover; `InstalledAutomation` remains until later phases.\n\nExact next step: convert the Rules product path and rule creation to the dedicated rule/device registries, then remove the remaining `InstalledAutomation` and device-draft coupling in runtime setup.\n"""
if entry.strip() not in s:
    s += entry
p.write_text(s)
PY
pnpm exec prettier --write docs/implementation/device-rule-decoupling-progress.md
git diff --check

git add apps/mobile/src/routes/AppRoutes.tsx apps/mobile/src/__tests__/app-routes.test.tsx docs/implementation/device-rule-decoupling-progress.md
git commit -m 'Wire standalone device navigation'
git push origin HEAD:"$BRANCH"
test -z "$(git status --porcelain)"
echo ROUTING_CUTOVER_HEAD=$(git rev-parse HEAD)

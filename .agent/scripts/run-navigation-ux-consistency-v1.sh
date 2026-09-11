#!/usr/bin/env sh
set -eu

BASE=d91da6045524d9ca6657f92d5b8b040502a3f1ae
BRANCH=work/navigation-ux-consistency-20260911

git fetch --prune origin
test "$(git rev-parse origin/main)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "origin/$BRANCH"

git status --short

grep -R -n "app-settings-trigger\|Co chcesz zrobić?\|showManage" apps/mobile/src apps/mobile/e2e || true

python3 - <<'PY'
from pathlib import Path

# AppRoutes: one navigation model, dashboard as root, no floating settings trigger.
p = Path('apps/mobile/src/routes/AppRoutes.tsx')
p.write_text('''import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
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

type SetupRouteIntent = Exclude<SetupIntent, 'manage'>;
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

  const selectIntent = (intent: SetupIntent, sourceKind: AppNavigationKind) => {
    if (intent === 'manage') {
      navigate({ type: 'dashboard', kind: sourceKind });
      return;
    }
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
        onSelect={(intent) => selectIntent(intent, route.sourceKind)}
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
        onBackToIntent={() =>
          navigate({ type: 'intent', sourceKind: route.sourceKind })
        }
        onNavigateDashboard={(kind) => navigate({ type: 'dashboard', kind })}
        onOpenSettings={openSettings}
        onSetupComplete={() => navigate({ type: 'dashboard', kind: route.sourceKind })}
      />
    </Suspense>
  );
};
''')

# Intent picker: add-flow only, shared title scale and persistent global nav.
p = Path('apps/mobile/src/screens/SetupIntentScreen.tsx')
p.write_text('''import { useTranslation } from '../app/i18n.js';
import {
  AppBottomNavigation,
  type AppNavigationKind
} from '../components/AppBottomNavigation.js';
import type { SetupIntent } from '../flows/setup-intent.js';

type SetupIntentScreenProps = {
  activeKind: AppNavigationKind;
  onSelect(intent: SetupIntent): void;
  onCancel(): void;
  onOpenClimate(): void;
  onOpenTime(): void;
  onOpenSettings?: () => void;
};

const INTENT_CHOICES = [
  {
    id: 'temperature',
    titleKey: 'intent.temperature.title',
    descriptionKey: 'intent.temperature.description'
  },
  {
    id: 'humidity',
    titleKey: 'intent.humidity.title',
    descriptionKey: 'intent.humidity.description'
  },
  {
    id: 'time',
    titleKey: 'intent.time.title',
    descriptionKey: 'intent.time.description'
  }
] as const;

export const SetupIntentScreen = ({
  activeKind,
  onSelect,
  onCancel,
  onOpenClimate,
  onOpenTime,
  onOpenSettings
}: SetupIntentScreenProps) => {
  const { t } = useTranslation();

  return (
    <main className="demo-shell intent-shell app-bottom-nav-shell">
      <div className="setup-context">
        <button className="setup-context__back" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>

      <header className="demo-header intent-header app-page-header">
        <div>
          <h1>{t('intent.title')}</h1>
        </div>
      </header>

      <section className="intent-choice-grid" aria-label={t('intent.choiceLabel')}>
        {INTENT_CHOICES.map((choice) => (
          <button
            key={choice.id}
            className="intent-choice"
            type="button"
            onClick={() => onSelect(choice.id)}
          >
            <span className="intent-choice__copy">
              <strong>{t(choice.titleKey)}</strong>
              <span>{t(choice.descriptionKey)}</span>
            </span>
            <span className="intent-choice__action" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </section>

      <AppBottomNavigation
        activeKind={activeKind}
        onOpenClimate={onOpenClimate}
        onOpenTime={onOpenTime}
        {...(onOpenSettings ? { onOpenSettings } : {})}
      />
    </main>
  );
};
''')

# Dashboard: preserve source tab when opening Add automation, mark shared page header.
p = Path('apps/mobile/src/screens/AutomationDashboardScreen.tsx')
s = p.read_text()
s = s.replace('  onAddAutomation(): void;', '  onAddAutomation(kind: AppNavigationKind): void;')
s = s.replace(
    '<header className="demo-header dashboard-header">',
    '<header className="demo-header dashboard-header app-page-header">'
)
s = s.replace('        onClick={onAddAutomation}', '        onClick={() => onAddAutomation(activeKind)}')
p.write_text(s)

# Settings: opt into the same page-header pattern.
p = Path('apps/mobile/src/app/AppSettingsScreen.tsx')
s = p.read_text().replace(
    '<header className="demo-header app-settings-screen__header">',
    '<header className="demo-header app-settings-screen__header app-page-header">'
)
p.write_text(s)

# Hardware setup: keep local setup tabs, restore global bottom navigation.
p = Path('apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx')
s = p.read_text()
s = s.replace(
    "import { useTranslation } from '../../app/i18n.js';\n",
    "import { useTranslation } from '../../app/i18n.js';\nimport {\n  AppBottomNavigation,\n  type AppNavigationKind\n} from '../../components/AppBottomNavigation.js';\n"
)
s = s.replace(
    "type HardwareSetupScreenProps = {\n  setupIntent?: SetupIntent;\n  onBackToIntent?: () => void;\n  onSetupComplete?: () => void;\n};",
    "type HardwareSetupScreenProps = {\n  setupIntent?: SetupIntent;\n  navigationKind?: AppNavigationKind;\n  onBackToIntent?: () => void;\n  onNavigateDashboard?: (kind: AppNavigationKind) => void;\n  onOpenSettings?: () => void;\n  onSetupComplete?: () => void;\n};"
)
s = s.replace(
    "export const HardwareSetupScreen = ({\n  setupIntent,\n  onBackToIntent,\n  onSetupComplete\n}: HardwareSetupScreenProps = {}) => {",
    "export const HardwareSetupScreen = ({\n  setupIntent,\n  navigationKind,\n  onBackToIntent,\n  onNavigateDashboard,\n  onOpenSettings,\n  onSetupComplete\n}: HardwareSetupScreenProps = {}) => {"
)
s = s.replace(
    "  const availableTabs = useMemo(() => availableTabsForIntent(setupIntent), [setupIntent]);",
    "  const availableTabs = useMemo(() => availableTabsForIntent(setupIntent), [setupIntent]);\n  const activeNavigationKind =\n    navigationKind ?? (setupIntent === 'time' ? 'time' : 'climate');"
)
s = s.replace(
    '<main className="demo-shell hardware-shell">',
    '<main className="demo-shell hardware-shell app-bottom-nav-shell">'
)
marker = "      {setupIntent !== 'time' && activeTab === 'diagnostics' && (\n        <>\n"
if marker not in s:
    raise SystemExit('hardware diagnostics marker missing')
end_marker = "      )}\n    </main>\n  );\n};"
if end_marker not in s:
    raise SystemExit('hardware end marker missing')
nav = """      )}\n\n      {onNavigateDashboard && (\n        <AppBottomNavigation\n          activeKind={activeNavigationKind}\n          onOpenClimate={() => onNavigateDashboard('climate')}\n          onOpenTime={() => onNavigateDashboard('time')}\n          {...(onOpenSettings ? { onOpenSettings } : {})}\n        />\n      )}\n    </main>\n  );\n};"""
s = s.replace(end_marker, nav, 1)
p.write_text(s)

# Installation detail: time detail gets the same global nav; not-found state does too.
p = Path('apps/mobile/src/screens/InstallationDetailScreen.tsx')
s = p.read_text()
old = """        </header>\n      </main>"""
new = """        </header>\n        <AppBottomNavigation\n          activeKind=\"climate\"\n          onOpenClimate={() =>\n            onNavigateDashboard ? onNavigateDashboard('climate') : onBack()\n          }\n          onOpenTime={() =>\n            onNavigateDashboard ? onNavigateDashboard('time') : onBack()\n          }\n          {...(onOpenSettings ? { onOpenSettings } : {})}\n        />\n      </main>"""
if s.count(old) != 1:
    raise SystemExit(f'installation not-found marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)
old = """  if (installation.kind === 'time') {\n    return <TimeInstallationDetail installation={installation} onBack={onBack} />;\n  }"""
new = """  if (installation.kind === 'time') {\n    return (\n      <TimeInstallationDetail\n        installation={installation}\n        onBack={onBack}\n        {...(onNavigateDashboard ? { onNavigateDashboard } : {})}\n        {...(onOpenSettings ? { onOpenSettings } : {})}\n      />\n    );\n  }"""
if old not in s:
    raise SystemExit('time installation branch marker missing')
s = s.replace(old, new, 1)
p.write_text(s)

# Time detail: remove old top back affordance and use the same bottom nav as climate detail.
p = Path('apps/mobile/src/screens/TimeInstallationDetail.tsx')
s = p.read_text()
s = s.replace(
    "import { RefreshIconButton } from '../components/RefreshIconButton.js';\n",
    "import {\n  AppBottomNavigation,\n  type AppNavigationKind\n} from '../components/AppBottomNavigation.js';\nimport { RefreshIconButton } from '../components/RefreshIconButton.js';\n"
)
s = s.replace(
    "type TimeInstallationDetailProps = {\n  installation: TimeInstalledAutomation;\n  onBack(): void;\n};",
    "type TimeInstallationDetailProps = {\n  installation: TimeInstalledAutomation;\n  onBack(): void;\n  onNavigateDashboard?: (kind: AppNavigationKind) => void;\n  onOpenSettings?: () => void;\n};"
)
s = s.replace(
    "export const TimeInstallationDetail = ({\n  installation,\n  onBack\n}: TimeInstallationDetailProps) => {",
    "export const TimeInstallationDetail = ({\n  installation,\n  onBack,\n  onNavigateDashboard,\n  onOpenSettings\n}: TimeInstallationDetailProps) => {"
)
s = s.replace(
    '<main className="demo-shell installation-detail-shell">',
    '<main className="demo-shell installation-detail-shell app-bottom-nav-shell">'
)
back_block = """          <button className=\"detail-back-link\" type=\"button\" onClick={onBack}>\n            ← {t('detail.backToDashboard')}\n          </button>\n"""
if s.count(back_block) != 1:
    raise SystemExit(f'time detail back block mismatch: {s.count(back_block)}')
s = s.replace(back_block, '', 1)
insert_before = """      <Modal\n        actions={"""
nav = """      <AppBottomNavigation\n        activeKind=\"time\"\n        onOpenClimate={() =>\n          onNavigateDashboard ? onNavigateDashboard('climate') : onBack()\n        }\n        onOpenTime={() => (onNavigateDashboard ? onNavigateDashboard('time') : onBack())}\n        {...(onOpenSettings ? { onOpenSettings } : {})}\n      />\n\n      <Modal\n        actions={"""
if s.count(insert_before) != 1:
    raise SystemExit(f'time detail modal marker mismatch: {s.count(insert_before)}')
s = s.replace(insert_before, nav, 1)
p.write_text(s)

# Shared production page-header scale, matching Dashboard and Settings.
p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
marker = """.demo-header {\n  align-items: flex-start;\n  display: flex;\n  gap: var(--lcl-spacing-lg);\n  justify-content: space-between;\n}\n"""
addition = marker + """\n.app-page-header {\n  align-items: center;\n  min-height: var(--lcl-size-control-min-height);\n}\n\n.app-page-header h1 {\n  font-size: calc(var(--lcl-font-size-2xl) + var(--lcl-spacing-md));\n  line-height: var(--lcl-line-height-tight);\n}\n"""
if s.count(marker) != 1:
    raise SystemExit(f'page header css marker mismatch: {s.count(marker)}')
s = s.replace(marker, addition, 1)
p.write_text(s)

# Route-level regression tests now encode dashboard-first UX and source-tab continuity.
p = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
p.write_text('''import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { createInstalledAutomation } from '../flows/installations/model.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';
import type { SetupIntent } from '../flows/setup-intent.js';

const nativeAppMocks = vi.hoisted(() => {
  let backListener: (() => void) | undefined;
  const removeListener = vi.fn(async () => undefined);
  const addListener = vi.fn(async (eventName: string, listener: () => void) => {
    if (eventName === 'backButton') backListener = listener;
    return { remove: removeListener };
  });
  return {
    addListener,
    exitApp: vi.fn(async () => undefined),
    getPlatform: vi.fn(() => 'web'),
    removeListener,
    fireBack: () => backListener?.(),
    resetListener: () => {
      backListener = undefined;
    }
  };
});

vi.mock('@capacitor/app', () => ({
  App: { addListener: nativeAppMocks.addListener, exitApp: nativeAppMocks.exitApp }
}));

vi.mock(import('@capacitor/core'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, getPlatform: nativeAppMocks.getPlatform }
  };
});

vi.mock('../screens/InstallationDetailScreen.js', () => ({
  InstallationDetailScreen: ({
    installationId,
    onBack,
    onNavigateDashboard
  }: {
    installationId: string;
    onBack: () => void;
    onNavigateDashboard?: (kind: 'climate' | 'time') => void;
  }) => (
    <section>
      <p>{`mock-installation-${installationId}`}</p>
      <button type="button" onClick={onBack}>mock-dashboard-back</button>
      <button type="button" onClick={() => onNavigateDashboard?.('time')}>
        mock-dashboard-time
      </button>
    </section>
  )
}));

vi.mock('../screens/hardware-setup/HardwareSetupScreen.js', () => ({
  HardwareSetupScreen: ({
    setupIntent,
    onBackToIntent,
    onSetupComplete
  }: {
    setupIntent?: SetupIntent;
    onBackToIntent?: () => void;
    onSetupComplete?: () => void;
  }) => (
    <section>
      <p>{`mock-setup-${setupIntent ?? 'none'}`}</p>
      <button type="button" onClick={onBackToIntent}>mock-back</button>
      <button type="button" onClick={onSetupComplete}>mock-complete</button>
    </section>
  )
}));

import { AppRoutes } from '../routes/AppRoutes.js';

const renderRoutes = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
      </QueryClientProvider>
    </I18nProvider>
  );
};

const addClimateInstallation = (suffix = 'route') => {
  const config = createDefaultShellyThermostatConfig(
    'xiaomi_lywsd03mmc_bthome_v2',
    'heating'
  );
  const installation = createInstalledAutomation({
    shelly: { id: `shellyplugsg3-${suffix}`, model: 'S3PL-00112EU', gen: 3 },
    shellyName: 'Salon',
    baseUrl: 'http://192.168.0.20/',
    scriptId: 1,
    scriptHash: `lcl-${suffix}`,
    config,
    nowMs: 1000
  });
  useInstalledAutomationStore.getState().upsertInstallation(installation);
  return installation;
};

describe('AppRoutes navigation shell', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    resetInstalledAutomationStore();
    nativeAppMocks.resetListener();
    nativeAppMocks.getPlatform.mockReturnValue('web');
    nativeAppMocks.addListener.mockClear();
    nativeAppMocks.exitApp.mockClear();
    nativeAppMocks.removeListener.mockClear();
  });

  it('keeps native back handling disabled in the web preview', () => {
    renderRoutes();
    expect(nativeAppMocks.addListener).not.toHaveBeenCalled();
  });

  it('uses the empty dashboard as the canonical zero-installation root', () => {
    renderRoutes();
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Dodaj automatykę' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Klimat' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.queryByRole('heading', { name: 'Co chcesz zrobić?' })).toBeNull();
    expect(document.querySelector('.app-settings-trigger')).toBeNull();
  });

  it('opens Add automation only from plus and does not expose legacy manage choice', () => {
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować temperaturą/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować wilgotnością/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sterować według czasu/ })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Zarządzać istniejącą automatyką/ })
    ).toBeNull();
    expect(document.querySelector('.app-settings-trigger')).toBeNull();
  });

  it('returns from Add automation to the dashboard tab that opened it', () => {
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('keeps Settings available through bottom navigation from Add automation', () => {
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }));
    expect(screen.getByRole('heading', { name: 'Ustawienia' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('returns from Android setup through intent and dashboard before exiting', async () => {
    nativeAppMocks.getPlatform.mockReturnValue('android');
    const view = renderRoutes();
    await waitFor(() =>
      expect(nativeAppMocks.addListener).toHaveBeenCalledWith('backButton', expect.any(Function))
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
    fireEvent.click(screen.getByRole('button', { name: /Sterować temperaturą/ }));
    expect(await screen.findByText('mock-setup-temperature')).toBeVisible();

    act(() => nativeAppMocks.fireBack());
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    act(() => nativeAppMocks.fireBack());
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    act(() => nativeAppMocks.fireBack());
    await waitFor(() => expect(nativeAppMocks.exitApp).toHaveBeenCalledTimes(1));

    view.unmount();
    await waitFor(() => expect(nativeAppMocks.removeListener).toHaveBeenCalledTimes(1));
  });

  it('opens an installed system by stable id and returns to its dashboard', () => {
    const installation = addClimateInstallation('detail');
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-dashboard-back' }));
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Klimat' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('opens the selected goal, keeps global nav in setup, and completes to dashboard', async () => {
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));
    expect(await screen.findByText('mock-setup-time')).toBeVisible();
    act(() => addClimateInstallation('setup-complete'));
    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
''')

# Navigation/settings regression test mock now exposes the bottom-nav Settings callback.
p = Path('apps/mobile/src/__tests__/navigation-settings-regression.test.tsx')
s = p.read_text()
s = s.replace(
    "AutomationDashboardScreen: ({ onAddAutomation }: { onAddAutomation(): void }) => (",
    "AutomationDashboardScreen: ({\n    onAddAutomation,\n    onOpenSettings\n  }: {\n    onAddAutomation(kind: 'climate' | 'time'): void;\n    onOpenSettings?: () => void;\n  }) => ("
)
s = s.replace(
    "      <button type=\"button\" onClick={onAddAutomation}>\n        add-automation-test\n      </button>",
    "      <button type=\"button\" onClick={() => onAddAutomation('climate')}>\n        add-automation-test\n      </button>\n      <button type=\"button\" onClick={onOpenSettings}>\n        Ustawienia aplikacji\n      </button>"
)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/screens/SetupIntentScreen.tsx \
  apps/mobile/src/screens/AutomationDashboardScreen.tsx \
  apps/mobile/src/app/AppSettingsScreen.tsx \
  apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx \
  apps/mobile/src/screens/InstallationDetailScreen.tsx \
  apps/mobile/src/screens/TimeInstallationDetail.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/app-routes.test.tsx \
  apps/mobile/src/__tests__/navigation-settings-regression.test.tsx

git diff --check

echo '=== TARGETED TESTS ==='
pnpm --filter @lcl/mobile test -- app-routes.test.tsx navigation-settings-regression.test.tsx automation-dashboard.test.tsx automation-detail.test.tsx

echo '=== MOBILE STATIC GATES ==='
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile lint
pnpm quality:ux
pnpm quality:repo

echo '=== FULL CHECK ==='
pnpm check:full

git grep -n 'app-settings-trigger' -- apps/mobile/src || true
if git grep -n 'showManage' -- apps/mobile/src; then
  echo 'legacy showManage remains in product code' >&2
  exit 41
fi

git add apps/mobile/src apps/mobile/e2e docs/HANDOFF_NEXT_CHAT.md
git diff --cached --check
git commit -m 'refactor(mobile): unify navigation and setup UX'
git push -u origin "$BRANCH"

echo NAVIGATION_UX_SHA=$(git rev-parse HEAD)
echo NAVIGATION_UX_BRANCH=$BRANCH
echo NAVIGATION_UX_OK=1

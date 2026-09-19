from pathlib import Path
import re

ROOT = Path('.')

def write(path: str, content: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]!r}')
    text = text.replace(old, new, count)
    p.write_text(text, encoding='utf-8')


def regex_replace(path: str, pattern: str, repl: str, count: int = 1, flags: int = re.S) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    text2, n = re.subn(pattern, repl, text, count=count, flags=flags)
    if n != count:
        raise SystemExit(f'regex expected {count} matches, got {n} in {path}: {pattern[:120]!r}')
    p.write_text(text2, encoding='utf-8')


write(
    'apps/mobile/src/components/AppPageBack.tsx',
    """type AppPageBackProps = {
  label: string;
  onBack(): void;
};

export const AppPageBack = ({ label, onBack }: AppPageBackProps) => (
  <div className=\"setup-context app-page-back-row\">
    <button className=\"setup-context__back\" type=\"button\" onClick={onBack}>
      ‹ {label}
    </button>
  </div>
);
""",
)

write(
    'apps/mobile/src/routes/AppRoutes.tsx',
    """import { App } from '@capacitor/app';
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
type DashboardRoute = { type: 'dashboard'; kind?: AppNavigationKind };
type SetupRoute = {
  type: 'setup';
  intent: SetupRouteIntent;
  sourceKind: AppNavigationKind;
  shellyId?: string;
};
type DeviceAddReturnRoute = DashboardRoute | SetupRoute;
type DeviceAddRoute = {
  type: 'device-add';
  device: 'plug' | 'sensor';
  sourceKind: AppNavigationKind;
  returnTo: DeviceAddReturnRoute;
};
type PrimaryAppRoute =
  | DashboardRoute
  | DeviceAddRoute
  | { type: 'intent'; sourceKind: AppNavigationKind; shellyId?: string }
  | SetupRoute
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
    <main className=\"demo-shell hardware-shell\">
      <section className=\"demo-panel\">
        <p role=\"status\">{t('app.loadingConfigurator')}</p>
      </section>
    </main>
  );
};

const activeNavigationForRoute = (route: AppRoute): AppNavigationKind | 'settings' => {
  if (route.type === 'settings') return 'settings';
  if (route.type === 'dashboard') return route.kind ?? 'climate';
  if (route.type === 'installation') return route.kind;
  if (route.type === 'device-add') return route.sourceKind;
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
  if (route.type === 'device-add') return route.returnTo;
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
        activeKind={route.sourceKind}
        onCancel={() => navigate({ type: 'dashboard', kind: route.sourceKind })}
        onSelect={(intent) => selectIntent(intent, route.sourceKind, route.shellyId)}
      />
    );
  } else if (route.type === 'dashboard') {
    const dashboardKind = route.kind ?? 'climate';
    content = (
      <AutomationDashboardScreen
        {...(route.kind ? { initialKind: route.kind } : {})}
        onAddPlug={() =>
          navigate({
            type: 'device-add',
            device: 'plug',
            sourceKind: 'climate',
            returnTo: { type: 'dashboard', kind: 'climate' }
          })
        }
        onAddThermometer={() =>
          navigate({
            type: 'device-add',
            device: 'sensor',
            sourceKind: 'time',
            returnTo: { type: 'dashboard', kind: 'time' }
          })
        }
        onAddAutomation={(kind, shellyId) => {
          if (shellyId) selectShellyDevice(shellyId);
          if (kind === 'time') {
            navigate({ type: 'setup', intent: 'time', sourceKind: dashboardKind });
            return;
          }
          navigate({
            type: 'intent',
            sourceKind: dashboardKind,
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
  } else if (route.type === 'device-add') {
    const leaveAddPage = () => navigate(route.returnTo);
    content = (
      <Suspense fallback={<RouteFallback />}>
        <HardwareSetupScreen
          {...(route.device === 'plug' ? { plugAddOnly: true } : { sensorAddOnly: true })}
          {...(route.device === 'plug'
            ? {
                onPlugAddComplete: leaveAddPage,
                onPlugAddCancel: leaveAddPage
              }
            : {
                onSensorAddComplete: leaveAddPage,
                onSensorAddCancel: leaveAddPage
              })}
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
    const openDeviceAdd = (device: 'plug' | 'sensor') =>
      navigate({
        type: 'device-add',
        device,
        sourceKind: route.sourceKind,
        returnTo: route
      });
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
          onOpenPlugAdd={() => openDeviceAdd('plug')}
          onOpenSensorAdd={() => openDeviceAdd('sensor')}
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
""",
)

write(
    'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx',
    """import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../app/i18n.js';
import type { AppNavigationKind } from '../../components/AppBottomNavigation.js';
import { AppPageBack } from '../../components/AppPageBack.js';
import { useHardwareSetupFlow } from '../../flows/hardware-setup/useHardwareSetupFlow.js';
import {
  defaultRulePresetForSetupIntent,
  rulePresetsForSetupIntent,
  type SetupIntent
} from '../../flows/setup-intent.js';
import { RuleSetupPage } from './pages/RuleSetupPage.js';
import { SensorSetupPage } from './pages/SensorSetupPage.js';
import { ShellySetupPage } from './pages/ShellySetupPage.js';
import { TimeScheduleSetupPage } from './pages/TimeScheduleSetupPage.js';

const CLIMATE_HARDWARE_TABS = [
  {
    id: 'shelly',
    labelKey: 'hardware.nav.shelly',
    titleKey: 'hardware.nav.shellyTitle'
  },
  {
    id: 'sensor',
    labelKey: 'hardware.nav.sensor',
    titleKey: 'hardware.nav.sensorTitle'
  },
  {
    id: 'rule',
    labelKey: 'hardware.nav.rule',
    titleKey: 'hardware.nav.ruleTitle'
  }
] as const;

const PLUG_ADD_HARDWARE_TABS = [CLIMATE_HARDWARE_TABS[0]] as const;
const SENSOR_ADD_HARDWARE_TABS = [CLIMATE_HARDWARE_TABS[1]] as const;

const TIME_HARDWARE_TABS = [
  {
    id: 'shelly',
    labelKey: 'hardware.nav.shelly',
    titleKey: 'hardware.nav.shellyTitle'
  },
  {
    id: 'schedule',
    labelKey: 'time.nav.schedule',
    titleKey: 'time.nav.scheduleTitle'
  }
] as const;

type PrimaryHardwareTabId = 'shelly' | 'sensor' | 'rule' | 'schedule';
type HardwareTabId = PrimaryHardwareTabId;
type LocalAddPage = 'plug' | 'sensor' | null;

const availableTabsForIntent = (
  setupIntent?: SetupIntent,
  fixedShellyId?: string,
  plugAddOnly = false,
  sensorAddOnly = false
) => {
  if (plugAddOnly) return PLUG_ADD_HARDWARE_TABS;
  if (sensorAddOnly) return SENSOR_ADD_HARDWARE_TABS;
  if (setupIntent === 'time') {
    return fixedShellyId
      ? TIME_HARDWARE_TABS.filter((tab) => tab.id === 'schedule')
      : TIME_HARDWARE_TABS;
  }
  return fixedShellyId
    ? CLIMATE_HARDWARE_TABS.filter((tab) => tab.id === 'rule')
    : CLIMATE_HARDWARE_TABS;
};

const currentTabFromHash = (availableTabs: readonly { id: string }[]): HardwareTabId => {
  if (typeof window === 'undefined') {
    return (availableTabs[0]?.id as HardwareTabId | undefined) ?? 'shelly';
  }

  const hashValue = window.location.hash.replace(/^#/, '');
  return availableTabs.some((tab) => tab.id === hashValue)
    ? (hashValue as PrimaryHardwareTabId)
    : ((availableTabs[0]?.id as PrimaryHardwareTabId | undefined) ?? 'shelly');
};

const setHashTab = (tabId: HardwareTabId) => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.hash = tabId;
  window.history.replaceState(null, '', url);
};

type HardwareSetupScreenProps = {
  setupIntent?: SetupIntent;
  navigationKind?: AppNavigationKind;
  onBackToIntent?: () => void;
  onNavigateDashboard?: (kind: AppNavigationKind) => void;
  onOpenSettings?: () => void;
  onSetupComplete?: () => void;
  onOpenPlugAdd?: () => void;
  onOpenSensorAdd?: () => void;
  fixedShellyId?: string;
  plugAddOnly?: boolean;
  sensorAddOnly?: boolean;
  onPlugAddComplete?: () => void;
  onPlugAddCancel?: () => void;
  onSensorAddComplete?: () => void;
  onSensorAddCancel?: () => void;
};

export const HardwareSetupScreen = ({
  setupIntent,
  onBackToIntent,
  onSetupComplete,
  onOpenPlugAdd,
  onOpenSensorAdd,
  fixedShellyId,
  plugAddOnly = false,
  sensorAddOnly = false,
  onPlugAddComplete,
  onPlugAddCancel,
  onSensorAddComplete,
  onSensorAddCancel
}: HardwareSetupScreenProps = {}) => {
  const { t } = useTranslation();
  const flow = useHardwareSetupFlow();
  const { rulePreset, setRulePreset, selectedShellyId, selectShellyDevice } = flow;
  const availableTabs = useMemo(
    () => availableTabsForIntent(setupIntent, fixedShellyId, plugAddOnly, sensorAddOnly),
    [fixedShellyId, plugAddOnly, sensorAddOnly, setupIntent]
  );
  const [activeTab, setActiveTab] = useState<HardwareTabId>(() =>
    currentTabFromHash(availableTabs)
  );
  const [localAddPage, setLocalAddPage] = useState<LocalAddPage>(null);
  const selectableRulePresets = useMemo(
    () => rulePresetsForSetupIntent(setupIntent),
    [setupIntent]
  );
  const cleanupBleDiscoveryRef = useRef<() => void>(() => undefined);
  const stopSavedSensorLiveScanRef = useRef<() => void>(() => undefined);
  const stopPhoneBleScanRef = useRef<() => void>(() => undefined);
  const stopShellyScanRef = useRef<() => void>(() => undefined);
  cleanupBleDiscoveryRef.current = flow.cleanupBleDiscovery;
  stopSavedSensorLiveScanRef.current = flow.stopSavedSensorLiveScan;
  stopPhoneBleScanRef.current = flow.stopPhoneBleScan;
  stopShellyScanRef.current = flow.stopShellyScan;

  useEffect(() => {
    if (!fixedShellyId || selectedShellyId === fixedShellyId) return;
    selectShellyDevice(fixedShellyId);
  }, [fixedShellyId, selectShellyDevice, selectedShellyId]);

  useEffect(() => {
    if (!setupIntent) return;
    const defaultPreset = defaultRulePresetForSetupIntent(setupIntent);
    if (defaultPreset && !selectableRulePresets.includes(rulePreset)) {
      setRulePreset(defaultPreset);
    }
  }, [rulePreset, selectableRulePresets, setRulePreset, setupIntent]);

  useEffect(() => {
    const handleHashChange = () => setActiveTab(currentTabFromHash(availableTabs));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [availableTabs]);

  useEffect(() => {
    const cleanup = () => {
      cleanupBleDiscoveryRef.current();
      stopSavedSensorLiveScanRef.current();
      stopPhoneBleScanRef.current();
      stopShellyScanRef.current();
    };
    window.addEventListener('pagehide', cleanup);
    return () => {
      cleanup();
      window.removeEventListener('pagehide', cleanup);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'shelly') cleanupBleDiscoveryRef.current();
    if (activeTab !== 'sensor' && activeTab !== 'rule') {
      stopSavedSensorLiveScanRef.current();
    }
  }, [activeTab]);

  const selectTab = (tabId: HardwareTabId) => {
    setActiveTab(tabId);
    setHashTab(tabId);
  };

  const openPlugAdd = onOpenPlugAdd ?? (() => setLocalAddPage('plug'));
  const openSensorAdd = onOpenSensorAdd ?? (() => setLocalAddPage('sensor'));
  const closeLocalAdd = () => setLocalAddPage(null);

  if (localAddPage !== null) {
    const isPlug = localAddPage === 'plug';
    return (
      <main className=\"demo-shell hardware-shell\">
        <AppPageBack
          label={isPlug ? t('hardware.nav.shelly') : t('hardware.nav.sensor')}
          onBack={closeLocalAdd}
        />
        {isPlug ? (
          <ShellySetupPage
            flow={flow}
            addOnly
            enableBleDiscovery={setupIntent !== 'time'}
            onAddComplete={closeLocalAdd}
          />
        ) : (
          <SensorSetupPage
            flow={flow}
            addOnly
            primaryAddAction=\"phone-scan\"
            onAddComplete={closeLocalAdd}
          />
        )}
      </main>
    );
  }

  return (
    <main className=\"demo-shell hardware-shell\">
      {plugAddOnly && onPlugAddCancel && (
        <AppPageBack label={t('dashboard.climateTab')} onBack={onPlugAddCancel} />
      )}
      {sensorAddOnly && onSensorAddCancel && (
        <AppPageBack label={t('dashboard.timeTab')} onBack={onSensorAddCancel} />
      )}
      {setupIntent && onBackToIntent && !plugAddOnly && !sensorAddOnly && (
        <div className=\"setup-context\">
          <button className=\"setup-context__back\" type=\"button\" onClick={onBackToIntent}>
            {t('intent.back')}
          </button>
          <strong>{t(`intent.${setupIntent}.context`)}</strong>
        </div>
      )}

      {!plugAddOnly && !sensorAddOnly && availableTabs.length > 1 && (
        <nav className=\"setup-top-nav\" aria-label={t('hardware.nav.label')}>
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              className={
                activeTab === tab.id
                  ? 'setup-top-nav__item setup-top-nav__item--active'
                  : 'setup-top-nav__item'
              }
              type=\"button\"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              title={t(tab.titleKey)}
              onClick={() => selectTab(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      )}

      {activeTab === 'shelly' && (
        <ShellySetupPage
          flow={flow}
          enableBleDiscovery={setupIntent !== 'time'}
          addOnly={plugAddOnly}
          onAddRequest={openPlugAdd}
          {...(onPlugAddComplete ? { onAddComplete: onPlugAddComplete } : {})}
        />
      )}
      {setupIntent !== 'time' && activeTab === 'sensor' && (
        <SensorSetupPage
          flow={flow}
          addOnly={sensorAddOnly}
          onAddRequest={openSensorAdd}
          primaryAddAction={sensorAddOnly ? 'phone-scan' : 'manual'}
          {...(onSensorAddComplete ? { onAddComplete: onSensorAddComplete } : {})}
        />
      )}
      {setupIntent !== 'time' && activeTab === 'rule' && (
        <RuleSetupPage
          flow={flow}
          selectablePresets={selectableRulePresets}
          showShellySelector={!fixedShellyId}
        />
      )}
      {setupIntent === 'time' && activeTab === 'schedule' && (
        <TimeScheduleSetupPage
          flow={flow}
          {...(onSetupComplete ? { onInstalled: onSetupComplete } : {})}
        />
      )}
    </main>
  );
};
""",
)

write(
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx',
    """import type { SensorSetupFlow } from '../pageContracts.js';
import { useToastQueue } from '../useToastQueue.js';
import { Modal, ToastViewport } from '@lcl/ui';
import { IconPlus, IconTemperature } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { HardwarePageProps } from '../helpers.js';
import { useSensorSetupFeedback } from './useSensorSetupFeedback.js';
import {
  formatSensorMetric,
  SavedSensorCard,
  SensorAddForm,
  sensorProfileDisplayLabels
} from './SensorSetupPresentation.js';

type SensorDraftDevice = SensorSetupFlow['sensorDevices'][number];
type SensorDialogState = { kind: 'none' } | { kind: 'remove'; device: SensorDraftDevice };
type SensorAddMode = 'manual' | 'phone-scan';

type SensorSetupPageProps = HardwarePageProps<SensorSetupFlow> & {
  primaryAddAction?: SensorAddMode;
  embedded?: boolean;
  addOnly?: boolean;
  onAddRequest?: () => void;
  onAddComplete?: () => void;
};

export const SensorSetupPage = ({
  flow,
  primaryAddAction = 'manual',
  embedded = false,
  addOnly = false,
  onAddRequest,
  onAddComplete
}: SensorSetupPageProps) => {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<SensorDialogState>({ kind: 'none' });
  const [editingSensorId, setEditingSensorId] = useState<string | null>(null);
  const [didSubmitSensorAdd, setDidSubmitSensorAdd] = useState(false);
  const [addMode, setAddMode] = useState<SensorAddMode>(primaryAddAction);
  const autoScanStartedRef = useRef(false);
  const { dismissToast, pushToast, toasts } = useToastQueue('sensor-toast');
  const sensorPendingRemoval = dialog.kind === 'remove' ? dialog.device : null;
  const isPhoneBleScanPending = flow.phoneBleScanMutation.isPending;
  const isSensorGattPending = flow.setPvvxTimeMutation.isPending;
  const shouldShowPhoneBleEmpty =
    flow.phoneBleScanMutation.isSuccess && flow.phoneBleScanCandidates.length === 0;
  const sensorDeviceCount = flow.sensorDevices.length;
  const shouldRunSavedSensorLiveScan = sensorDeviceCount > 0 && !addOnly && !isSensorGattPending;

  const { resetPhoneBleError } = useSensorSetupFeedback({
    flow,
    shouldRunSavedSensorLiveScan,
    pushToast,
    t
  });

  const startPhoneBleScan = () => {
    resetPhoneBleError();
    flow.startPhoneBleScan();
  };

  useEffect(() => {
    if (!addOnly || primaryAddAction !== 'phone-scan' || autoScanStartedRef.current) return;
    autoScanStartedRef.current = true;
    startPhoneBleScan();
  }, [addOnly, primaryAddAction]);

  useEffect(
    () => () => {
      if (addOnly) flow.stopPhoneBleScan();
    },
    [addOnly, flow.stopPhoneBleScan]
  );

  const selectAddMode = (mode: SensorAddMode) => {
    if (mode === addMode) return;
    if (addMode === 'phone-scan') {
      flow.stopPhoneBleScan();
      flow.resetPhoneBleScan();
    }
    setDidSubmitSensorAdd(false);
    setAddMode(mode);
    if (mode === 'phone-scan') startPhoneBleScan();
  };

  const addSensor = () => {
    setDidSubmitSensorAdd(true);
    if (!flow.sensorInputState.ok) return;
    flow.addSensorDraft();
    setDidSubmitSensorAdd(false);
    onAddComplete?.();
  };

  const saveScannedSensor = (candidate: BleDiscoveryCandidate) => {
    flow.addDiscoveredSensor(candidate);
    flow.stopPhoneBleScan();
    onAddComplete?.();
  };

  const confirmRemoveSensor = () => {
    if (!sensorPendingRemoval) return;
    flow.removeSensorDevice(sensorPendingRemoval.id);
    setDialog({ kind: 'none' });
    pushToast('ok', t('hardware.sensor.removed'));
  };

  const readingsForSensor = (device: SensorDraftDevice) =>
    flow.sensorSamplesById[device.id.toUpperCase()] ?? [];

  const scanContent = (
    <section className=\"sensor-add-scan\" role=\"tabpanel\" aria-label={t('hardware.sensor.scanBle')}>
      <div className=\"action-row device-add-page__actions\">
        <button
          className=\"secondary-action\"
          type=\"button\"
          title={
            isPhoneBleScanPending
              ? t('hardware.sensor.scanStopTitle')
              : t('hardware.sensor.scanAgainTitle')
          }
          onClick={isPhoneBleScanPending ? flow.stopPhoneBleScan : startPhoneBleScan}
        >
          {isPhoneBleScanPending
            ? t('hardware.shelly.scanStop')
            : t('hardware.shelly.scanBleAgain')}
        </button>
      </div>
      {shouldShowPhoneBleEmpty && <p>{t('hardware.sensor.noBleFound')}</p>}
      {flow.phoneBleScanCandidates.length > 0 && (
        <div className=\"ble-candidate-list\" aria-label={t('hardware.sensor.blePhoneFoundLabel')}>
          {flow.phoneBleScanCandidates.map((candidate) => {
            const hasTemperature = typeof candidate.temperatureC === 'number';
            const hasHumidity = typeof candidate.humidityPct === 'number';
            const isSavedSensor = flow.sensorDevices.some(
              (device) =>
                device.runtimeAddress.toUpperCase() === candidate.runtimeAddress.toUpperCase()
            );

            return (
              <article key={candidate.runtimeAddress} className=\"ble-candidate-item\">
                <div className=\"ble-candidate-main\">
                  <strong>{candidate.runtimeAddress}</strong>
                  <span>{sensorProfileDisplayLabels[candidate.profileId]}</span>
                </div>
                <dl className=\"ble-candidate-metrics\">
                  <div>
                    <dt>RSSI</dt>
                    <dd>{formatSensorMetric(candidate.rssi, ' dBm', 0, t('common.missing'))}</dd>
                  </div>
                  {hasTemperature && (
                    <div>
                      <dt>{t('hardware.metrics.temperatureShort')}</dt>
                      <dd>
                        {formatSensorMetric(
                          candidate.temperatureC,
                          '°C',
                          1,
                          t('common.missing')
                        )}
                      </dd>
                    </div>
                  )}
                  {hasHumidity && (
                    <div>
                      <dt>{t('hardware.metrics.humidityShort')}</dt>
                      <dd>
                        {formatSensorMetric(
                          candidate.humidityPct,
                          '%',
                          1,
                          t('common.missing')
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
                <button
                  className=\"secondary-action ble-candidate-action\"
                  type=\"button\"
                  disabled={isSavedSensor}
                  title={
                    isSavedSensor
                      ? t('hardware.sensor.saveThermometerSavedTitle')
                      : t('hardware.sensor.saveThermometerTitle')
                  }
                  onClick={() => saveScannedSensor(candidate)}
                >
                  {isSavedSensor ? t('hardware.sensor.saved') : t('hardware.sensor.saveThermometer')}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );

  if (addOnly) {
    return (
      <section className=\"automation-card device-add-page sensor-add-page\" aria-label={t('hardware.sensor.add')}>
        <div className=\"installation-section-heading\">
          <h1>{t('hardware.sensor.add')}</h1>
        </div>
        <div className=\"shelly-add-tabs\" role=\"tablist\" aria-label={t('hardware.sensor.add')}>
          <button
            className=\"shelly-add-tabs__tab\"
            type=\"button\"
            role=\"tab\"
            aria-selected={addMode === 'phone-scan'}
            onClick={() => selectAddMode('phone-scan')}
          >
            {t('hardware.sensor.scanBle')}
          </button>
          <button
            className=\"shelly-add-tabs__tab\"
            type=\"button\"
            role=\"tab\"
            aria-selected={addMode === 'manual'}
            onClick={() => selectAddMode('manual')}
          >
            {t('hardware.shelly.addManual')}
          </button>
        </div>
        {addMode === 'phone-scan' ? (
          scanContent
        ) : (
          <section className=\"sensor-manual-add\" role=\"tabpanel\" aria-label={t('hardware.shelly.addManual')}>
            <SensorAddForm flow={flow} showValidationErrors={didSubmitSensorAdd} />
            <div className=\"action-row device-add-page__actions\">
              <button className=\"primary-action\" type=\"button\" onClick={addSensor}>
                {t('common.add')}
              </button>
            </div>
          </section>
        )}
        <ToastViewport
          dismissLabel={t('toast.dismiss')}
          label={t('toast.regionLabel')}
          toasts={toasts}
          onDismiss={dismissToast}
        />
      </section>
    );
  }

  return (
    <section
      className={embedded ? 'sensor-setup-panel sensor-setup-panel--embedded' : 'demo-panel sensor-setup-panel'}
      aria-label={t('hardware.nav.sensorTitle')}
    >
      <button
        className={primaryAddAction === 'phone-scan' ? 'primary-action dashboard-fab' : 'primary-action setup-add-fab'}
        type=\"button\"
        aria-label={primaryAddAction === 'phone-scan' ? t('hardware.sensor.scanPhoneTitle') : t('hardware.sensor.add')}
        title={primaryAddAction === 'phone-scan' ? t('hardware.sensor.scanPhoneTitle') : t('hardware.sensor.addTitle')}
        onClick={onAddRequest}
      >
        <IconPlus
          className={primaryAddAction === 'phone-scan' ? 'dashboard-fab__icon' : 'setup-add-fab__icon'}
          aria-hidden=\"true\"
        />
      </button>

      <Modal
        closeLabel={t('common.cancel')}
        description={sensorPendingRemoval?.name ?? ''}
        open={sensorPendingRemoval !== null}
        title={t('hardware.sensor.deleteConfirmTitle')}
        actions={
          <button
            className=\"secondary-action secondary-action--danger\"
            type=\"button\"
            title={t('hardware.sensor.deleteTitle')}
            onClick={confirmRemoveSensor}
          >
            {t('common.delete')}
          </button>
        }
        onClose={() => setDialog({ kind: 'none' })}
      >
        <p>{t('hardware.sensor.deleteDescription')}</p>
      </Modal>
      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />

      <div className=\"saved-list\" aria-label={t('hardware.sensor.savedListLabel')}>
        {flow.sensorDevices.length === 0 &&
          (embedded ? (
            <div className=\"dashboard-kind-empty\">
              <IconTemperature className=\"dashboard-kind-empty__icon\" aria-hidden=\"true\" />
              <strong>{t('hardware.sensor.empty')}</strong>
            </div>
          ) : (
            <p>{t('hardware.sensor.empty')}</p>
          ))}
        {flow.sensorDevices.map((device) => (
          <SavedSensorCard
            key={device.id}
            device={device}
            samples={readingsForSensor(device)}
            isEditing={editingSensorId === device.id}
            pvvxTimePending={flow.setPvvxTimeMutation.isPending}
            onEditStart={() => setEditingSensorId(device.id)}
            onEditEnd={() => setEditingSensorId(null)}
            onNameChange={(value) => flow.setSensorDeviceName(device.id, value)}
            onPvvxSetTime={() => flow.setPvvxTimeMutation.mutate(device)}
            onRemove={() => setDialog({ kind: 'remove', device })}
          />
        ))}
      </div>
    </section>
  );
};
""",
)

# Shelly add becomes inline only in addOnly mode; regular lists route to the child page.
shelly = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace(
    shelly,
    "  onAddComplete?: () => void;\n  onAddCancel?: () => void;\n  onSettingsClose?: () => void;",
    "  onAddRequest?: () => void;\n  onAddComplete?: () => void;\n  onSettingsClose?: () => void;",
)
replace(
    shelly,
    "  onAddComplete,\n  onAddCancel,\n  onSettingsClose",
    "  onAddRequest,\n  onAddComplete,\n  onSettingsClose",
)
replace(
    shelly,
    "type ShellyDialogState =\n  | { kind: 'none' }\n  | { kind: 'add' }\n  | { kind: 'ble'; device: ShellyDraftDevice }",
    "type ShellyDialogState =\n  | { kind: 'none' }\n  | { kind: 'ble'; device: ShellyDraftDevice }",
)
regex_replace(
    shelly,
    r"  const \[dialog, setDialog\] = useState<ShellyDialogState>\(\(\) =>\n    addOnly\n      \? \{ kind: 'add' \}\n      : settingsOnlyDeviceId\n        \? \{ kind: 'info', deviceId: settingsOnlyDeviceId \}\n        : \{ kind: 'none' \}\n  \);",
    "  const [dialog, setDialog] = useState<ShellyDialogState>(() =>\n    settingsOnlyDeviceId\n      ? { kind: 'info', deviceId: settingsOnlyDeviceId }\n      : { kind: 'none' }\n  );",
)
replace(shelly, "  const isAddShellyModalOpen = dialog.kind === 'add';\n", "")
regex_replace(
    shelly,
    r"\n  const openAddShellyModal = \(\) => \{.*?\n  \};\n\n  const closeAddShellyModal = \(\) => \{.*?\n  \};\n",
    "\n",
)
replace(
    shelly,
    "    <section className=\"demo-panel\" aria-label={t('hardware.shelly.regionLabel')}>",
    "    <section\n      className={addOnly ? 'automation-card device-add-page shelly-add-page' : 'demo-panel'}\n      aria-label={addOnly ? t('hardware.shelly.add') : t('hardware.shelly.regionLabel')}\n    >",
)
replace(shelly, "          onClick={openAddShellyModal}", "          onClick={onAddRequest}")
# Replace add modal shell with an inline full-page body.
regex_replace(
    shelly,
    r"      <Modal\n        busy=\{flow\.checkShellyMutation\.isPending\}.*?        onClose=\{closeAddShellyModal\}\n      >\n",
    "      {addOnly && (\n        <>\n          <div className=\"installation-section-heading\">\n            <h1>{t('hardware.shelly.add')}</h1>\n          </div>\n          <div className=\"device-add-page__body\">\n",
)
# Replace the first closing Modal after the add body only.
text = (ROOT / shelly).read_text(encoding='utf-8')
anchor = text.index('          <div className="device-add-page__body">')
end = text.index('      </Modal>', anchor)
text = text[:end] + "          </div>\n        </>\n      )}" + text[end + len('      </Modal>'):]
(ROOT / shelly).write_text(text, encoding='utf-8')
# Keep the useful scan estimate visible now that the modal title info is gone.
replace(
    shelly,
    "            <div className=\"shelly-network-scan__body\">\n              <div className=\"shelly-network-scan__range\">",
    "            <div className=\"shelly-network-scan__body\">\n              <p className=\"device-add-page__hint\">{shellyScanEstimate}</p>\n              <div className=\"shelly-network-scan__range\">",
)

# Dashboard thermometer FAB routes to the new child page rather than opening a modal.
dash = 'apps/mobile/src/screens/AutomationDashboardScreen.tsx'
replace(
    dash,
    "const ThermometerDashboardSection = () => {\n  const flow = useHardwareSetupFlow();\n  return <SensorSetupPage flow={flow} primaryAddAction=\"phone-scan\" embedded />;\n};",
    "const ThermometerDashboardSection = ({ onAdd }: { onAdd(): void }) => {\n  const flow = useHardwareSetupFlow();\n  return (\n    <SensorSetupPage\n      flow={flow}\n      primaryAddAction=\"phone-scan\"\n      embedded\n      onAddRequest={onAdd}\n    />\n  );\n};",
)
replace(
    dash,
    "  onAddPlug(): void;\n  onAddAutomation(kind: AppNavigationKind, shellyId?: string): void;",
    "  onAddPlug(): void;\n  onAddThermometer(): void;\n  onAddAutomation(kind: AppNavigationKind, shellyId?: string): void;",
)
replace(
    dash,
    "  onAddPlug,\n  onAddAutomation,",
    "  onAddPlug,\n  onAddThermometer,\n  onAddAutomation,",
)
replace(dash, "          <ThermometerDashboardSection />", "          <ThermometerDashboardSection onAdd={onAddThermometer} />")

# Shared back navigation for child pages.
detail = 'apps/mobile/src/screens/InstallationDetailScreen.tsx'
replace(detail, "import type { AppNavigationKind } from '../components/AppBottomNavigation.js';", "import type { AppNavigationKind } from '../components/AppBottomNavigation.js';\nimport { AppPageBack } from '../components/AppPageBack.js';")
replace(
    detail,
    "      <div className=\"setup-context app-page-back-row\">\n        <button className=\"setup-context__back\" type=\"button\" onClick={onBack}>\n          ‹ {t('dashboard.climateTab')}\n        </button>\n      </div>",
    "      <AppPageBack label={t('dashboard.climateTab')} onBack={onBack} />",
)

diag = 'apps/mobile/src/screens/InstallationDiagnosticsScreen.tsx'
replace(diag, "import { useTranslation } from '../app/i18n.js';", "import { useTranslation } from '../app/i18n.js';\nimport { AppPageBack } from '../components/AppPageBack.js';")
replace(
    diag,
    "      <div className=\"setup-context app-page-back-row\">\n        <button className=\"setup-context__back\" type=\"button\" onClick={onBack}>\n          ‹ {installation.shelly.name}\n        </button>\n      </div>",
    "      <AppPageBack label={installation.shelly.name} onBack={onBack} />",
)

script = 'apps/mobile/src/screens/InstallationScriptScreen.tsx'
replace(script, "import { useTranslation } from '../app/i18n.js';", "import { useTranslation } from '../app/i18n.js';\nimport { AppPageBack } from '../components/AppPageBack.js';")
replace(
    script,
    "      <div className=\"setup-context app-page-back-row\">\n        <button className=\"setup-context__back\" type=\"button\" onClick={onBack}>\n          ‹ {installation.shelly.name}\n        </button>\n      </div>",
    "      <AppPageBack label={installation.shelly.name} onBack={onBack} />",
)

time_detail = 'apps/mobile/src/screens/TimeInstallationDetail.tsx'
replace(time_detail, "import type { AppNavigationKind } from '../components/AppBottomNavigation.js';", "import type { AppNavigationKind } from '../components/AppBottomNavigation.js';\nimport { AppPageBack } from '../components/AppPageBack.js';")
replace(
    time_detail,
    "    <main className=\"demo-shell installation-detail-shell\">\n      <header className=\"demo-header installation-detail-header\">",
    "    <main className=\"demo-shell installation-detail-shell\">\n      <AppPageBack label={t('dashboard.climateTab')} onBack={onBack} />\n      <header className=\"demo-header installation-detail-header\">",
)

intent = 'apps/mobile/src/screens/SetupIntentScreen.tsx'
replace(intent, "import type { AppNavigationKind } from '../components/AppBottomNavigation.js';", "import type { AppNavigationKind } from '../components/AppBottomNavigation.js';\nimport { AppPageBack } from '../components/AppPageBack.js';")
replace(
    intent,
    "export const SetupIntentScreen = ({ onSelect, onCancel }: SetupIntentScreenProps) => {",
    "export const SetupIntentScreen = ({\n  activeKind = 'climate',\n  onSelect,\n  onCancel\n}: SetupIntentScreenProps) => {",
)
replace(
    intent,
    "      <div className=\"setup-context\">\n        <button className=\"setup-context__back\" type=\"button\" onClick={onCancel}>\n          {t('common.cancel')}\n        </button>\n      </div>",
    "      <AppPageBack\n        label={activeKind === 'time' ? t('dashboard.timeTab') : t('dashboard.climateTab')}\n        onBack={onCancel}\n      />",
)

# Styling: full child pages use normal document flow, not modal geometry.
theme = ROOT / 'apps/mobile/src/theme/theme.css'
theme_text = theme.read_text(encoding='utf-8')
append_css = """

/* Full-page device add flow: page content owns the viewport; only confirmations use Modal. */
.device-add-page {
  display: grid;
  gap: var(--lcl-spacing-lg);
  min-width: 0;
}

.device-add-page__body,
.sensor-add-scan,
.sensor-manual-add {
  display: grid;
  gap: var(--lcl-spacing-md);
  min-width: 0;
}

.device-add-page__hint {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  margin: 0;
}

.device-add-page__actions {
  margin-top: 0;
}

.device-add-page .installation-section-heading h1 {
  font-size: var(--lcl-font-size-xl);
  margin: 0;
}
"""
if '/* Full-page device add flow:' not in theme_text:
    theme.write_text(theme_text.rstrip() + append_css + '\n', encoding='utf-8')

# UX gate locks the new boundary: add flows are pages, bottom nav stays root-owned.
ux = 'scripts/quality/ux-gate.mjs'
ux_path = ROOT / ux
ux_text = ux_path.read_text(encoding='utf-8')
insert_after = "const checkBottomNavigationShell = async () => {"
if 'const checkDeviceAddPageBoundary' not in ux_text:
    idx = ux_text.index(insert_after)
    block = """const checkDeviceAddPageBoundary = async () => {
  const sensorPath = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx';
  const shellyPath = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx';
  const routesPath = 'apps/mobile/src/routes/AppRoutes.tsx';
  const [sensorSource, shellySource, routesSource] = await Promise.all([
    readRepoFile(sensorPath),
    readRepoFile(shellyPath),
    readRepoFile(routesPath)
  ]);

  if (sensorSource.includes('isAddSensorModalOpen') || sensorSource.includes("kind: 'add'")) {
    addFailure(sensorPath, 'thermometer add flow must be a child page, not a modal');
  }
  if (shellySource.includes('isAddShellyModalOpen') || shellySource.includes("kind: 'add'")) {
    addFailure(shellyPath, 'plug add flow must be a child page, not a modal');
  }
  if (!routesSource.includes("type: 'device-add'")) {
    addFailure(routesPath, 'device add flows must be represented in the app page tree');
  }
};

"""
    ux_text = ux_text[:idx] + block + ux_text[idx:]
    # Call near the existing checks at the bottom.
    call_anchor = 'await checkBottomNavigationShell();'
    if call_anchor not in ux_text:
        raise SystemExit('UX gate bottom navigation call not found')
    ux_text = ux_text.replace(call_anchor, 'await checkDeviceAddPageBoundary();\n' + call_anchor, 1)
    ux_path.write_text(ux_text, encoding='utf-8')

# Update dashboard tests for the new callback and full-page thermometer add intent.
dash_test = 'apps/mobile/src/__tests__/automation-dashboard.test.tsx'
replace(
    dash_test,
    "  onOpenSettings = vi.fn(),\n  onAddPlug = vi.fn(),\n  initialKind: 'climate' | 'time' = 'climate'",
    "  onOpenSettings = vi.fn(),\n  onAddPlug = vi.fn(),\n  onAddThermometer = vi.fn(),\n  initialKind: 'climate' | 'time' = 'climate'",
)
replace(
    dash_test,
    "          <AutomationDashboardScreen\n            initialKind={kind}\n            onAddPlug={onAddPlug}",
    "          <AutomationDashboardScreen\n            initialKind={kind}\n            onAddPlug={onAddPlug}\n            onAddThermometer={onAddThermometer}",
)
replace(
    dash_test,
    "    onAddPlug,\n    queryClient,",
    "    onAddPlug,\n    onAddThermometer,\n    queryClient,",
)
# Calls with fifth positional argument were initialKind; shift to sixth.
text = (ROOT / dash_test).read_text(encoding='utf-8')
text = text.replace("renderDashboard(vi.fn(), vi.fn(), vi.fn(), vi.fn(), 'time')", "renderDashboard(vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), 'time')")
(ROOT / dash_test).write_text(text, encoding='utf-8')

# Hardware tests: same helpers, but their returned scope is now a child page rather than a dialog.
hw_test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
regex_replace(
    hw_test,
    r"const openShellyAddDialog = async \(section: 'manual' \| 'scan' = 'manual'\) => \{.*?\n\};",
    """const openShellyAddDialog = async (section: 'manual' | 'scan' = 'manual') => {
  fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));
  const heading = await screen.findByRole('heading', { name: 'Dodaj gniazdko' });
  const page = heading.closest('.device-add-page') as HTMLElement;
  expect(page).not.toBeNull();
  expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();
  if (section === 'manual') {
    fireEvent.click(within(page).getByRole('tab', { name: 'Dodaj ręcznie' }));
  }
  return page;
};""",
)
regex_replace(
    hw_test,
    r"const openSensorAddDialog = async \(\) => \{.*?\n\};",
    """const openSensorAddDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Dodaj termometr' }));
  const heading = await screen.findByRole('heading', { name: 'Dodaj termometr' });
  const page = heading.closest('.device-add-page') as HTMLElement;
  expect(page).not.toBeNull();
  expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();
  fireEvent.click(within(page).getByRole('tab', { name: 'Dodaj ręcznie' }));
  return page;
};""",
)
# Add helpers return to the parent page, so old negative dialog assertions remain harmless.
# Replace the modal focus test with the architectural boundary test.
regex_replace(
    hw_test,
    r"  it\('keeps keyboard focus inside setup modals and restores it on close', async \(\) => \{.*?\n  \}\);\n",
    """  it('opens device add flows as full child pages instead of modals', async () => {
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));
    const plugPage = await openShellyAddDialog('scan');
    expect(within(plugPage).getByRole('tab', { name: 'Skanuj sieć' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Shelly' }));

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const sensorPage = await openSensorAddDialog();
    expect(within(sensorPage).getByLabelText('MAC termometru')).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();
  });
""",
)

print('Device add page-tree migration applied')

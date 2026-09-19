from pathlib import Path
import re

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    source = read(path)
    if old not in source:
        raise SystemExit(f'missing pattern in {path}: {old[:120]!r}')
    source = source.replace(old, new, 1)
    write(path, source)


# Central persistent application shell.
write(
    'apps/mobile/src/components/AppShell.tsx',
    '''import type { ReactNode } from 'react';
import { AppBottomNavigation, type AppNavigationKind } from './AppBottomNavigation.js';

type AppShellProps = {
  activeKind: AppNavigationKind | 'settings';
  children: ReactNode;
  onOpenClimate(): void;
  onOpenTime(): void;
  onOpenSettings(): void;
};

export const AppShell = ({
  activeKind,
  children,
  onOpenClimate,
  onOpenTime,
  onOpenSettings
}: AppShellProps) => (
  <div className="app-root-shell app-bottom-nav-shell">
    {children}
    <AppBottomNavigation
      activeKind={activeKind}
      onOpenClimate={onOpenClimate}
      onOpenTime={onOpenTime}
      onOpenSettings={onOpenSettings}
    />
  </div>
);
'''
)

# Diagnostics is a page, not a dialog.
write(
    'apps/mobile/src/screens/InstallationDiagnosticsScreen.tsx',
    '''import { DiagnosticRow } from '@lcl/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';
import {
  useInstalledAutomationDiagnostics,
  useInstalledAutomationResourceDiagnostics
} from '../flows/installations/useInstalledAutomationRuntime.js';

export const INSTALLATION_DIAGNOSTICS_REFRESH_MS = 3_000;

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.trunc(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    return seconds === 0 ? `${totalMinutes} min` : `${totalMinutes} min ${seconds} s`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

const formatBytes = (value: number | null | undefined, missing: string): string => {
  if (value == null) return missing;
  return value < 1024 ? `${Math.round(value)} B` : `${(value / 1024).toFixed(1)} KiB`;
};

const formatNumber = (
  value: number | null | undefined,
  suffix: string,
  missing: string,
  digits = 1
): string => (value == null ? missing : `${value.toFixed(digits)}${suffix}`);

type InstallationDiagnosticsScreenProps = {
  installationId: string;
  onBack(): void;
};

export const InstallationDiagnosticsScreen = ({
  installationId,
  onBack
}: InstallationDiagnosticsScreenProps) => {
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const installation = useInstalledAutomationStore((state) =>
    state.installations.find((candidate) => candidate.id === installationId)
  );

  if (!installation || installation.kind !== 'climate') {
    return (
      <main className="demo-shell installation-detail-shell">
        <div className="setup-context">
          <button className="setup-context__back" type="button" onClick={onBack}>
            {t('detail.backToDashboard')}
          </button>
        </div>
        <section className="automation-card">
          <h1>{t('detail.notFoundTitle')}</h1>
        </section>
      </main>
    );
  }

  return (
    <InstallationDiagnosticsContent
      installation={installation}
      nowMs={nowMs}
      setNowMs={setNowMs}
      onBack={onBack}
    />
  );
};

type InstallationDiagnosticsContentProps = {
  installation: Extract<
    ReturnType<typeof useInstalledAutomationStore.getState>['installations'][number],
    { kind: 'climate' }
  >;
  nowMs: number;
  setNowMs(value: number): void;
  onBack(): void;
};

const InstallationDiagnosticsContent = ({
  installation,
  nowMs,
  setNowMs,
  onBack
}: InstallationDiagnosticsContentProps) => {
  const { t } = useTranslation();
  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation, {
    refetchInterval: INSTALLATION_DIAGNOSTICS_REFRESH_MS
  });
  const resourcesQuery = useInstalledAutomationResourceDiagnostics(installation, {
    refetchInterval: INSTALLATION_DIAGNOSTICS_REFRESH_MS
  });

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [setNowMs]);

  const snapshot = diagnosticsQuery.data;
  const diagnostics = snapshot?.diagnostics;
  const script = snapshot?.script;
  const resources = resourcesQuery.data;
  const missing = t('common.missing');
  const snapshotAge =
    diagnosticsQuery.dataUpdatedAt === 0
      ? missing
      : t('hardware.diagnostics.ageAgo', {
          duration: formatDuration(nowMs - diagnosticsQuery.dataUpdatedAt)
        });

  return (
    <main className="demo-shell installation-detail-shell installation-diagnostics-page">
      <div className="setup-context app-page-back-row">
        <button className="setup-context__back" type="button" onClick={onBack}>
          ‹ {installation.shelly.name}
        </button>
      </div>

      <section className="automation-card installation-diagnostics-page__card">
        <div className="installation-section-heading">
          <h1>{t('common.diagnostics')}</h1>
        </div>

        {diagnosticsQuery.isPending && (
          <p className="installation-detail-note" role="status">
            {t('common.refreshing')}
          </p>
        )}
        {diagnosticsQuery.isError && (
          <p className="installation-detail-note" role="alert">
            {t('dashboard.readFailed')}
          </p>
        )}
        {snapshot && diagnostics && (
          <div className="installation-diagnostics">
            <section
              className="installation-diagnostics__section"
              aria-label={t('hardware.rule.script')}
            >
              <h2>{t('hardware.rule.script')}</h2>
              <div className="installation-diagnostics__rows">
                <DiagnosticRow
                  label={t('hardware.rule.script')}
                  value={
                    script?.running === true
                      ? t('hardware.status.running')
                      : script?.running === false
                        ? t('hardware.diagnostics.scriptMissingConfirm')
                        : missing
                  }
                  tone={script?.running === false ? 'warning' : 'normal'}
                />
                <DiagnosticRow
                  label={t('hardware.diagnostics.scriptRpcState')}
                  value={
                    resources?.script?.running === true
                      ? 'RUNNING'
                      : resources?.script?.running === false
                        ? 'STOPPED'
                        : missing
                  }
                />
                <DiagnosticRow
                  label={t('hardware.metrics.configHash')}
                  value={script?.configHash ?? missing}
                />
                <DiagnosticRow
                  label={t('hardware.diagnostics.scriptCpu')}
                  value={formatNumber(resources?.script?.cpuPercent, '%', missing, 1)}
                />
                <DiagnosticRow
                  label={t('hardware.diagnostics.scriptMemUsed')}
                  value={formatBytes(resources?.script?.memUsedBytes, missing)}
                />
                <DiagnosticRow
                  label={t('hardware.diagnostics.scriptMemPeak')}
                  value={formatBytes(resources?.script?.memPeakBytes, missing)}
                />
                <DiagnosticRow
                  label={t('hardware.diagnostics.scriptMemFree')}
                  value={formatBytes(resources?.script?.memFreeBytes, missing)}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.snapshotAge')}
                  value={snapshotAge}
                />
              </div>
            </section>

            <section className="installation-diagnostics__section" aria-label="Shelly">
              <h2>Shelly</h2>
              <div className="installation-diagnostics__rows">
                <DiagnosticRow
                  label={t('hardware.diagnostics.deviceRamFree')}
                  value={formatBytes(resources?.system?.ramFreeBytes, missing)}
                />
                <DiagnosticRow
                  label={t('hardware.diagnostics.deviceRamTotal')}
                  value={formatBytes(resources?.system?.ramSizeBytes, missing)}
                />
                <DiagnosticRow
                  label={t('hardware.metrics.clockShelly')}
                  value={snapshot.time.localTime ?? missing}
                />
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
};
'''
)

# Script preview is also a page.
write(
    'apps/mobile/src/screens/InstallationScriptScreen.tsx',
    '''import { FeedbackPanel, ScriptPreview, ToastViewport, type ToastMessage } from '@lcl/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { installationScriptPreviewCopy } from '../app/locales/installationScriptPreview.js';
import { useTranslation } from '../app/i18n.js';
import {
  installedAutomationScriptSourceQueryKey,
  loadInstalledAutomationScriptSource
} from '../flows/installations/scriptPreview.js';
import { useInstalledAutomationStore } from '../flows/installations/store.js';

type InstallationScriptScreenProps = {
  installationId: string;
  onBack(): void;
};

export const InstallationScriptScreen = ({
  installationId,
  onBack
}: InstallationScriptScreenProps) => {
  const { locale, t } = useTranslation();
  const installation = useInstalledAutomationStore((state) =>
    state.installations.find((candidate) => candidate.id === installationId)
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const copy = installationScriptPreviewCopy[locale];
  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const pushToast = useCallback((title: string, tone: 'ok' | 'warning') => {
    toastIdRef.current += 1;
    setToasts((current) => [
      ...current.slice(-2),
      { id: `script-page-toast-${toastIdRef.current}`, title, tone }
    ]);
  }, []);

  const isClimate = installation?.kind === 'climate';
  const scriptQuery = useQuery({
    queryKey: isClimate
      ? installedAutomationScriptSourceQueryKey(installation)
      : ['installed-automation-script-source', installationId, 'missing'],
    queryFn: () => {
      if (!installation || installation.kind !== 'climate') {
        throw new Error('Installation unavailable.');
      }
      return loadInstalledAutomationScriptSource(installation);
    },
    enabled: isClimate,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0
  });

  if (!installation || installation.kind !== 'climate') {
    return (
      <main className="demo-shell installation-detail-shell">
        <div className="setup-context">
          <button className="setup-context__back" type="button" onClick={onBack}>
            {t('detail.backToDashboard')}
          </button>
        </div>
        <section className="automation-card">
          <h1>{t('detail.notFoundTitle')}</h1>
        </section>
      </main>
    );
  }

  const copySource = () => {
    const source = scriptQuery.data;
    if (!source || typeof navigator === 'undefined' || !navigator.clipboard) {
      pushToast(copy.copyFailed, 'warning');
      return;
    }
    void navigator.clipboard
      .writeText(source)
      .then(() => pushToast(copy.copyDone, 'ok'))
      .catch(() => pushToast(copy.copyFailed, 'warning'));
  };

  return (
    <main className="demo-shell installation-detail-shell installation-script-page">
      <div className="setup-context app-page-back-row">
        <button className="setup-context__back" type="button" onClick={onBack}>
          ‹ {installation.shelly.name}
        </button>
      </div>

      <section className="automation-card installation-script-page__card">
        <div className="installation-section-heading">
          <h1>{copy.title}</h1>
        </div>
        {scriptQuery.isPending && (
          <p className="installation-detail-note" role="status">
            {copy.loading}
          </p>
        )}
        {scriptQuery.isError && (
          <FeedbackPanel tone="danger" title={copy.failed}>
            <button className="secondary-action" type="button" onClick={() => void scriptQuery.refetch()}>
              {copy.retry}
            </button>
          </FeedbackPanel>
        )}
        {scriptQuery.isSuccess && (
          <ScriptPreview
            code={scriptQuery.data}
            copyAriaLabel={copy.copy}
            copyLabel={copy.copy}
            label={copy.label}
            variant="fill"
            onCopy={copySource}
          />
        )}
      </section>

      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </main>
  );
};
'''
)

# Root route tree owns the persistent navigation.
write(
    'apps/mobile/src/routes/AppRoutes.tsx',
    '''import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  const selectShellyDevice = useHardwareSetupDraftStore((state) => state.selectShellyDevice);
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
        <InstallationScriptScreen installationId={route.installationId} onBack={backToDetail} />
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
'''
)

# Remove per-screen navigation while keeping optional legacy callback props source-compatible.
path = 'apps/mobile/src/app/AppSettingsScreen.tsx'
s = read(path)
s = s.replace("import { AppBottomNavigation } from '../components/AppBottomNavigation.js';\n", '')
s = s.replace('type AppSettingsScreenProps = {\n  onOpenClimate(): void;\n  onOpenTime(): void;\n};', "type AppSettingsScreenProps = {\n  onOpenClimate?: () => void;\n  onOpenTime?: () => void;\n};")
s = s.replace("export const AppSettingsScreen = ({\n  onOpenClimate,\n  onOpenTime\n}: AppSettingsScreenProps) => {", "export const AppSettingsScreen = (_props: AppSettingsScreenProps = {}) => {")
s = s.replace('className="demo-shell app-settings-screen app-bottom-nav-shell"', 'className="demo-shell app-settings-screen"')
s = re.sub(r'\n\s*<AppBottomNavigation[\s\S]*?/>\n\s*</main>', '\n    </main>', s, count=1)
write(path, s)

path = 'apps/mobile/src/screens/SetupIntentScreen.tsx'
s = read(path)
s = s.replace("import {\n  AppBottomNavigation,\n  type AppNavigationKind\n} from '../components/AppBottomNavigation.js';\n", "import type { AppNavigationKind } from '../components/AppBottomNavigation.js';\n")
s = s.replace('  activeKind: AppNavigationKind;\n', '  activeKind?: AppNavigationKind;\n')
s = s.replace('  onOpenClimate(): void;\n  onOpenTime(): void;\n', '  onOpenClimate?: () => void;\n  onOpenTime?: () => void;\n')
s = s.replace("export const SetupIntentScreen = ({\n  activeKind,\n  onSelect,\n  onCancel,\n  onOpenClimate,\n  onOpenTime,\n  onOpenSettings\n}: SetupIntentScreenProps) => {", "export const SetupIntentScreen = ({ onSelect, onCancel }: SetupIntentScreenProps) => {")
s = s.replace('className="demo-shell intent-shell app-bottom-nav-shell"', 'className="demo-shell intent-shell"')
s = re.sub(r'\n\s*<AppBottomNavigation[\s\S]*?/>\n\s*</main>', '\n    </main>', s, count=1)
write(path, s)

path = 'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx'
s = read(path)
s = s.replace("import {\n  AppBottomNavigation,\n  type AppNavigationKind\n} from '../../components/AppBottomNavigation.js';\n", "import type { AppNavigationKind } from '../../components/AppBottomNavigation.js';\n")
s = s.replace('  navigationKind,\n', '')
s = s.replace('  onNavigateDashboard,\n', '')
s = s.replace('  onOpenSettings,\n', '')
s = re.sub(r'\n\s*const activeNavigationKind =\n\s*navigationKind \?\? \(setupIntent === \'time\' \? \'time\' : \'climate\'\);', '', s)
s = s.replace('className="demo-shell hardware-shell app-bottom-nav-shell"', 'className="demo-shell hardware-shell"')
s = re.sub(r'\n\s*\{onNavigateDashboard && !plugAddOnly && \([\s\S]*?\n\s*\)\}', '', s, count=1)
write(path, s)

path = 'apps/mobile/src/screens/TimeInstallationDetail.tsx'
s = read(path)
s = s.replace("import {\n  AppBottomNavigation,\n  type AppNavigationKind\n} from '../components/AppBottomNavigation.js';\n", "import type { AppNavigationKind } from '../components/AppBottomNavigation.js';\n")
s = s.replace("export const TimeInstallationDetail = ({\n  installation,\n  onBack,\n  onNavigateDashboard,\n  onOpenSettings\n}: TimeInstallationDetailProps) => {", "export const TimeInstallationDetail = ({\n  installation,\n  onBack\n}: TimeInstallationDetailProps) => {")
s = s.replace('className="demo-shell installation-detail-shell app-bottom-nav-shell"', 'className="demo-shell installation-detail-shell"')
s = re.sub(r'\n\s*<AppBottomNavigation[\s\S]*?/>\n\n\s*<Modal', '\n\n      <Modal', s, count=1)
write(path, s)

path = 'apps/mobile/src/screens/AutomationDashboardScreen.tsx'
s = read(path)
s = s.replace("import {\n  AppBottomNavigation,\n  type AppNavigationKind\n} from '../components/AppBottomNavigation.js';\n", "import type { AppNavigationKind } from '../components/AppBottomNavigation.js';\n")
s = s.replace('  onOpenInstallation,\n  onOpenSettings\n}: AutomationDashboardScreenProps) => {', '  onOpenInstallation\n}: AutomationDashboardScreenProps) => {')
s = s.replace("  const [activeKind, setActiveKind] = useState<AppNavigationKind>(\n    () => initialKind ?? 'climate'\n  );", "  const activeKind = initialKind ?? 'climate';")
s = s.replace('className="demo-shell dashboard-shell app-bottom-nav-shell"', 'className="demo-shell dashboard-shell"')
s = re.sub(r'\n\s*<AppBottomNavigation[\s\S]*?/>\n\s*</main>', '\n    </main>', s, count=1)
write(path, s)

# Refocus detail screen on page navigation. Delete confirmation remains a real modal.
path = 'apps/mobile/src/screens/InstallationDetailScreen.tsx'
s = read(path)
s = s.replace('  ScriptPreview,\n', '')
s = s.replace("import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';", "import { useMutation, useQueryClient } from '@tanstack/react-query';")
s = s.replace("import {\n  AppBottomNavigation,\n  type AppNavigationKind\n} from '../components/AppBottomNavigation.js';\n", "import type { AppNavigationKind } from '../components/AppBottomNavigation.js';\n")
s = s.replace("import {\n  installedAutomationScriptSourceQueryKey,\n  loadInstalledAutomationScriptSource\n} from '../flows/installations/scriptPreview.js';", "import { installedAutomationScriptSourceQueryKey } from '../flows/installations/scriptPreview.js';")
s = s.replace("import { InstallationDiagnosticsModal } from './InstallationDiagnosticsModal.js';\n", '')
s = s.replace('  onOpenSettings?: () => void;\n};', '  onOpenSettings?: () => void;\n  onOpenDiagnostics?: () => void;\n  onOpenScript?: () => void;\n};')
s = s.replace("export const InstallationDetailScreen = ({\n  installationId,\n  onBack,\n  onNavigateDashboard,\n  onOpenSettings\n}: InstallationDetailScreenProps) => {", "export const InstallationDetailScreen = ({\n  installationId,\n  onBack,\n  onOpenDiagnostics,\n  onOpenScript\n}: InstallationDetailScreenProps) => {")
s = s.replace('className="demo-shell installation-detail-shell app-bottom-nav-shell"', 'className="demo-shell installation-detail-shell"')
s = re.sub(r'\n\s*<AppBottomNavigation[\s\S]*?/>\n\s*</main>', '\n      </main>', s, count=1)
s = s.replace("      <TimeInstallationDetail\n        installation={installation}\n        onBack={onBack}\n        {...(onNavigateDashboard ? { onNavigateDashboard } : {})}\n        {...(onOpenSettings ? { onOpenSettings } : {})}\n      />", "      <TimeInstallationDetail installation={installation} onBack={onBack} />")
s = s.replace("      {...(onNavigateDashboard ? { onNavigateDashboard } : {})}\n      {...(onOpenSettings ? { onOpenSettings } : {})}", "      {...(onOpenDiagnostics ? { onOpenDiagnostics } : {})}\n      {...(onOpenScript ? { onOpenScript } : {})}")
s = s.replace('  onNavigateDashboard?: (kind: AppNavigationKind) => void;\n  onOpenSettings?: () => void;\n};', '  onNavigateDashboard?: (kind: AppNavigationKind) => void;\n  onOpenSettings?: () => void;\n  onOpenDiagnostics?: () => void;\n  onOpenScript?: () => void;\n};', 1)
s = s.replace("  queryClient,\n  onNavigateDashboard,\n  onOpenSettings\n}: InstalledAutomationDetailProps) => {", "  queryClient,\n  onOpenDiagnostics,\n  onOpenScript\n}: InstalledAutomationDetailProps) => {")
s = s.replace('  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);\n  const [scriptOpen, setScriptOpen] = useState(false);\n', '')
s = re.sub(r"\n\s*const scriptSourceQuery = useQuery\(\{[\s\S]*?\n\s*\}\);", '', s, count=1)
s = re.sub(r"\n\s*const closeScriptPreview = \(\) => \{[\s\S]*?\n\s*\};\n\n\s*const copyScriptSource = \(\) => \{[\s\S]*?\n\s*\};", '', s, count=1)
s = s.replace('              onClick={() => setScriptOpen(true)}', '              onClick={() => onOpenScript?.()}')
s = s.replace('              onClick={() => setDiagnosticsOpen(true)}', '              onClick={() => onOpenDiagnostics?.()}')
s = s.replace('className="demo-shell installation-detail-shell app-bottom-nav-shell"', 'className="demo-shell installation-detail-shell"')
# Add a lightweight back row to the detail page itself.
needle = '  return (\n    <main className="demo-shell installation-detail-shell">\n      <section className="installation-detail-grid"'
replacement = '  return (\n    <main className="demo-shell installation-detail-shell">\n      <div className="setup-context app-page-back-row">\n        <button className="setup-context__back" type="button" onClick={onBack}>\n          ‹ {t(\'dashboard.climateTab\')}\n        </button>\n      </div>\n      <section className="installation-detail-grid"'
if needle not in s:
    raise SystemExit('detail return anchor missing')
s = s.replace(needle, replacement, 1)
# Remove embedded bottom nav + diagnostics/script modal blocks, keeping delete modal.
s = re.sub(r'\n\s*<AppBottomNavigation[\s\S]*?/>\n\n\s*<InstallationDiagnosticsModal[\s\S]*?/>\n\n\s*<Modal\n\s*closeLabel=\{t\(\'common.close\'\)\}[\s\S]*?</Modal>\n\n\s*<Modal\n\s*actions=', '\n\n      <Modal\n        actions=', s, count=1)
write(path, s)

# Delete obsolete diagnostics modal implementation.
obsolete = ROOT / 'apps/mobile/src/screens/InstallationDiagnosticsModal.tsx'
if obsolete.exists():
    obsolete.unlink()

# Persistent shell styling + page sizing for full-page script preview.
path = 'apps/mobile/src/components/AppBottomNavigation.css'
s = read(path)
if '.app-root-shell {' not in s:
    s = ".app-root-shell {\n  min-height: 100dvh;\n}\n\n" + s
write(path, s)

path = 'apps/mobile/src/theme/theme.css'
s = read(path)
append = '''\n\n.app-page-back-row {\n  margin-bottom: var(--lcl-spacing-sm);\n}\n\n.installation-diagnostics-page__card,\n.installation-script-page__card {\n  display: grid;\n  gap: var(--lcl-spacing-md);\n}\n\n.installation-diagnostics-page__card h1,\n.installation-script-page__card h1 {\n  font-size: var(--lcl-font-size-2xl);\n  margin: 0;\n}\n\n.installation-diagnostics__section h2 {\n  font-size: var(--lcl-font-size-lg);\n  margin: 0;\n}\n\n.installation-script-page__card {\n  min-height: calc(100dvh - (var(--lcl-spacing-2xl) * 7));\n}\n\n.installation-script-page__card .lcl-script-preview {\n  height: 100%;\n  min-height: var(--lcl-size-code-preview-max-height);\n}\n'''
if '.installation-script-page__card {' not in s:
    s += append
write(path, s)

# UX gate: bottom navigation must have a single owner in AppShell.
path = 'scripts/quality/ux-gate.mjs'
s = read(path)
start = s.index('const checkBottomNavigationShell = async () => {')
end = s.index('\n};', start) + 3
new_check = '''const checkBottomNavigationShell = async () => {
  const shellPath = 'apps/mobile/src/components/AppShell.tsx';
  const tsxPaths = (await listRepoFiles('apps/mobile/src')).filter((path) =>
    path.endsWith('.tsx')
  );

  for (const path of tsxPaths) {
    const source = await readRepoFile(path);
    if (path !== shellPath && source.includes('<AppBottomNavigation')) {
      addFailure(
        path,
        'AppBottomNavigation must be owned only by the root AppShell, never by individual screens'
      );
    }
    if (path !== shellPath && source.includes('app-bottom-nav-shell')) {
      addFailure(
        path,
        'app-bottom-nav-shell spacing belongs only to the root AppShell'
      );
    }
  }

  const shellSource = await readRepoFile(shellPath);
  if (
    !shellSource.includes('<AppBottomNavigation') ||
    !shellSource.includes('app-bottom-nav-shell')
  ) {
    addFailure(shellPath, 'root AppShell must own the persistent bottom navigation and its spacing');
  }
};'''
s = s[:start] + new_check + s[end:]
write(path, s)

# Detail tests: navigation callbacks now open pages; page screens own the former modal content.
path = 'apps/mobile/src/__tests__/automation-detail.test.tsx'
s = read(path)
s = s.replace("import { INSTALLATION_DIAGNOSTICS_REFRESH_MS } from '../screens/InstallationDiagnosticsModal.js';", "import {\n  INSTALLATION_DIAGNOSTICS_REFRESH_MS,\n  InstallationDiagnosticsScreen\n} from '../screens/InstallationDiagnosticsScreen.js';\nimport { InstallationScriptScreen } from '../screens/InstallationScriptScreen.js';")
s = s.replace("  onOpenSettings = vi.fn()\n) => {", "  onOpenSettings = vi.fn(),\n  onOpenDiagnostics = vi.fn(),\n  onOpenScript = vi.fn()\n) => {")
s = s.replace("    onOpenSettings,\n    ...render(", "    onOpenSettings,\n    onOpenDiagnostics,\n    onOpenScript,\n    ...render(")
s = s.replace("            onOpenSettings={onOpenSettings}\n", "            onOpenSettings={onOpenSettings}\n            onOpenDiagnostics={onOpenDiagnostics}\n            onOpenScript={onOpenScript}\n")
# Remove per-screen bottom-nav assertions from detail test.
s = re.sub(r"\n\s*fireEvent\.click\(screen\.getByRole\('button', \{ name: 'Termometry' \}\)\);[\s\S]*?expect\(onOpenSettings\)\.toHaveBeenCalledTimes\(1\);", '', s, count=1)
# Replace diagnostics modal test with route callback + standalone page test.
pattern = re.compile(r"  it\('opens compact auto-refreshing technical diagnostics without progressive disclosure',[\s\S]*?\n  \}\);\n\n  it\('shows the current deployed script for the saved climate automation',[\s\S]*?\n  \}\);", re.M)
replacement = '''  it('opens technical diagnostics as a child page and keeps auto-refreshing there', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    const { rpcMethods } = installShellyFetchMock();
    const onOpenDiagnostics = vi.fn();
    const detail = renderDetail(saved.id, vi.fn(), vi.fn(), vi.fn(), onOpenDiagnostics);
    expect(await screen.findByRole('heading', { name: 'Salon' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Diagnostyka' }));
    expect(onOpenDiagnostics).toHaveBeenCalledTimes(1);
    detail.unmount();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <InstallationDiagnosticsScreen installationId={saved.id} onBack={vi.fn()} />
        </QueryClientProvider>
      </I18nProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Diagnostyka' })).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Skrypt', level: 2 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Shelly', level: 2 })).toBeVisible();
    expect(await screen.findByText('JS użyte teraz')).toBeVisible();
    expect(screen.getByText('CPU skryptu')).toBeVisible();
    expect(screen.getByText('RAM Shelly wolny')).toBeInTheDocument();
    expect(screen.getByText('Stan skryptu RPC')).toBeVisible();
    await waitFor(() => expect(rpcMethods).toContain('Script.GetStatus'));
    expect(rpcMethods).toContain('Sys.GetStatus');
    const before = rpcMethods.filter((method) => method === 'Script.GetStatus').length;
    await waitFor(
      () =>
        expect(rpcMethods.filter((method) => method === 'Script.GetStatus').length).toBeGreaterThan(
          before
        ),
      { timeout: INSTALLATION_DIAGNOSTICS_REFRESH_MS + 2000 }
    );
  });

  it('opens the deployed script as a child page instead of a modal', async () => {
    const saved = installation();
    useInstalledAutomationStore.getState().upsertInstallation(saved);
    const { rpcMethods } = installShellyFetchMock();
    const onOpenScript = vi.fn();
    const detail = renderDetail(saved.id, vi.fn(), vi.fn(), vi.fn(), vi.fn(), onOpenScript);

    const showScript = await screen.findByRole('button', { name: 'Pokaż wdrożony skrypt' });
    await waitFor(() => expect(showScript).toBeEnabled());
    fireEvent.click(showScript);
    expect(onOpenScript).toHaveBeenCalledTimes(1);
    detail.unmount();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <InstallationScriptScreen installationId={saved.id} onBack={vi.fn()} />
        </QueryClientProvider>
      </I18nProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Skrypt wdrożony w Shelly' })).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByText('// deployed exact source')).toBeVisible();
    expect(rpcMethods).toContain('Script.GetCode');
  });'''
if not pattern.search(s):
    raise SystemExit('automation detail test block not found')
s = pattern.sub(replacement, s, count=1)
write(path, s)

print('Page tree + persistent AppShell refactor applied')

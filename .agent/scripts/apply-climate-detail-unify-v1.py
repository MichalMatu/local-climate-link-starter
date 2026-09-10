from pathlib import Path

root = Path('.')


def read(path: str) -> str:
    return (root / path).read_text()


def write(path: str, text: str) -> None:
    p = root / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


# Shared bottom navigation: one implementation for dashboard + detail screens.
write(
    'apps/mobile/src/components/AppBottomNavigation.tsx',
    """import { IconClock, IconSettings, IconTemperature } from '@tabler/icons-react';
import { useTranslation } from '../app/i18n.js';
import './AppBottomNavigation.css';

export type AppNavigationKind = 'climate' | 'time';

type AppBottomNavigationProps = {
  activeKind: AppNavigationKind;
  onOpenClimate(): void;
  onOpenTime(): void;
  onOpenSettings?: () => void;
};

export const AppBottomNavigation = ({
  activeKind,
  onOpenClimate,
  onOpenTime,
  onOpenSettings
}: AppBottomNavigationProps) => {
  const { t } = useTranslation();

  return (
    <nav
      className=\"dashboard-bottom-nav app-bottom-nav\"
      aria-label={t('dashboard.systemsLabel')}
    >
      <button
        className=\"dashboard-bottom-nav__item app-bottom-nav__item\"
        type=\"button\"
        data-dashboard-kind=\"climate\"
        aria-current={activeKind === 'climate' ? 'page' : undefined}
        onClick={onOpenClimate}
      >
        <IconTemperature
          className=\"dashboard-nav__icon app-bottom-nav__icon\"
          aria-hidden=\"true\"
        />
        <span>{t('dashboard.climateTab')}</span>
      </button>
      <button
        className=\"dashboard-bottom-nav__item app-bottom-nav__item\"
        type=\"button\"
        data-dashboard-kind=\"time\"
        aria-current={activeKind === 'time' ? 'page' : undefined}
        onClick={onOpenTime}
      >
        <IconClock
          className=\"dashboard-nav__icon app-bottom-nav__icon\"
          aria-hidden=\"true\"
        />
        <span>{t('dashboard.timeTab')}</span>
      </button>
      <button
        className=\"dashboard-bottom-nav__item app-bottom-nav__item\"
        type=\"button\"
        aria-haspopup=\"dialog\"
        disabled={!onOpenSettings}
        onClick={() => onOpenSettings?.()}
      >
        <IconSettings
          className=\"dashboard-nav__icon app-bottom-nav__icon\"
          aria-hidden=\"true\"
        />
        <span>{t('dashboard.settingsTab')}</span>
      </button>
    </nav>
  );
};
""",
)

write(
    'apps/mobile/src/components/AppBottomNavigation.css',
    """.app-bottom-nav-shell {
  --app-bottom-nav-height: calc(
    var(--lcl-size-control-min-height) + var(--lcl-spacing-lg)
  );
  padding-bottom: calc(
    var(--app-bottom-nav-height) + var(--lcl-spacing-2xl) +
      var(--lcl-fluid-shell-padding) + env(safe-area-inset-bottom)
  );
}

.app-bottom-nav {
  align-items: stretch;
  background: var(--lcl-color-surface);
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  bottom: 0;
  box-shadow: var(--lcl-shadow-sm);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  left: 0;
  min-height: var(--app-bottom-nav-height);
  padding: var(--lcl-spacing-xs) var(--lcl-fluid-shell-padding)
    calc(var(--lcl-spacing-xs) + env(safe-area-inset-bottom));
  position: fixed;
  right: 0;
  z-index: var(--lcl-z-index-header);
}

.app-bottom-nav__item {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text-muted);
  cursor: pointer;
  display: grid;
  font-size: var(--lcl-font-size-xs);
  font-weight: var(--lcl-font-weight-semibold);
  gap: var(--lcl-spacing-xs);
  justify-items: center;
  min-width: 0;
  padding: var(--lcl-spacing-xs) var(--lcl-spacing-sm);
}

.app-bottom-nav__item[aria-current='page'],
.app-bottom-nav__item:hover,
.app-bottom-nav__item:focus-visible {
  color: var(--lcl-color-accent);
}

.app-bottom-nav__item:disabled {
  cursor: not-allowed;
  opacity: var(--lcl-opacity-disabled);
}

.app-bottom-nav__icon {
  height: var(--lcl-size-control-icon-size);
  width: var(--lcl-size-control-icon-size);
}
""",
)

# Dashboard now consumes the shared nav and can open on a requested section.
dashboard = 'apps/mobile/src/screens/AutomationDashboardScreen.tsx'
replace_once(
    dashboard,
    "  IconPlus,\n  IconSettings,\n  IconTemperature",
    "  IconPlus,\n  IconTemperature",
)
replace_once(
    dashboard,
    "import { useTranslation } from '../app/i18n.js';\n",
    "import { useTranslation } from '../app/i18n.js';\nimport {\n  AppBottomNavigation,\n  type AppNavigationKind\n} from '../components/AppBottomNavigation.js';\n",
)
replace_once(
    dashboard,
    "type AutomationDashboardScreenProps = {\n  onAddAutomation(): void;\n  onOpenInstallation(installationId: string): void;\n  onOpenSettings?: () => void;\n};",
    "type AutomationDashboardScreenProps = {\n  initialKind?: AppNavigationKind;\n  onAddAutomation(): void;\n  onOpenInstallation(installationId: string): void;\n  onOpenSettings?: () => void;\n};",
)
replace_once(
    dashboard,
    "export const AutomationDashboardScreen = ({\n  onAddAutomation,\n  onOpenInstallation,\n  onOpenSettings\n}: AutomationDashboardScreenProps) => {",
    "export const AutomationDashboardScreen = ({\n  initialKind,\n  onAddAutomation,\n  onOpenInstallation,\n  onOpenSettings\n}: AutomationDashboardScreenProps) => {",
)
replace_once(
    dashboard,
    "  const [activeKind, setActiveKind] = useState<'climate' | 'time'>(() =>\n    hasTime && !hasClimate ? 'time' : 'climate'\n  );",
    "  const [activeKind, setActiveKind] = useState<AppNavigationKind>(() =>\n    initialKind ?? (hasTime && !hasClimate ? 'time' : 'climate')\n  );",
)
replace_once(
    dashboard,
    '<main className="demo-shell dashboard-shell">',
    '<main className="demo-shell dashboard-shell app-bottom-nav-shell">',
)
text = read(dashboard)
nav_start = text.find('      <nav className="dashboard-bottom-nav"')
if nav_start < 0:
    raise SystemExit('dashboard nav start not found')
nav_end = text.find('      </nav>', nav_start)
if nav_end < 0:
    raise SystemExit('dashboard nav end not found')
nav_end += len('      </nav>')
shared_nav = """      <AppBottomNavigation
        activeKind={activeKind}
        onOpenClimate={() => setActiveKind('climate')}
        onOpenTime={() => setActiveKind('time')}
        {...(onOpenSettings ? { onOpenSettings } : {})}
      />"""
write(dashboard, text[:nav_start] + shared_nav + text[nav_end:])

# Dashboard CSS keeps its card/FAB rules; nav layout moves into shared component.
dashboard_css = 'apps/mobile/src/screens/AutomationDashboardScreen.css'
replace_once(
    dashboard_css,
    ".dashboard-shell {\n  --dashboard-nav-height: calc(\n    var(--lcl-size-control-min-height) + var(--lcl-spacing-lg)\n  );\n  align-content: start;\n  gap: var(--lcl-spacing-md);\n  padding-bottom: calc(\n    var(--dashboard-nav-height) + var(--lcl-spacing-2xl) +\n      var(--lcl-fluid-shell-padding) + env(safe-area-inset-bottom)\n  );\n}",
    ".dashboard-shell {\n  align-content: start;\n  gap: var(--lcl-spacing-md);\n}",
)
replace_once(
    dashboard_css,
    ".automation-card__icon,\n.automation-card__menu-icon,\n.dashboard-nav__icon,\n.dashboard-fab__icon {",
    ".automation-card__icon,\n.automation-card__menu-icon,\n.dashboard-fab__icon {",
)
replace_once(
    dashboard_css,
    ".automation-card__menu:hover,\n.automation-card__menu:focus-visible,\n.dashboard-bottom-nav__item:hover,\n.dashboard-bottom-nav__item:focus-visible {\n  color: var(--lcl-color-accent);\n}",
    ".automation-card__menu:hover,\n.automation-card__menu:focus-visible {\n  color: var(--lcl-color-accent);\n}",
)
text = read(dashboard_css)
nav_css_start = text.find('.dashboard-bottom-nav {')
fab_marker = text.find('.dashboard-shell .dashboard-fab {')
if nav_css_start < 0 or fab_marker < 0 or fab_marker <= nav_css_start:
    raise SystemExit('dashboard nav CSS range not found')
text = text[:nav_css_start] + text[fab_marker:]
text = text.replace('var(--dashboard-nav-height)', 'var(--app-bottom-nav-height)')
write(dashboard_css, text)

# Global settings icon is Tabler too; screens with the shared bottom nav hide the old top trigger.
app = 'apps/mobile/src/app/App.tsx'
text = read(app)
if "@tabler/icons-react" not in text:
    text = text.replace(
        "import { Capacitor } from '@capacitor/core';\n",
        "import { Capacitor } from '@capacitor/core';\nimport { IconSettings } from '@tabler/icons-react';\n",
        1,
    )
settings_start = text.find('const SettingsIcon = () => (')
settings_end = text.find('\n\nconst AppContent', settings_start)
if settings_start < 0 or settings_end < 0:
    raise SystemExit('custom SettingsIcon block not found')
text = text[:settings_start] + text[settings_end + 2 :]
if '<SettingsIcon />' not in text:
    raise SystemExit('SettingsIcon usage not found')
text = text.replace(
    '<SettingsIcon />',
    '<IconSettings className="app-settings-trigger__icon" aria-hidden="true" />',
    1,
)
write(app, text)

app_css = 'apps/mobile/src/app/appShell.css'
replace_once(
    app_css,
    ".app-shell > .dashboard-shell > .dashboard-header {\n  padding-right: 0;\n}",
    ".app-shell:has(.app-bottom-nav) > .demo-shell > .demo-header {\n  padding-right: 0;\n}",
)
replace_once(
    app_css,
    ".app-shell:has(> .dashboard-shell) > .app-settings-trigger {\n  display: none;\n}",
    ".app-shell:has(.app-bottom-nav) > .app-settings-trigger {\n  display: none;\n}",
)

# Shared refresh icon is Tabler for screens that still legitimately expose refresh.
write(
    'apps/mobile/src/components/RefreshIconButton.tsx',
    """import { IconRefresh } from '@tabler/icons-react';

type RefreshIconButtonProps = {
  busy: boolean;
  className?: string;
  label: string;
  onRefresh(): void;
};

export const RefreshIconButton = ({
  busy,
  className,
  label,
  onRefresh
}: RefreshIconButtonProps) => (
  <button
    aria-busy={busy}
    aria-label={label}
    className={`icon-action runtime-refresh-action${className ? ` ${className}` : ''}`}
    disabled={busy}
    title={label}
    type=\"button\"
    onClick={onRefresh}
  >
    <IconRefresh className=\"icon-action__svg\" aria-hidden=\"true\" />
  </button>
);
""",
)

# LED settings no longer adds another refresh button inside Climate Detail; it refreshes on mount/focus/reconnect.
led = 'apps/mobile/src/screens/ShellyLedSettingsCard.tsx'
text = read(led)
text = text.replace("import { RefreshIconButton } from '../components/RefreshIconButton.js';\n", '', 1)
text = text.replace('  const { locale, t } = useTranslation();', '  const { locale } = useTranslation();', 1)
text = text.replace(
    "    retry: false,\n    refetchOnWindowFocus: false\n",
    "    retry: false,\n    refetchOnMount: 'always',\n    refetchOnWindowFocus: true,\n    refetchOnReconnect: true\n",
    1,
)
refresh_block = """        <RefreshIconButton
          busy={settingsQuery.isFetching}
          label={t('common.refresh')}
          onRefresh={() => void settingsQuery.refetch()}
        />
"""
if refresh_block not in text:
    raise SystemExit('LED refresh block not found')
text = text.replace(refresh_block, '', 1)
write(led, text)

# Route can now open Dashboard directly in Climate/Time from the shared bottom nav.
routes = 'apps/mobile/src/routes/AppRoutes.tsx'
text = read(routes)
text = text.replace(
    "import { useTranslation } from '../app/i18n.js';\n",
    "import { useTranslation } from '../app/i18n.js';\nimport type { AppNavigationKind } from '../components/AppBottomNavigation.js';\n",
    1,
)
text = text.replace("  | { type: 'dashboard' }", "  | { type: 'dashboard'; kind?: AppNavigationKind }", 1)
old_dashboard = """      <AutomationDashboardScreen
        onAddAutomation={() => navigate({ type: 'intent' })}
        onOpenInstallation={(installationId) =>
          navigate({ type: 'installation', installationId })
        }
        {...(onOpenSettings ? { onOpenSettings } : {})}
      />"""
new_dashboard = """      <AutomationDashboardScreen
        {...(route.kind ? { initialKind: route.kind } : {})}
        onAddAutomation={() => navigate({ type: 'intent' })}
        onOpenInstallation={(installationId) =>
          navigate({ type: 'installation', installationId })
        }
        {...(onOpenSettings ? { onOpenSettings } : {})}
      />"""
if old_dashboard not in text:
    raise SystemExit('AppRoutes dashboard block not found')
text = text.replace(old_dashboard, new_dashboard, 1)
old_detail = """      <InstallationDetailScreen
        installationId={route.installationId}
        onBack={() => navigate({ type: 'dashboard' })}
      />"""
new_detail = """      <InstallationDetailScreen
        installationId={route.installationId}
        onBack={() => navigate({ type: 'dashboard' })}
        onNavigateDashboard={(kind) => navigate({ type: 'dashboard', kind })}
        {...(onOpenSettings ? { onOpenSettings } : {})}
      />"""
if old_detail not in text:
    raise SystemExit('AppRoutes detail block not found')
text = text.replace(old_detail, new_detail, 1)
write(routes, text)

# Climate Detail: compact header, no visible back/refresh, consistent AUTO/MANUAL, Tabler code icon, shared nav.
detail = 'apps/mobile/src/screens/InstallationDetailScreen.tsx'
text = read(detail)
if "import { IconCode } from '@tabler/icons-react';\n" not in text:
    text = text.replace(
        "} from '@lcl/ui';\n",
        "} from '@lcl/ui';\nimport { IconCode } from '@tabler/icons-react';\n",
        1,
    )
text = text.replace("import { CodeIcon } from '../components/icons/CodeIcon.js';\n", '', 1)
text = text.replace("import { RefreshIconButton } from '../components/RefreshIconButton.js';\n", '', 1)
text = text.replace(
    "import { useTranslation } from '../app/i18n.js';\n",
    "import { useTranslation } from '../app/i18n.js';\nimport {\n  AppBottomNavigation,\n  type AppNavigationKind\n} from '../components/AppBottomNavigation.js';\n",
    1,
)
text = text.replace('  installationHealthLabel,\n', '', 1)
health_type_start = text.find("type DetailHealthTone = 'ok' | 'warning' | 'offline' | 'paused';")
health_type_end = text.find('\n\nconst configuredThresholdSummary', health_type_start)
if health_type_start < 0 or health_type_end < 0:
    raise SystemExit('detail health helper block not found')
text = text[:health_type_start] + text[health_type_end + 2 :]
text = text.replace(
    "type InstallationDetailScreenProps = {\n  installationId: string;\n  onBack(): void;\n};",
    "type InstallationDetailScreenProps = {\n  installationId: string;\n  onBack(): void;\n  onNavigateDashboard?: (kind: AppNavigationKind) => void;\n  onOpenSettings?: () => void;\n};",
    1,
)
text = text.replace(
    "export const InstallationDetailScreen = ({\n  installationId,\n  onBack\n}: InstallationDetailScreenProps) => {",
    "export const InstallationDetailScreen = ({\n  installationId,\n  onBack,\n  onNavigateDashboard,\n  onOpenSettings\n}: InstallationDetailScreenProps) => {",
    1,
)
old_installed = """    <InstalledAutomationDetail
      installation={installation}
      onBack={onBack}
      pushToast={pushToast}
      dismissToast={dismissToast}
      toasts={toasts}
      queryClient={queryClient}
    />"""
new_installed = """    <InstalledAutomationDetail
      installation={installation}
      onBack={onBack}
      pushToast={pushToast}
      dismissToast={dismissToast}
      toasts={toasts}
      queryClient={queryClient}
      {...(onNavigateDashboard ? { onNavigateDashboard } : {})}
      {...(onOpenSettings ? { onOpenSettings } : {})}
    />"""
if old_installed not in text:
    raise SystemExit('InstalledAutomationDetail invocation not found')
text = text.replace(old_installed, new_installed, 1)
text = text.replace(
    "  queryClient: ReturnType<typeof useQueryClient>;\n};",
    "  queryClient: ReturnType<typeof useQueryClient>;\n  onNavigateDashboard?: (kind: AppNavigationKind) => void;\n  onOpenSettings?: () => void;\n};",
    1,
)
text = text.replace(
    "  toasts,\n  queryClient\n}: InstalledAutomationDetailProps) => {",
    "  toasts,\n  queryClient,\n  onNavigateDashboard,\n  onOpenSettings\n}: InstalledAutomationDetailProps) => {",
    1,
)
old_recovery_copy = """  const recoveryCopy = recovery
    ? installationHealthCopy[locale].issues[recovery.issue]
    : null;"""
new_recovery_copy = """  const visibleRecovery =
    recovery?.issue === 'script-stopped' && isPaused ? null : recovery;
  const recoveryCopy = visibleRecovery
    ? installationHealthCopy[locale].issues[visibleRecovery.issue]
    : null;"""
if old_recovery_copy not in text:
    raise SystemExit('recovery copy block not found')
text = text.replace(old_recovery_copy, new_recovery_copy, 1)
health_start = text.find('  let healthLabel =')
relay_start = text.find('  const relayState =', health_start)
if health_start < 0 or relay_start < 0:
    raise SystemExit('health label block not found')
text = text[:health_start] + text[relay_start:]
relay_end = text.find('\n\n  return (', relay_start)
if relay_end < 0:
    raise SystemExit('relay state return boundary not found')
purpose = """
  const purposeLabel =
    installation.config.rule.control.metric === 'humidity'
      ? t('intent.humidity.context')
      : t('intent.temperature.context');"""
text = text[:relay_end] + purpose + text[relay_end:]
old_header = """      <header className=\"demo-header installation-detail-header\">
        <div>
          <button className=\"detail-back-link\" type=\"button\" onClick={onBack}>
            ← {t('detail.backToDashboard')}
          </button>
          <div className=\"automation-status-row\">
            <span className={healthClass(healthTone)}>{healthLabel}</span>
            <span className=\"automation-status-mode\">
              {t(INSTALLATION_MODE_KEYS[installation.config.rule.mode])}
            </span>
          </div>
          <h1>{installation.shelly.name}</h1>
        </div>
        <RefreshIconButton
          busy={diagnosticsQuery.isFetching || controlQuery.isFetching}
          label={t('common.refresh')}
          onRefresh={() => void refreshAll()}
        />
      </header>"""
new_header = """      <header className=\"demo-header installation-detail-header\">
        <div>
          <h1>{installation.shelly.name}</h1>
          <p className=\"installation-detail-purpose\">{purposeLabel}</p>
        </div>
      </header>"""
if old_header not in text:
    raise SystemExit('detail header block not found')
text = text.replace(old_header, new_header, 1)
text = text.replace('{recovery && recoveryCopy && (', '{visibleRecovery && recoveryCopy && (', 1)
text = text.replace('recovery.action', 'visibleRecovery.action')
if '<CodeIcon />' not in text:
    raise SystemExit('CodeIcon usage not found')
text = text.replace(
    '<CodeIcon />',
    '<IconCode className="icon-action__svg" aria-hidden="true" />',
    1,
)
old_actions = """          <div className=\"installation-detail-actions\">
            {canToggleAutomation && recovery?.issue !== 'script-stopped' && (
              <button
                className={isPaused ? 'primary-action' : 'secondary-action'}
                type=\"button\"
                disabled={automationMutation.isPending || deleteMutation.isPending}
                onClick={() => automationMutation.mutate()}
              >
                {automationMutation.isPending
                  ? t('detail.changingState')
                  : isPaused
                    ? t('detail.resume')
                    : t('detail.pause')}
              </button>
            )}
            <button
              className=\"secondary-action secondary-action--danger\"
              type=\"button\"
              disabled={automationMutation.isPending || deleteMutation.isPending}
              onClick={() => setDeleteOpen(true)}
            >
              {deleteCopy.action}
            </button>
          </div>"""
new_actions = """          <div className=\"installation-detail-actions installation-detail-mode-actions\">
            <div
              className=\"automation-control-group installation-detail-mode-control\"
              role=\"group\"
              aria-label={t('detail.automation')}
            >
              <button
                className=\"automation-control-button\"
                type=\"button\"
                aria-pressed={control?.automationMode === 'auto'}
                disabled={
                  !canToggleAutomation ||
                  automationMutation.isPending ||
                  deleteMutation.isPending
                }
                onClick={() => {
                  if (isPaused) automationMutation.mutate();
                }}
              >
                AUTO
              </button>
              <button
                className=\"automation-control-button\"
                type=\"button\"
                aria-pressed={isPaused}
                disabled={
                  !canToggleAutomation ||
                  automationMutation.isPending ||
                  deleteMutation.isPending
                }
                onClick={() => {
                  if (control?.automationMode === 'auto') automationMutation.mutate();
                }}
              >
                MANUAL
              </button>
            </div>
            <button
              className=\"secondary-action secondary-action--danger\"
              type=\"button\"
              disabled={automationMutation.isPending || deleteMutation.isPending}
              onClick={() => setDeleteOpen(true)}
            >
              {deleteCopy.action}
            </button>
          </div>"""
if old_actions not in text:
    raise SystemExit('detail action block not found')
text = text.replace(old_actions, new_actions, 1)
text = text.replace(
    '<main className="demo-shell installation-detail-shell">',
    '<main className="demo-shell installation-detail-shell app-bottom-nav-shell">',
    1,
)
section_marker = '      </section>\n\n      <Modal'
nav_insert = """      </section>

      <AppBottomNavigation
        activeKind=\"climate\"
        onOpenClimate={() => onNavigateDashboard?.('climate') ?? onBack()}
        onOpenTime={() => onNavigateDashboard?.('time') ?? onBack()}
        {...(onOpenSettings ? { onOpenSettings } : {})}
      />

      <Modal"""
if section_marker not in text:
    raise SystemExit('detail bottom nav insertion point not found')
text = text.replace(section_marker, nav_insert, 1)
write(detail, text)

# Compact detail-specific visual overrides using existing design tokens.
theme = 'apps/mobile/src/theme/theme.css'
text = read(theme)
append = """

/* Shared-shell Climate Detail alignment with the compact Dashboard visual language. */
.installation-detail-shell.app-bottom-nav-shell {
  gap: var(--lcl-spacing-md);
}

.installation-detail-shell .installation-detail-header {
  align-items: center;
  min-height: var(--lcl-size-control-min-height);
}

.installation-detail-shell .installation-detail-header > div {
  gap: var(--lcl-spacing-xs);
}

.installation-detail-shell .installation-detail-header h1 {
  font-size: calc(var(--lcl-font-size-2xl) + var(--lcl-spacing-md));
  line-height: var(--lcl-line-height-tight);
}

.installation-detail-shell .installation-detail-purpose {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  line-height: var(--lcl-line-height-compact);
  margin: 0;
}

.installation-detail-shell .automation-card {
  box-shadow: none;
  gap: var(--lcl-spacing-sm);
  padding: var(--lcl-spacing-md);
}

.installation-detail-shell .installation-detail-live .automation-metrics > div:first-child strong {
  font-size: calc(var(--lcl-font-size-2xl) + var(--lcl-spacing-sm));
}

.installation-detail-shell .installation-detail-mode-control {
  background: var(--lcl-color-surface-muted);
  border: 0;
  border-radius: var(--lcl-radius-round);
  display: flex;
  overflow: hidden;
  width: 100%;
}

.installation-detail-shell .installation-detail-mode-control > * {
  flex: 1 1 0;
}

.installation-detail-shell .installation-detail-mode-control .automation-control-button {
  background: transparent;
  border: 0;
  border-radius: var(--lcl-radius-round);
  color: var(--lcl-color-text-muted);
  min-height: var(--lcl-size-compact-control-min-height);
}

.installation-detail-shell
  .installation-detail-mode-control
  .automation-control-button[aria-pressed='true'] {
  background: var(--lcl-color-accent);
  color: var(--lcl-color-accent-contrast);
}
"""
if 'Shared-shell Climate Detail alignment' in text:
    raise SystemExit('detail unification CSS already present')
write(theme, text.rstrip() + append + '\n')

# Detail tests now assert bottom nav + no header chrome + AUTO/MANUAL semantics.
test = 'apps/mobile/src/__tests__/automation-detail.test.tsx'
text = read(test)
text = text.replace(
    "import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';",
    "import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';",
    1,
)
old_render = """const renderDetail = (installationId: string, onBack = vi.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return {
    onBack,
    ...render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <InstallationDetailScreen installationId={installationId} onBack={onBack} />
        </QueryClientProvider>
      </I18nProvider>
    )
  };
};"""
new_render = """const renderDetail = (
  installationId: string,
  onBack = vi.fn(),
  onNavigateDashboard = vi.fn(),
  onOpenSettings = vi.fn()
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return {
    onBack,
    onNavigateDashboard,
    onOpenSettings,
    ...render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <InstallationDetailScreen
            installationId={installationId}
            onBack={onBack}
            onNavigateDashboard={onNavigateDashboard}
            onOpenSettings={onOpenSettings}
          />
        </QueryClientProvider>
      </I18nProvider>
    )
  };
};"""
if old_render not in text:
    raise SystemExit('renderDetail helper not found')
text = text.replace(old_render, new_render, 1)
old_test = """    const { rpcMethods } = installShellyFetchMock();

    renderDetail(saved.id);

    expect(await screen.findByText('Działa')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Salon' })).toBeVisible();
    expect(screen.getByText('21.4°C')).toBeVisible();
    expect(screen.getByText('55.2%')).toBeVisible();
    expect(screen.getByText('1.31 kPa')).toBeVisible();
    expect(screen.getAllByText('19°C / 20°C').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Przedpokój')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Wstrzymaj automatykę' }));

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      await within(toastRegion).findByText(
        'Automatyka zatrzymana, wyjście potwierdzone jako OFF.'
      )
    ).toBeVisible();
    expect(await screen.findByText('Wstrzymana')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Skrypt zatrzymany' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Uruchom automatykę' })).toBeVisible();
    expect(rpcMethods).toContain('Script.Stop');
    expect(rpcMethods).toContain('Switch.Set');

    fireEvent.click(screen.getByRole('button', { name: 'Uruchom automatykę' }));

    expect(await within(toastRegion).findByText('Automatyka uruchomiona.')).toBeVisible();
    expect(await screen.findByText('Działa')).toBeVisible();
    expect(rpcMethods).toContain('Script.Start');"""
new_test = """    const { rpcMethods } = installShellyFetchMock();
    const { onNavigateDashboard, onOpenSettings } = renderDetail(saved.id);

    expect(await screen.findByText('21.4°C')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Salon' })).toBeVisible();
    expect(screen.getByText('Sterowanie temperaturą')).toBeVisible();
    expect(screen.getByText('55.2%')).toBeVisible();
    expect(screen.getByText('1.31 kPa')).toBeVisible();
    expect(screen.getAllByText('19°C / 20°C').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Przedpokój')).toBeVisible();
    expect(document.querySelector('.installation-detail-header .detail-back-link')).toBeNull();
    expect(document.querySelector('.installation-detail-header .runtime-refresh-action')).toBeNull();
    expect(document.querySelector('.app-bottom-nav')).not.toBeNull();
    expect(document.querySelectorAll('.installation-detail-shell svg:not(.tabler-icon)')).toHaveLength(0);

    const auto = screen.getByRole('button', { name: 'AUTO' });
    const manual = screen.getByRole('button', { name: 'MANUAL' });
    await waitFor(() => expect(auto).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(manual);

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      await within(toastRegion).findByText(
        'Automatyka zatrzymana, wyjście potwierdzone jako OFF.'
      )
    ).toBeVisible();
    await waitFor(() => expect(manual).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.queryByRole('heading', { name: 'Skrypt zatrzymany' })).toBeNull();
    expect(rpcMethods).toContain('Script.Stop');
    expect(rpcMethods).toContain('Switch.Set');

    fireEvent.click(auto);

    expect(await within(toastRegion).findByText('Automatyka uruchomiona.')).toBeVisible();
    await waitFor(() => expect(auto).toHaveAttribute('aria-pressed', 'true'));
    expect(rpcMethods).toContain('Script.Start');

    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));
    expect(onNavigateDashboard).toHaveBeenCalledWith('time');
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);"""
if old_test not in text:
    raise SystemExit('main climate detail test block not found')
text = text.replace(old_test, new_test, 1)
old_script_wait = """    renderDetail(saved.id);

    expect(await screen.findByText('Działa')).toBeVisible();
    const showScript = screen.getByRole('button', {
      name: 'Pokaż wdrożony skrypt'
    });
    expect(showScript).toBeEnabled();"""
new_script_wait = """    renderDetail(saved.id);

    const showScript = await screen.findByRole('button', {
      name: 'Pokaż wdrożony skrypt'
    });
    await waitFor(() => expect(showScript).toBeEnabled());"""
if old_script_wait not in text:
    raise SystemExit('script detail wait block not found')
text = text.replace(old_script_wait, new_script_wait, 1)
write(test, text)

# AppRoutes mock understands the new dashboard-kind callback, and test proves Time nav from detail.
routes_test = 'apps/mobile/src/__tests__/app-routes.test.tsx'
text = read(routes_test)
old_mock = """  InstallationDetailScreen: ({
    installationId,
    onBack
  }: {
    installationId: string;
    onBack: () => void;
  }) => (
    <section>
      <p>{`mock-installation-${installationId}`}</p>
      <button type=\"button\" onClick={onBack}>
        mock-dashboard-back
      </button>
    </section>
  )"""
new_mock = """  InstallationDetailScreen: ({
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
      <button type=\"button\" onClick={onBack}>
        mock-dashboard-back
      </button>
      <button type=\"button\" onClick={() => onNavigateDashboard?.('time')}>
        mock-dashboard-time
      </button>
    </section>
  )"""
if old_mock not in text:
    raise SystemExit('AppRoutes detail mock not found')
text = text.replace(old_mock, new_mock, 1)
anchor = """    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-dashboard-back' }));"""
replacement = """    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-dashboard-time' }));
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Klimat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon' }));
    expect(screen.getByText(`mock-installation-${installation.id}`)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'mock-dashboard-back' }));"""
if anchor not in text:
    raise SystemExit('AppRoutes stable-id test anchor not found')
text = text.replace(anchor, replacement, 1)
write(routes_test, text)

# Remove the old local code SVG component after its only detail usage is migrated.
code_icon = root / 'apps/mobile/src/components/icons/CodeIcon.tsx'
if code_icon.exists():
    code_icon.unlink()

print('climate detail unification v1 applied')

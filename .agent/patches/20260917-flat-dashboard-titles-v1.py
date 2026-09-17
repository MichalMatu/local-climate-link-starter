from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count))

# Remove redundant visible dashboard title and keep the main landmark named.
path = 'apps/mobile/src/screens/AutomationDashboardScreen.tsx'
replace(
    path,
    '  return <SensorSetupPage flow={flow} primaryAddAction="phone-scan" />;',
    '  return <SensorSetupPage flow={flow} primaryAddAction="phone-scan" embedded />;'
)
replace(
    path,
    '''    <main className="demo-shell dashboard-shell app-bottom-nav-shell">\n      <header className="demo-header dashboard-header app-page-header">\n        <h1>\n          {activeKind === 'climate' ? t('dashboard.climateTab') : t('dashboard.timeTab')}\n        </h1>\n      </header>\n\n      <section className="dashboard-grid" aria-label={t('dashboard.systemsLabel')}>''',
    '''    <main\n      className="demo-shell dashboard-shell app-bottom-nav-shell"\n      aria-label={activeKind === 'climate' ? t('dashboard.climateTab') : t('dashboard.timeTab')}\n    >\n      <section className="dashboard-grid" aria-label={t('dashboard.systemsLabel')}>'''
)

# Sensor inventory can be embedded in the dashboard without an outer card.
path = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
replace(
    path,
    '''type SensorSetupPageProps = HardwarePageProps<SensorSetupFlow> & {\n  primaryAddAction?: 'manual' | 'phone-scan';\n};''',
    '''type SensorSetupPageProps = HardwarePageProps<SensorSetupFlow> & {\n  primaryAddAction?: 'manual' | 'phone-scan';\n  embedded?: boolean;\n};'''
)
replace(
    path,
    '''export const SensorSetupPage = ({\n  flow,\n  primaryAddAction = 'manual'\n}: SensorSetupPageProps) => {''',
    '''export const SensorSetupPage = ({\n  flow,\n  primaryAddAction = 'manual',\n  embedded = false\n}: SensorSetupPageProps) => {'''
)
replace(
    path,
    '''    <section\n      className="demo-panel sensor-setup-panel"\n      aria-label={t('hardware.nav.sensorTitle')}\n    >''',
    '''    <section\n      className={\n        embedded\n          ? 'sensor-setup-panel sensor-setup-panel--embedded'\n          : 'demo-panel sensor-setup-panel'\n      }\n      aria-label={t('hardware.nav.sensorTitle')}\n    >'''
)

# Embedded mode keeps spacing but drops the outer card chrome.
path = 'apps/mobile/src/theme/theme.css'
replace(
    path,
    '''.sensor-setup-panel {\n}\n''',
    '''.sensor-setup-panel {\n}\n\n.sensor-setup-panel--embedded {\n  display: grid;\n  gap: var(--lcl-spacing-lg);\n}\n'''
)

# Dashboard tests: the bottom navigation identifies the active page; no visible page title.
path = 'apps/mobile/src/__tests__/automation-dashboard.test.tsx'
p = Path(path)
text = p.read_text()
text = text.replace(
    "screen.getByRole('heading', { name: 'Gniazdka' })",
    "screen.getByRole('main', { name: 'Gniazdka' })"
)
text = text.replace(
    "screen.getByRole('heading', { name: 'Termometry' })",
    "screen.getByRole('main', { name: 'Termometry' })"
)
# Explicit regression coverage for removed visible headers and flattened thermometer wrapper.
anchor = "    expect(screen.getByRole('main', { name: 'Gniazdka' })).toBeVisible();\n"
if anchor not in text:
    raise SystemExit('dashboard test heading anchor missing')
text = text.replace(
    anchor,
    anchor + "    expect(screen.queryByRole('heading', { name: 'Gniazdka' })).toBeNull();\n",
    1
)
anchor = "    expect(screen.getByRole('main', { name: 'Termometry' })).toBeVisible();\n"
if anchor not in text:
    raise SystemExit('thermometer main test anchor missing')
text = text.replace(
    anchor,
    anchor + "    expect(screen.queryByRole('heading', { name: 'Termometry' })).toBeNull();\n    expect(document.querySelector('.sensor-setup-panel--embedded')).not.toBeNull();\n    expect(document.querySelector('.sensor-setup-panel--embedded.demo-panel')).toBeNull();\n",
    1
)
p.write_text(text)

# Route tests use the named main landmark instead of the intentionally removed visible title.
path = 'apps/mobile/src/__tests__/app-routes.test.tsx'
p = Path(path)
text = p.read_text().replace(
    "screen.getByRole('heading', { name: 'Gniazdka' })",
    "screen.getByRole('main', { name: 'Gniazdka' })"
)
p.write_text(text)

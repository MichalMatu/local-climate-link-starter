from pathlib import Path

# Dashboard component tests should select their view through props; root AppShell owns navigation.
path = Path('apps/mobile/src/__tests__/automation-dashboard.test.tsx')
source = path.read_text()
old = """const renderDashboard = (
  onAddAutomation = vi.fn(),
  onOpenInstallation = vi.fn(),
  onOpenSettings = vi.fn(),
  onAddPlug = vi.fn()
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return {
    onAddAutomation,
    onOpenInstallation,
    onOpenSettings,
    onAddPlug,
    queryClient,
    ...render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AutomationDashboardScreen
            onAddPlug={onAddPlug}
            onAddAutomation={onAddAutomation}
            onOpenInstallation={onOpenInstallation}
            onOpenSettings={onOpenSettings}
          />
        </QueryClientProvider>
      </I18nProvider>
    )
  };
};
"""
new = """const renderDashboard = (
  onAddAutomation = vi.fn(),
  onOpenInstallation = vi.fn(),
  onOpenSettings = vi.fn(),
  onAddPlug = vi.fn(),
  initialKind: 'climate' | 'time' = 'climate'
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const view = (kind: 'climate' | 'time') => (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <AutomationDashboardScreen
          initialKind={kind}
          onAddPlug={onAddPlug}
          onAddAutomation={onAddAutomation}
          onOpenInstallation={onOpenInstallation}
          onOpenSettings={onOpenSettings}
        />
      </QueryClientProvider>
    </I18nProvider>
  );
  const rendered = render(view(initialKind));
  return {
    onAddAutomation,
    onOpenInstallation,
    onOpenSettings,
    onAddPlug,
    queryClient,
    ...rendered,
    rerenderKind: (kind: 'climate' | 'time') => rendered.rerender(view(kind))
  };
};
"""
if old not in source:
    raise SystemExit('renderDashboard helper anchor missing')
source = source.replace(old, new, 1)

old = """  it('uses the same centered empty-state treatment for Thermometers', () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));

    const thermometerEmptyState = screen
"""
new = """  it('uses the same centered empty-state treatment for Thermometers', () => {
    renderDashboard(vi.fn(), vi.fn(), vi.fn(), vi.fn(), 'time');

    const thermometerEmptyState = screen
"""
if old not in source:
    raise SystemExit('thermometer empty-state test anchor missing')
source = source.replace(old, new, 1)

old = """    renderDashboard();

    expect(await screen.findByText('21.4°C')).toBeVisible();
"""
new = """    const { rerenderKind } = renderDashboard();

    expect(await screen.findByText('21.4°C')).toBeVisible();
"""
if old not in source:
    raise SystemExit('live runtime render anchor missing')
source = source.replace(old, new, 1)

old = """    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const thermometerNav = screen.getByRole('button', { name: 'Termometry' });
    expect(thermometerNav).toBeEnabled();
    fireEvent.click(thermometerNav);
    expect(screen.getByRole('main', { name: 'Termometry' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Termometry' })).toBeNull();
    expect(document.querySelector('.sensor-setup-panel--embedded')).not.toBeNull();
    expect(document.querySelector('.sensor-setup-panel--embedded.demo-panel')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Skanuj termometry BLE telefonem' })
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Gniazdka' }));
    expect(screen.getByRole('button', { name: 'Ustawienia' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Szczegóły: Salon' })).toBeVisible();
"""
new = """    rerenderKind('time');
    expect(screen.getByRole('main', { name: 'Termometry' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Termometry' })).toBeNull();
    expect(document.querySelector('.sensor-setup-panel--embedded')).not.toBeNull();
    expect(document.querySelector('.sensor-setup-panel--embedded.demo-panel')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Skanuj termometry BLE telefonem' })
    ).toBeVisible();
    rerenderKind('climate');
    expect(screen.getByRole('button', { name: 'Szczegóły: Salon' })).toBeVisible();
"""
if old not in source:
    raise SystemExit('live runtime nav assertions anchor missing')
source = source.replace(old, new, 1)

old = """    renderDashboard(vi.fn(), onOpenInstallation);

    expect(await screen.findByText('Harmonogram dzienny')).toBeVisible();
"""
new = """    const { rerenderKind } = renderDashboard(vi.fn(), onOpenInstallation);

    expect(await screen.findByText('Harmonogram dzienny')).toBeVisible();
"""
if old not in source:
    raise SystemExit('time schedule render anchor missing')
source = source.replace(old, new, 1)

old = """    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const thermometerNav = screen.getByRole('button', { name: 'Termometry' });
    expect(thermometerNav).toBeEnabled();
    fireEvent.click(thermometerNav);
    expect(screen.getByRole('main', { name: 'Termometry' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Gniazdka' }));
    expect(screen.getByText('Harmonogram dzienny')).toBeVisible();

"""
new = """    rerenderKind('time');
    expect(screen.getByRole('main', { name: 'Termometry' })).toBeVisible();
    rerenderKind('climate');
    expect(screen.getByText('Harmonogram dzienny')).toBeVisible();

"""
if old not in source:
    raise SystemExit('time schedule nav assertions anchor missing')
source = source.replace(old, new, 1)
path.write_text(source)

# App route regression should exercise the real root navigation, not a screen-local mock callback.
path = Path('apps/mobile/src/__tests__/navigation-settings-regression.test.tsx')
source = path.read_text()
old = """vi.mock('../screens/AutomationDashboardScreen.js', () => ({
  AutomationDashboardScreen: ({
    onAddAutomation,
    onOpenSettings
  }: {
    onAddAutomation(kind: 'climate' | 'time'): void;
    onOpenSettings?: () => void;
  }) => (
    <main>
      <h1>dashboard-test</h1>
      <button type="button" onClick={() => onAddAutomation('climate')}>
        add-automation-test
      </button>
      <button type="button" onClick={onOpenSettings}>
        Ustawienia aplikacji
      </button>
    </main>
  )
}));
"""
new = """vi.mock('../screens/AutomationDashboardScreen.js', () => ({
  AutomationDashboardScreen: ({
    onAddAutomation
  }: {
    onAddAutomation(kind: 'climate' | 'time'): void;
  }) => (
    <main>
      <h1>dashboard-test</h1>
      <button type="button" onClick={() => onAddAutomation('climate')}>
        add-automation-test
      </button>
    </main>
  )
}));
"""
if old not in source:
    raise SystemExit('navigation dashboard mock anchor missing')
source = source.replace(old, new, 1)
old = "fireEvent.click(screen.getByRole('button', { name: 'Ustawienia aplikacji' }));"
new = "fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }));"
if old not in source:
    raise SystemExit('settings navigation click anchor missing')
source = source.replace(old, new, 1)
path.write_text(source)

# Preserve the detail spacing rule now that the navigation-shell class lives at the root.
path = Path('apps/mobile/src/theme/theme.css')
source = path.read_text()
old = '.installation-detail-shell.app-bottom-nav-shell {\n  gap: var(--lcl-spacing-md);\n}'
new = '.installation-detail-shell {\n  gap: var(--lcl-spacing-md);\n}'
if old not in source:
    raise SystemExit('detail shell spacing selector anchor missing')
path.write_text(source.replace(old, new, 1))

print('Aligned tests and detail spacing with root AppShell navigation')

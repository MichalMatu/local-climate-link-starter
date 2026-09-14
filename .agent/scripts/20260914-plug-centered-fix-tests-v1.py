from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"expected exactly one match in {path}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "apps/mobile/src/screens/devices/SavedPlugCard.tsx",
    "  const climateRuntime =\n    climateRule && ruleSnapshot && 'mode' in ruleSnapshot ? ruleSnapshot : null;",
    "  const climateRuntime =\n    climateRule &&\n    ruleSnapshot &&\n    'mode' in ruleSnapshot &&\n    'scriptMatch' in ruleSnapshot &&\n    'modeSupported' in ruleSnapshot\n      ? ruleSnapshot\n      : null;",
)

app_routes = "apps/mobile/src/__tests__/app-routes.test.tsx"
replace_once(
    app_routes,
    "  it('uses the empty dashboard as the canonical zero-installation root', () => {\n    renderRoutes();\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Dodaj automatykę' })).toBeVisible();\n    expect(screen.queryByRole('heading', { name: 'Co chcesz zrobić?' })).toBeNull();\n    expect(document.querySelector('.app-settings-trigger')).toBeNull();\n  });",
    "  it('uses plugs as the canonical zero-installation root', () => {\n    renderRoutes();\n    expect(screen.getByText('mock-plugs')).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n    expect(screen.queryByRole('heading', { name: 'Co chcesz zrobić?' })).toBeNull();\n    expect(document.querySelector('.app-settings-trigger')).toBeNull();\n  });",
)
replace_once(
    app_routes,
    "    expect(screen.getByRole('button', { name: 'Reguły' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n\n    fireEvent.click(screen.getByRole('button', { name: 'Gniazdka' }));",
    "    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(\n      'aria-current',\n      'page'\n    );\n\n    fireEvent.click(screen.getByRole('button', { name: 'Gniazdka' }));",
)
replace_once(
    app_routes,
    "  it('opens Add automation only from plus and does not expose legacy manage choice', () => {\n    renderRoutes();\n    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));",
    "  it('opens Add automation from the temporary Rules entry and does not expose legacy manage choice', () => {\n    renderRoutes();\n    fireEvent.click(screen.getByRole('button', { name: 'Reguły' }));\n    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));",
)
replace_once(
    app_routes,
    "    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));\n    fireEvent.click(screen.getByRole('button', { name: /Sterować temperaturą/ }));",
    "    fireEvent.click(screen.getByRole('button', { name: 'Reguły' }));\n    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));\n    fireEvent.click(screen.getByRole('button', { name: /Sterować temperaturą/ }));",
)
replace_once(
    app_routes,
    "    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n    act(() => nativeAppMocks.fireBack());",
    "    expect(screen.getByText('mock-plugs')).toBeVisible();\n    act(() => nativeAppMocks.fireBack());",
)
replace_once(
    app_routes,
    "    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));\n    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));",
    "    fireEvent.click(screen.getByRole('button', { name: 'Reguły' }));\n    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));\n    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));",
)
replace_once(
    app_routes,
    "    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();\n  });\n\n  it('opens a saved rule by stable id and returns to its dashboard', () => {",
    "    expect(screen.getByText('mock-plugs')).toBeVisible();\n  });\n\n  it('opens a saved rule by stable id and returns to plugs', () => {",
)
replace_once(
    app_routes,
    "    renderRoutes();\n    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon climate' }));",
    "    renderRoutes();\n    fireEvent.click(screen.getByRole('button', { name: 'Reguły' }));\n    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły: Salon climate' }));",
)
replace_once(
    app_routes,
    "    fireEvent.click(screen.getByRole('button', { name: 'mock-dashboard-back' }));\n    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();",
    "    fireEvent.click(screen.getByRole('button', { name: 'mock-dashboard-back' }));\n    expect(screen.getByText('mock-plugs')).toBeVisible();",
)

navigation = "apps/mobile/src/__tests__/navigation-settings-regression.test.tsx"
replace_once(
    navigation,
    "  it('returns visibly from Add automation to the dashboard', () => {\n    render(<App />);\n    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();\n\n    fireEvent.click(screen.getByRole('button', { name: 'add-automation-test' }));",
    "  it('returns visibly from Add automation to the plug root', () => {\n    render(<App />);\n    fireEvent.click(screen.getByRole('button', { name: 'Reguły' }));\n    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();\n\n    fireEvent.click(screen.getByRole('button', { name: 'add-automation-test' }));",
)
replace_once(
    navigation,
    "    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));\n    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();",
    "    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));\n    expect(screen.getByRole('heading', { name: 'Gniazdka' })).toBeVisible();",
)

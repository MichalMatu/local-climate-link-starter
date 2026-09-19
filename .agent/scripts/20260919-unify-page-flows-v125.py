from pathlib import Path

ROOT = Path('.')


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:220]!r}')
    p.write_text(text.replace(old, new, count), encoding='utf-8')


# Sensor add page: saving is not navigation; keep scan/page alive and flatten the page surface.
sensor = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
replace(
    sensor,
    """  onAddRequest?: (mode: SensorAddMode) => void;\n  onAddComplete?: () => void;\n};""",
    """  onAddRequest?: (mode: SensorAddMode) => void;\n};""",
)
replace(
    sensor,
    """  addOnly = false,\n  onAddRequest,\n  onAddComplete\n}: SensorSetupPageProps) => {""",
    """  addOnly = false,\n  onAddRequest\n}: SensorSetupPageProps) => {""",
)
replace(
    sensor,
    """  const addSensor = () => {\n    setDidSubmitSensorAdd(true);\n    if (!flow.sensorInputState.ok) return;\n    flow.addSensorDraft();\n    setDidSubmitSensorAdd(false);\n    onAddComplete?.();\n  };\n\n  const saveScannedSensor = (candidate: BleDiscoveryCandidate) => {\n    flow.addDiscoveredSensor(candidate);\n    flow.stopPhoneBleScan();\n    onAddComplete?.();\n  };""",
    """  const addSensor = () => {\n    setDidSubmitSensorAdd(true);\n    if (!flow.sensorInputState.ok) return;\n    flow.addSensorDraft();\n    setDidSubmitSensorAdd(false);\n    flow.setSensorNameInput('');\n    flow.setSensorMacInput('');\n    pushToast('ok', t('hardware.shelly.thermometerSaved'));\n  };\n\n  const saveScannedSensor = (candidate: BleDiscoveryCandidate) => {\n    flow.addDiscoveredSensor(candidate);\n    pushToast('ok', t('hardware.shelly.thermometerSaved'));\n  };""",
)
replace(
    sensor,
    """      <section\n        className=\"automation-card device-add-page sensor-add-page\"\n        aria-label={t('hardware.sensor.add')}\n      >\n        <div className=\"installation-section-heading\">\n          <h1>{t('hardware.sensor.add')}</h1>\n        </div>""",
    """      <section className=\"device-add-page sensor-add-page\" aria-label={t('hardware.sensor.add')}>\n        <header className=\"demo-header app-page-header device-add-page__header\">\n          <h1>{t('hardware.sensor.add')}</h1>\n        </header>""",
)

# Shelly add page: same rule as thermometer add. Add marks/saves the item, page remains open.
shelly = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace(
    shelly,
    """  settingsOnlyDeviceId?: string;\n  onAddRequest?: () => void;\n  onAddComplete?: () => void;\n  onSettingsClose?: () => void;""",
    """  settingsOnlyDeviceId?: string;\n  onAddRequest?: () => void;\n  onSettingsClose?: () => void;""",
)
replace(
    shelly,
    """  settingsOnlyDeviceId,\n  onAddRequest,\n  onAddComplete,\n  onSettingsClose\n}: ShellySetupPageProps) => {""",
    """  settingsOnlyDeviceId,\n  onAddRequest,\n  onSettingsClose\n}: ShellySetupPageProps) => {""",
)
replace(
    shelly,
    """      onSuccess: () => {\n        setDidSubmitShellyAdd(false);\n        setDialog({ kind: 'none' });\n        pushToast('ok', t('hardware.shelly.added'));\n        onAddComplete?.();\n      },""",
    """      onSuccess: () => {\n        setDidSubmitShellyAdd(false);\n        setDialog({ kind: 'none' });\n        pushToast('ok', t('hardware.shelly.added'));\n        if (addOnly) {\n          flow.setShellyNameInput('');\n          flow.setShellyUrlInput('');\n        }\n      },""",
)
replace(
    shelly,
    """        onSuccess: () => {\n          pushToast('ok', t('hardware.shelly.added'));\n          if (addOnly) {\n            flow.stopShellyScan();\n            setDialog({ kind: 'none' });\n            onAddComplete?.();\n          }\n        },""",
    """        onSuccess: () => {\n          pushToast('ok', t('hardware.shelly.added'));\n        },""",
)
replace(
    shelly,
    """      className={\n        addOnly ? 'automation-card device-add-page shelly-add-page' : 'demo-panel'\n      }""",
    """      className={addOnly ? 'device-add-page shelly-add-page' : 'demo-panel'}""",
)
replace(
    shelly,
    """          <div className=\"installation-section-heading\">\n            <h1>{t('hardware.shelly.add')}</h1>\n          </div>""",
    """          <header className=\"demo-header app-page-header device-add-page__header\">\n            <h1>{t('hardware.shelly.add')}</h1>\n          </header>""",
)

# Device-add routes/pages no longer have an implicit 'complete == navigate away' callback.
hardware = 'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx'
replace(
    hardware,
    """  sensorAddMode?: SensorAddMode;\n  onPlugAddComplete?: () => void;\n  onPlugAddCancel?: () => void;\n  onSensorAddComplete?: () => void;\n  onSensorAddCancel?: () => void;""",
    """  sensorAddMode?: SensorAddMode;\n  onPlugAddCancel?: () => void;\n  onSensorAddCancel?: () => void;""",
)
replace(
    hardware,
    """  sensorAddOnly = false,\n  sensorAddMode = 'phone-scan',\n  onPlugAddComplete,\n  onPlugAddCancel,\n  onSensorAddComplete,\n  onSensorAddCancel""",
    """  sensorAddOnly = false,\n  sensorAddMode = 'phone-scan',\n  onPlugAddCancel,\n  onSensorAddCancel""",
)
replace(
    hardware,
    """          <ShellySetupPage\n            flow={flow}\n            addOnly\n            enableBleDiscovery={setupIntent !== 'time'}\n            onAddComplete={closeLocalAdd}\n          />""",
    """          <ShellySetupPage\n            flow={flow}\n            addOnly\n            enableBleDiscovery={setupIntent !== 'time'}\n          />""",
)
replace(
    hardware,
    """          <SensorSetupPage\n            flow={flow}\n            addOnly\n            primaryAddAction={localSensorAddMode}\n            onAddComplete={closeLocalAdd}\n          />""",
    """          <SensorSetupPage\n            flow={flow}\n            addOnly\n            primaryAddAction={localSensorAddMode}\n          />""",
)
replace(
    hardware,
    """          addOnly={plugAddOnly}\n          onAddRequest={openPlugAdd}\n          {...(onPlugAddComplete ? { onAddComplete: onPlugAddComplete } : {})}\n        />""",
    """          addOnly={plugAddOnly}\n          onAddRequest={openPlugAdd}\n        />""",
)
replace(
    hardware,
    """          onAddRequest={openSensorAdd}\n          primaryAddAction={sensorAddOnly ? sensorAddMode : 'manual'}\n          {...(onSensorAddComplete ? { onAddComplete: onSensorAddComplete } : {})}\n        />""",
    """          onAddRequest={openSensorAdd}\n          primaryAddAction={sensorAddOnly ? sensorAddMode : 'manual'}\n        />""",
)

routes = 'apps/mobile/src/routes/AppRoutes.tsx'
replace(
    routes,
    """          {...(route.device === 'plug'\n            ? {\n                onPlugAddComplete: leaveAddPage,\n                onPlugAddCancel: leaveAddPage\n              }\n            : {\n                onSensorAddComplete: leaveAddPage,\n                onSensorAddCancel: leaveAddPage\n              })}""",
    """          {...(route.device === 'plug'\n            ? { onPlugAddCancel: leaveAddPage }\n            : { onSensorAddCancel: leaveAddPage })}""",
)

# Lock the document and make AppShell the viewport owner. Only app-root-shell__content scrolls.
theme = 'apps/mobile/src/theme/theme.css'
replace(
    theme,
    """html:root,\nhtml:root body {\n  background: var(--lcl-color-background);\n  height: auto;\n  overflow-x: hidden;\n  overflow-y: auto;\n}\n\nhtml:root body {\n  -webkit-font-smoothing: antialiased;\n  max-height: none;\n  overscroll-behavior-y: auto;\n  position: static;\n  text-rendering: optimizeLegibility;\n  touch-action: auto;\n}\n\nhtml,\nbody,\n#root,\n.app-shell {\n  min-height: 100dvh;\n}""",
    """html:root,\nhtml:root body {\n  background: var(--lcl-color-background);\n  height: 100%;\n  overflow: hidden;\n}\n\nhtml:root body {\n  -webkit-font-smoothing: antialiased;\n  max-height: 100%;\n  overscroll-behavior-y: none;\n  position: static;\n  text-rendering: optimizeLegibility;\n  touch-action: auto;\n}\n\nhtml,\nbody,\n#root,\n.app-shell {\n  height: 100%;\n  min-height: 0;\n}""",
)
replace(
    theme,
    """.device-add-page .installation-section-heading h1 {\n  font-size: var(--lcl-font-size-xl);\n  margin: 0;\n}""",
    """.device-add-page__header {\n  min-width: 0;\n}\n\n.device-add-page__header h1 {\n  font-size: var(--lcl-font-size-2xl);\n  line-height: var(--lcl-line-height-tight);\n  margin: 0;\n}""",
)

# AppShell CSS from v124 remains authoritative, but make the document lock explicit here too.
app_shell_css = 'apps/mobile/src/app/appShell.css'
(ROOT / app_shell_css).write_text("""html:root,\nhtml:root body,\n#root {\n  height: 100%;\n  min-height: 0;\n  overflow: hidden;\n}\n\n.app-shell {\n  height: 100dvh;\n  min-height: 0;\n  overflow: hidden;\n  position: relative;\n}\n""", encoding='utf-8')

# UX gates: device-add pages must be pages, not giant cards; AppShell must own the scroll boundary.
gate = 'scripts/quality/ux-gate.mjs'
replace(
    gate,
    """  if (!routesSource.includes(\"type: 'device-add'\")) {\n    addFailure(routesPath, 'device add flows must be represented in the app page tree');\n  }\n};""",
    """  if (sensorSource.includes('automation-card device-add-page')) {\n    addFailure(sensorPath, 'thermometer add page must not wrap the whole page in a card');\n  }\n  if (shellySource.includes('automation-card device-add-page')) {\n    addFailure(shellyPath, 'plug add page must not wrap the whole page in a card');\n  }\n  if (!routesSource.includes(\"type: 'device-add'\")) {\n    addFailure(routesPath, 'device add flows must be represented in the app page tree');\n  }\n};""",
)
replace(
    gate,
    """  if (\n    !shellSource.includes('<AppBottomNavigation') ||\n    !shellSource.includes('app-bottom-nav-shell')\n  ) {\n    addFailure(\n      shellPath,\n      'root AppShell must own the persistent bottom navigation and its spacing'\n    );\n  }\n};""",
    """  if (\n    !shellSource.includes('<AppBottomNavigation') ||\n    !shellSource.includes('app-bottom-nav-shell')\n  ) {\n    addFailure(\n      shellPath,\n      'root AppShell must own the persistent bottom navigation and its spacing'\n    );\n  }\n  if (!shellSource.includes('app-root-shell__content')) {\n    addFailure(shellPath, 'root AppShell must isolate scrollable page content from bottom navigation');\n  }\n  const navCssPath = 'apps/mobile/src/components/AppBottomNavigation.css';\n  const navCss = await readRepoFile(navCssPath);\n  if (\n    !navCss.includes('grid-template-rows: minmax(0, 1fr) auto') ||\n    !navCss.includes('.app-root-shell__content') ||\n    !navCss.includes('overflow-y: auto')\n  ) {\n    addFailure(navCssPath, 'bottom navigation must live outside the only scrollable app content row');\n  }\n};""",
)

# Regression tests: saving devices stays on the page; add pages are flat; delayed BLE packets keep arriving.
test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
replace(
    test,
    """  fireEvent.click(within(addDialog).getByRole('button', { name: 'Dodaj' }));\n  expect(\n    await screen.findByRole('button', { name: 'Ustawienia gniazdka' })\n  ).toBeInTheDocument();\n  expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();\n  expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();\n};""",
    """  fireEvent.click(within(addDialog).getByRole('button', { name: 'Dodaj' }));\n  expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();\n  expect(screen.getByRole('heading', { name: 'Dodaj gniazdko' })).toBeVisible();\n  expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();\n  closeCurrentAddPage();\n  expect(\n    await screen.findByRole('button', { name: 'Ustawienia gniazdka' })\n  ).toBeInTheDocument();\n};""",
)
replace(
    test,
    """  fireEvent.click(within(addDialog).getByRole('button', { name: 'Dodaj' }));\n  expect(await screen.findByText(name)).toBeInTheDocument();\n  expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();\n  expect(screen.queryByRole('heading', { name: 'Dodaj termometr' })).toBeNull();\n};""",
    """  fireEvent.click(within(addDialog).getByRole('button', { name: 'Dodaj' }));\n  expect(await screen.findByText('Zapisano termometr.')).toBeInTheDocument();\n  expect(screen.getByRole('heading', { name: 'Dodaj termometr' })).toBeVisible();\n  expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();\n  closeCurrentAddPage();\n  expect(await screen.findByText(name)).toBeInTheDocument();\n};""",
)
replace(
    test,
    """    const plugPage = await openShellyAddDialog('scan');\n    expect(within(plugPage).getByRole('tab', { name: 'Skanuj sieć' })).toBeVisible();\n    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();\n    closeCurrentAddPage();\n\n    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));\n    const sensorPage = await openSensorAddDialog();\n    expect(within(sensorPage).getByLabelText('MAC termometru')).toBeVisible();\n    expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();""",
    """    const plugPage = await openShellyAddDialog('scan');\n    expect(within(plugPage).getByRole('tab', { name: 'Skanuj sieć' })).toBeVisible();\n    expect(plugPage).not.toHaveClass('automation-card');\n    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();\n    closeCurrentAddPage();\n\n    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));\n    const sensorPage = await openSensorAddDialog();\n    expect(within(sensorPage).getByLabelText('MAC termometru')).toBeVisible();\n    expect(sensorPage).not.toHaveClass('automation-card');\n    expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();""",
)
replace(
    test,
    """    const savedPlugList = await screen.findByLabelText('Dodane gniazdka');\n    expect(within(savedPlugList).getByText('Salon')).toBeInTheDocument();\n    expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();\n    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();""",
    """    expect(screen.getByRole('heading', { name: 'Dodaj gniazdko' })).toBeVisible();\n    expect(\n      within(page).getByRole('button', { name: 'Dodane: http://192.168.0.20/' })\n    ).toBeDisabled();\n    expect(within(page).getByText('http://192.168.0.20/')).toBeInTheDocument();\n    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();\n    closeCurrentAddPage();\n    const savedPlugList = await screen.findByLabelText('Dodane gniazdka');\n    expect(within(savedPlugList).getByText('Salon')).toBeInTheDocument();""",
)
replace(
    test,
    """    expect(screen.queryByRole('heading', { name: 'Dodaj termometr' })).toBeNull();\n    expect(await screen.findByText('Termometr 24:CD')).toBeInTheDocument();\n    expect(screen.getByText('21.3°C')).toBeInTheDocument();\n    expect(screen.getByText('45.7%')).toBeInTheDocument();\n    const sensorCard = getSavedSensorCard('Termometr 24:CD');\n    expect(within(sensorCard).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();""",
    """    expect(screen.getByRole('heading', { name: 'Dodaj termometr' })).toBeVisible();\n    expect(\n      within(xiaomiItem!).getByRole('button', { name: 'Już zapisany' })\n    ).toBeDisabled();\n    expect(within(page).getByText('F7:5F:8D:0F:76:20')).toBeInTheDocument();\n    closeCurrentAddPage();\n    expect(await screen.findByText('Termometr 24:CD')).toBeInTheDocument();\n    expect(screen.getByText('21.3°C')).toBeInTheDocument();\n    expect(screen.getByText('45.7%')).toBeInTheDocument();\n    const sensorCard = getSavedSensorCard('Termometr 24:CD');\n    expect(within(sensorCard).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();""",
)
replace(
    test,
    """    const sensorCard = getSavedSensorCard('Xiaomi salon');\n    expect(within(sensorCard).getByText('100%')).toBeInTheDocument();\n    expect(within(sensorCard).getByText('-72 dBm')).toBeInTheDocument();""",
    """    const sensorCard = getSavedSensorCard('Xiaomi salon');\n    await waitFor(() => expect(within(sensorCard).getByText('100%')).toBeInTheDocument());\n    await waitFor(() =>\n      expect(within(sensorCard).getByText('-72 dBm')).toBeInTheDocument()\n    );""",
)

nav_test = 'apps/mobile/src/__tests__/navigation-settings-regression.test.tsx'
replace(
    nav_test,
    """    expect(document.querySelector('.app-settings__hint')).toBeNull();\n  });""",
    """    expect(document.querySelector('.app-settings__hint')).toBeNull();\n    const shell = document.querySelector('.app-root-shell');\n    const content = shell?.querySelector(':scope > .app-root-shell__content');\n    const navigation = shell?.querySelector(':scope > .app-bottom-nav');\n    expect(shell).not.toBeNull();\n    expect(content).not.toBeNull();\n    expect(navigation).not.toBeNull();\n    expect(content?.contains(navigation ?? null)).toBe(false);\n  });""",
)

print('Unified full-page add flows and persistent app shell applied')

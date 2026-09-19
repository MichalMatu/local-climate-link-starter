from pathlib import Path

ROOT = Path('.')


def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def replace_span(path: str, start_marker: str, end_marker: str, replacement: str) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f'start marker not found in {path}: {start_marker!r}')
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f'end marker not found in {path}: {end_marker!r}')
    end += len(end_marker)
    p.write_text(text[:start] + replacement + text[end:], encoding='utf-8')


# 1) Allow a user-edited display name when saving a discovered thermometer.
phone_flow = 'apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts'
replace_once(
    phone_flow,
    """  const addDiscoveredSensor = (\n    candidate: BleDiscoveryCandidate,\n    source: SensorRuntimeSource = 'phone-scan'\n  ) => {\n    const runtimeAddress = normalizeRuntimeAddress(candidate.runtimeAddress);\n    const name = t('hardware.flow.sensorDefaultName', {\n      suffix: runtimeAddress.split(':').slice(-2).join(':')\n    });""",
    """  const addDiscoveredSensor = (\n    candidate: BleDiscoveryCandidate,\n    source: SensorRuntimeSource = 'phone-scan',\n    displayName?: string\n  ) => {\n    const runtimeAddress = normalizeRuntimeAddress(candidate.runtimeAddress);\n    const name =\n      displayName?.trim() ||\n      t('hardware.flow.sensorDefaultName', {\n        suffix: runtimeAddress.split(':').slice(-2).join(':')\n      });""",
)

# 2) Thermometer add page: no duplicate visual header, editable name per candidate,
# compact add action, scan control after the result list.
sensor_page = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
replace_once(
    sensor_page,
    """  const [addMode, setAddMode] = useState<SensorAddMode>(primaryAddAction);\n  const autoScanStartedRef = useRef(false);""",
    """  const [addMode, setAddMode] = useState<SensorAddMode>(primaryAddAction);\n  const [scanCandidateNames, setScanCandidateNames] = useState<Record<string, string>>({});\n  const autoScanStartedRef = useRef(false);""",
)
replace_once(
    sensor_page,
    """  const saveScannedSensor = (candidate: BleDiscoveryCandidate) => {\n    flow.addDiscoveredSensor(candidate);\n    pushToast('ok', t('hardware.shelly.thermometerSaved'));\n  };""",
    """  const defaultScannedSensorName = (candidate: BleDiscoveryCandidate) =>\n    t('hardware.flow.sensorDefaultName', {\n      suffix: candidate.runtimeAddress.split(':').slice(-2).join(':')\n    });\n\n  const scannedSensorName = (candidate: BleDiscoveryCandidate) =>\n    scanCandidateNames[candidate.runtimeAddress] ?? defaultScannedSensorName(candidate);\n\n  const setScannedSensorName = (candidate: BleDiscoveryCandidate, value: string) => {\n    setScanCandidateNames((current) => ({\n      ...current,\n      [candidate.runtimeAddress]: value\n    }));\n  };\n\n  const saveScannedSensor = (candidate: BleDiscoveryCandidate) => {\n    const name = scannedSensorName(candidate).trim();\n    if (!name) return;\n    flow.addDiscoveredSensor(candidate, 'phone-scan', name);\n    pushToast('ok', t('hardware.shelly.thermometerSaved'));\n  };""",
)

scan_start = "  const scanContent = (\n"
scan_end = "  if (addOnly) {"
new_scan = """  const scanContent = (\n    <section\n      className=\"sensor-add-scan\"\n      role=\"tabpanel\"\n      aria-label={t('hardware.sensor.scanBle')}\n    >\n      {shouldShowPhoneBleEmpty && <p>{t('hardware.sensor.noBleFound')}</p>}\n      {flow.phoneBleScanCandidates.length > 0 && (\n        <div\n          className=\"ble-candidate-list\"\n          aria-label={t('hardware.sensor.blePhoneFoundLabel')}\n        >\n          {flow.phoneBleScanCandidates.map((candidate) => {\n            const hasTemperature = typeof candidate.temperatureC === 'number';\n            const hasHumidity = typeof candidate.humidityPct === 'number';\n            const savedSensor = flow.sensorDevices.find(\n              (device) =>\n                device.runtimeAddress.toUpperCase() ===\n                candidate.runtimeAddress.toUpperCase()\n            );\n            const isSavedSensor = savedSensor !== undefined;\n            const displayName = savedSensor?.name ?? scannedSensorName(candidate);\n\n            return (\n              <article key={candidate.runtimeAddress} className=\"ble-candidate-item\">\n                <div className=\"ble-candidate-content\">\n                  <label className=\"ble-candidate-name\">\n                    <span>{t('hardware.sensor.nameLabel')}</span>\n                    <input\n                      aria-label={`${t('hardware.sensor.nameLabel')}: ${candidate.runtimeAddress}`}\n                      type=\"text\"\n                      value={displayName}\n                      disabled={isSavedSensor}\n                      onChange={(event) =>\n                        setScannedSensorName(candidate, event.currentTarget.value)\n                      }\n                    />\n                  </label>\n                  <div className=\"ble-candidate-main\">\n                    <strong>{candidate.runtimeAddress}</strong>\n                    <span>{sensorProfileDisplayLabels[candidate.profileId]}</span>\n                  </div>\n                  <dl className=\"ble-candidate-metrics\">\n                    <div>\n                      <dt>RSSI</dt>\n                      <dd>\n                        {formatSensorMetric(candidate.rssi, ' dBm', 0, t('common.missing'))}\n                      </dd>\n                    </div>\n                    {hasTemperature && (\n                      <div>\n                        <dt>{t('hardware.metrics.temperatureShort')}</dt>\n                        <dd>\n                          {formatSensorMetric(\n                            candidate.temperatureC,\n                            '°C',\n                            1,\n                            t('common.missing')\n                          )}\n                        </dd>\n                      </div>\n                    )}\n                    {hasHumidity && (\n                      <div>\n                        <dt>{t('hardware.metrics.humidityShort')}</dt>\n                        <dd>\n                          {formatSensorMetric(\n                            candidate.humidityPct,\n                            '%',\n                            1,\n                            t('common.missing')\n                          )}\n                        </dd>\n                      </div>\n                    )}\n                  </dl>\n                </div>\n                <button\n                  className=\"primary-action ble-candidate-action\"\n                  type=\"button\"\n                  disabled={isSavedSensor || displayName.trim().length === 0}\n                  title={\n                    isSavedSensor\n                      ? t('hardware.sensor.saveThermometerSavedTitle')\n                      : t('hardware.sensor.saveThermometerTitle')\n                  }\n                  onClick={() => saveScannedSensor(candidate)}\n                >\n                  {isSavedSensor ? t('hardware.sensor.saved') : t('common.add')}\n                </button>\n              </article>\n            );\n          })}\n        </div>\n      )}\n      <div className=\"action-row device-add-page__actions device-add-page__scan-control\">\n        <button\n          className=\"secondary-action\"\n          type=\"button\"\n          title={\n            isPhoneBleScanPending\n              ? t('hardware.sensor.scanStopTitle')\n              : t('hardware.sensor.scanAgainTitle')\n          }\n          onClick={isPhoneBleScanPending ? flow.stopPhoneBleScan : startPhoneBleScan}\n        >\n          {isPhoneBleScanPending\n            ? t('hardware.shelly.scanStop')\n            : t('hardware.shelly.scanBleAgain')}\n        </button>\n      </div>\n    </section>\n  );\n\n  if (addOnly) {"""
replace_span(sensor_page, scan_start, scan_end, new_scan)
replace_once(
    sensor_page,
    """        <header className=\"demo-header app-page-header device-add-page__header\">\n          <h1>{t('hardware.sensor.add')}</h1>\n        </header>\n""",
    "",
)

# 3) Plug add page: no duplicate visual header; compact presets; scan results are
# object cards with only the editable name as an input; scan action is below results.
shelly_page = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace_once(
    shelly_page,
    """          <header className=\"demo-header app-page-header device-add-page__header\">\n            <h1>{t('hardware.shelly.add')}</h1>\n          </header>\n""",
    "",
)

p = ROOT / shelly_page
text = p.read_text(encoding='utf-8')
start_marker = "            {activeAddSection === 'scan' && (\n"
end_marker = "            )}\n          </div>\n        </>\n      )}"
start = text.find(start_marker)
if start < 0:
    raise SystemExit('Shelly scan block start not found')
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit('Shelly scan block end not found')
replacement = """            {activeAddSection === 'scan' && (\n              <section\n                className=\"shelly-network-scan\"\n                role=\"tabpanel\"\n                aria-label={t('hardware.shelly.scanNetwork')}\n              >\n                <div className=\"shelly-network-scan__body\">\n                  <div\n                    className=\"shelly-network-scan__presets\"\n                    role=\"group\"\n                    aria-label={t('hardware.shelly.networkScanTitle')}\n                  >\n                    <button\n                      className=\"shelly-network-scan__preset\"\n                      type=\"button\"\n                      disabled={isShellyScanActive}\n                      onClick={() =>\n                        applyShellyScanPreset(SHELLY_STA_SCAN_START, SHELLY_STA_SCAN_END)\n                      }\n                    >\n                      STA\n                    </button>\n                    <button\n                      className=\"shelly-network-scan__preset\"\n                      type=\"button\"\n                      disabled={isShellyScanActive}\n                      onClick={() =>\n                        applyShellyScanPreset(\n                          SHELLY_AP_SCAN_ADDRESS,\n                          SHELLY_AP_SCAN_ADDRESS\n                        )\n                      }\n                    >\n                      AP\n                    </button>\n                  </div>\n                  <div className=\"shelly-network-scan__range\">\n                    <label\n                      className={\n                        showShellyScanRangeError ? 'field field--invalid' : 'field'\n                      }\n                    >\n                      {t('hardware.shelly.scanRangeStart')}\n                      <input\n                        aria-describedby={\n                          showShellyScanRangeError ? scanRangeErrorId : undefined\n                        }\n                        aria-invalid={showShellyScanRangeError}\n                        type=\"text\"\n                        inputMode=\"numeric\"\n                        placeholder=\"192.168.0.1\"\n                        value={flow.shellyScanStartInput}\n                        onChange={(event) =>\n                          flow.setShellyScanStartInput(event.currentTarget.value)\n                        }\n                      />\n                    </label>\n                    <label\n                      className={\n                        showShellyScanRangeError ? 'field field--invalid' : 'field'\n                      }\n                    >\n                      {t('hardware.shelly.scanRangeEnd')}\n                      <input\n                        aria-describedby={\n                          showShellyScanRangeError ? scanRangeErrorId : undefined\n                        }\n                        aria-invalid={showShellyScanRangeError}\n                        type=\"text\"\n                        inputMode=\"numeric\"\n                        placeholder=\"192.168.0.99\"\n                        value={flow.shellyScanEndInput}\n                        onChange={(event) =>\n                          flow.setShellyScanEndInput(event.currentTarget.value)\n                        }\n                      />\n                      {showShellyScanRangeError && (\n                        <span className=\"field__error\" id={scanRangeErrorId}>\n                          {shellyScanRangeError}\n                        </span>\n                      )}\n                    </label>\n                  </div>\n                  <p className=\"device-add-page__hint\">\n                    <InfoLabel\n                      label={shellyScanEstimate}\n                      infoLabel={t('hardware.shelly.infoScanLabel')}\n                      title={t('hardware.shelly.infoScanTitle')}\n                    >\n                      {t('hardware.shelly.scannerBehavior')}\n                    </InfoLabel>\n                  </p>\n                  {shouldShowEmptyScanResult && (\n                    <p>{t('hardware.shelly.scanResultEmpty')}</p>\n                  )}\n                  {scanResults.length > 0 && (\n                    <div\n                      className=\"saved-list\"\n                      aria-label={t('hardware.shelly.foundListLabel')}\n                    >\n                      {scanResults.map((result) => (\n                        <article\n                          key={result.baseUrl}\n                          className=\"saved-list__item shelly-scan-result\"\n                        >\n                          <div className=\"shelly-scan-result__row\">\n                            <div className=\"shelly-scan-result__content\">\n                              <label className=\"shelly-scan-result__name\">\n                                <span>{t('hardware.shelly.deviceNameLabel')}</span>\n                                <input\n                                  className=\"shelly-scan-result__name-input\"\n                                  aria-label={`${t('hardware.shelly.deviceNameLabel')}: ${result.baseUrl}`}\n                                  type=\"text\"\n                                  value={scannedShellyName(result)}\n                                  disabled={isSavedShellyScanResult(result)}\n                                  onChange={(event) =>\n                                    setScannedShellyName(result, event.currentTarget.value)\n                                  }\n                                />\n                              </label>\n                              <div className=\"shelly-scan-result__meta\">\n                                <span>{result.baseUrl}</span>\n                                <span>\n                                  {result.deviceInfo.model}, gen {result.deviceInfo.gen}\n                                </span>\n                              </div>\n                            </div>\n                            <button\n                              aria-label={\n                                isSavedShellyScanResult(result)\n                                  ? `${t('hardware.shelly.alreadyAdded')}: ${result.baseUrl}`\n                                  : `${t('common.add')}: ${result.baseUrl}`\n                              }\n                              aria-busy={isAddingScannedShelly(result) || undefined}\n                              className=\"primary-action shelly-scan-result__add\"\n                              type=\"button\"\n                              disabled={\n                                isSavedShellyScanResult(result) ||\n                                flow.checkShellyMutation.isPending ||\n                                scannedShellyName(result).trim().length === 0\n                              }\n                              onClick={() => addScannedShellyDevice(result)}\n                            >\n                              {isSavedShellyScanResult(result)\n                                ? t('hardware.shelly.alreadyAdded')\n                                : isAddingScannedShelly(result)\n                                  ? t('hardware.shelly.checking')\n                                  : t('common.add')}\n                            </button>\n                          </div>\n                        </article>\n                      ))}\n                    </div>\n                  )}\n                  <div className=\"action-row shelly-network-scan__actions device-add-page__scan-control\">\n                    <button\n                      className=\"secondary-action\"\n                      type=\"button\"\n                      title={\n                        isShellyScanActive\n                          ? t('hardware.shelly.scanStopTitle')\n                          : t('hardware.shelly.scanStartTitle')\n                      }\n                      onClick={isShellyScanActive ? stopShellyScan : startShellyScan}\n                    >\n                      {isShellyScanActive\n                        ? t('hardware.shelly.scanStop')\n                        : t('hardware.shelly.scanStart')}\n                    </button>\n                  </div>\n                </div>\n              </section>\n            )}\n"""
p.write_text(text[:start] + replacement + text[end + len("            )}\n"):], encoding='utf-8')

# 4) Dashboard-origin add pages use the persistent bottom nav instead of a duplicate top Back.
hardware = 'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx'
replace_once(
    hardware,
    """  sensorAddMode?: SensorAddMode;\n  onPlugAddCancel?: () => void;\n  onSensorAddCancel?: () => void;\n};""",
    """  sensorAddMode?: SensorAddMode;\n};""",
)
replace_once(
    hardware,
    """  sensorAddOnly = false,\n  sensorAddMode = 'phone-scan',\n  onPlugAddCancel,\n  onSensorAddCancel\n}: HardwareSetupScreenProps = {}) => {""",
    """  sensorAddOnly = false,\n  sensorAddMode = 'phone-scan'\n}: HardwareSetupScreenProps = {}) => {""",
)
replace_once(
    hardware,
    """      {plugAddOnly && onPlugAddCancel && (\n        <AppPageBack label={t('dashboard.climateTab')} onBack={onPlugAddCancel} />\n      )}\n      {sensorAddOnly && onSensorAddCancel && (\n        <AppPageBack label={t('dashboard.timeTab')} onBack={onSensorAddCancel} />\n      )}\n""",
    "",
)

routes = 'apps/mobile/src/routes/AppRoutes.tsx'
replace_once(
    routes,
    """  } else if (route.type === 'device-add') {\n    const leaveAddPage = () => navigate(route.returnTo);\n    content = (\n      <Suspense fallback={<RouteFallback />}>\n        <HardwareSetupScreen\n          {...(route.device === 'plug'\n            ? { plugAddOnly: true }\n            : { sensorAddOnly: true, sensorAddMode: route.sensorMode ?? 'manual' })}\n          {...(route.device === 'plug'\n            ? { onPlugAddCancel: leaveAddPage }\n            : { onSensorAddCancel: leaveAddPage })}\n        />\n      </Suspense>\n    );""",
    """  } else if (route.type === 'device-add') {\n    content = (\n      <Suspense fallback={<RouteFallback />}>\n        <HardwareSetupScreen\n          {...(route.device === 'plug'\n            ? { plugAddOnly: true }\n            : { sensorAddOnly: true, sensorAddMode: route.sensorMode ?? 'manual' })}\n        />\n      </Suspense>\n    );""",
)

# 5) Styling: flatter add pages, compact per-result actions, text metadata, presets aligned
# to content instead of centered, and no extra scan progress row.
theme = ROOT / 'apps/mobile/src/theme/theme.css'
css = theme.read_text(encoding='utf-8')
css += """

/* Device add pages are workspace pages, not modal-shaped cards. */
.device-add-page {
  gap: var(--lcl-spacing-md);
}

.device-add-page__scan-control {
  margin-top: var(--lcl-spacing-xs);
}

.shelly-network-scan__presets {
  justify-self: start;
}

.shelly-network-scan__preset {
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-md);
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-bold);
  min-height: var(--lcl-size-compact-control-min-height);
  padding: 0 var(--lcl-spacing-md);
}

.shelly-scan-result__row {
  align-items: center;
  gap: var(--lcl-spacing-md);
  grid-template-columns: minmax(0, 1fr) auto;
}

.shelly-scan-result__content {
  display: grid;
  gap: var(--lcl-spacing-sm);
  min-width: 0;
}

.shelly-scan-result__name {
  display: grid;
  gap: var(--lcl-spacing-xs);
  min-width: 0;
}

.shelly-scan-result__name > span,
.ble-candidate-name > span {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-semibold);
}

.shelly-scan-result__meta {
  color: var(--lcl-color-text-muted);
  display: flex;
  flex-wrap: wrap;
  font-size: var(--lcl-font-size-sm);
  gap: var(--lcl-spacing-xs) var(--lcl-spacing-md);
  overflow-wrap: anywhere;
}

.shelly-scan-result__add,
.ble-candidate-action {
  align-self: center;
  min-height: var(--lcl-size-compact-control-min-height);
  padding-inline: var(--lcl-spacing-md);
  width: auto;
}

.ble-candidate-item {
  align-items: center;
  grid-template-columns: minmax(0, 1fr) auto;
}

.ble-candidate-content,
.ble-candidate-name {
  display: grid;
  gap: var(--lcl-spacing-sm);
  min-width: 0;
}

.ble-candidate-name {
  gap: var(--lcl-spacing-xs);
}

.ble-candidate-name input,
.shelly-scan-result__name-input {
  min-width: 0;
  width: 100%;
}

@media (max-width: 24rem) {
  .ble-candidate-item,
  .shelly-scan-result__row {
    grid-template-columns: minmax(0, 1fr);
  }

  .ble-candidate-action,
  .shelly-scan-result__add {
    justify-self: end;
    width: auto;
  }
}
"""
theme.write_text(css, encoding='utf-8')

# 6) Tests follow the page contract instead of relying on a visible H1.
test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
replace_once(
    test,
    """const openShellyAddDialog = async (section: 'manual' | 'scan' = 'manual') => {\n  fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));\n  const heading = await screen.findByRole('heading', { name: 'Dodaj gniazdko' });\n  const page = heading.closest('.device-add-page') as HTMLElement;\n  expect(page).not.toBeNull();\n  expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();\n  if (section === 'manual') {\n    fireEvent.click(within(page).getByRole('tab', { name: 'Dodaj ręcznie' }));\n  }\n  return page;\n};\n\nconst openSensorAddDialog = async () => {\n  fireEvent.click(screen.getByRole('button', { name: 'Dodaj termometr' }));\n  const heading = await screen.findByRole('heading', { name: 'Dodaj termometr' });\n  const page = heading.closest('.device-add-page') as HTMLElement;\n  expect(page).not.toBeNull();\n  expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();\n  fireEvent.click(within(page).getByRole('tab', { name: 'Dodaj ręcznie' }));\n  return page;\n};""",
    """const openShellyAddDialog = async (section: 'manual' | 'scan' = 'manual') => {\n  fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));\n  const page = await screen.findByRole('region', { name: 'Dodaj gniazdko' });\n  expect(page).toHaveClass('device-add-page');\n  expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();\n  if (section === 'manual') {\n    fireEvent.click(within(page).getByRole('tab', { name: 'Dodaj ręcznie' }));\n  }\n  return page;\n};\n\nconst openSensorAddDialog = async () => {\n  fireEvent.click(screen.getByRole('button', { name: 'Dodaj termometr' }));\n  const page = await screen.findByRole('region', { name: 'Dodaj termometr' });\n  expect(page).toHaveClass('device-add-page');\n  expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();\n  fireEvent.click(within(page).getByRole('tab', { name: 'Dodaj ręcznie' }));\n  return page;\n};""",
)
replace_once(
    test,
    """  expect(screen.getByRole('heading', { name: 'Dodaj gniazdko' })).toBeVisible();\n  expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();""",
    """  expect(screen.getByRole('region', { name: 'Dodaj gniazdko' })).toBeVisible();\n  expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();\n  expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();""",
)
replace_once(
    test,
    """  expect(screen.getByRole('heading', { name: 'Dodaj termometr' })).toBeVisible();\n  expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();""",
    """  expect(screen.getByRole('region', { name: 'Dodaj termometr' })).toBeVisible();\n  expect(screen.queryByRole('heading', { name: 'Dodaj termometr' })).toBeNull();\n  expect(screen.queryByRole('dialog', { name: 'Dodaj termometr' })).toBeNull();""",
)
# Shelly scanned result is flat metadata: only name remains an input and the page stays open.
replace_once(
    test,
    """    const scannedNameField = scannedName.closest('label');\n    const scannedRow = scannedName.closest('.shelly-scan-result__row');\n    expect(scannedNameField).toHaveClass('field', 'shelly-scan-result__name');\n    expect(scannedRow).not.toBeNull();\n    expect(scannedRow?.children[0]).toBe(scannedNameField);\n    expect(scannedRow?.children[1]).toHaveTextContent('Adres');\n    expect(scannedRow?.children[2]).toHaveTextContent('Model');""",
    """    const scannedRow = scannedName.closest('.shelly-scan-result__row');\n    expect(scannedRow).not.toBeNull();\n    expect(within(scannedRow!).getAllByRole('textbox')).toHaveLength(1);\n    expect(within(scannedRow!).getByText('http://192.168.0.20/')).toBeVisible();\n    expect(within(scannedRow!).getByText('S3PL-00112EU, gen 3')).toBeVisible();""",
)
replace_once(
    test,
    """    expect(screen.getByRole('heading', { name: 'Dodaj gniazdko' })).toBeVisible();\n    await waitFor(() =>""",
    """    expect(screen.getByRole('region', { name: 'Dodaj gniazdko' })).toBeVisible();\n    expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();\n    await waitFor(() =>""",
)
# Thermometer scanned candidate supports a custom display name and remains on the page.
replace_once(
    test,
    """    expect(\n      within(xiaomiItem!).getByRole('button', { name: 'Zapisz termometr' })\n    ).toHaveAttribute('title', 'Zapisz ten termometr w aplikacji');""",
    """    expect(within(xiaomiItem!).getByRole('button', { name: 'Dodaj' })).toHaveAttribute(\n      'title',\n      'Zapisz ten termometr w aplikacji'\n    );\n    expect(\n      within(xiaomiItem!).getByRole('textbox', {\n        name: 'Nazwa termometru: A4:C1:38:4F:24:CD'\n      })\n    ).toHaveValue('Termometr 24:CD');""",
)
replace_once(
    test,
    """    fireEvent.click(\n      within(xiaomiItem!).getByRole('button', { name: 'Zapisz termometr' })\n    );\n\n    expect(screen.getByRole('heading', { name: 'Dodaj termometr' })).toBeVisible();""",
    """    const scannedSensorName = within(xiaomiItem!).getByRole('textbox', {\n      name: 'Nazwa termometru: A4:C1:38:4F:24:CD'\n    });\n    fireEvent.change(scannedSensorName, { target: { value: 'Salon półka' } });\n    fireEvent.click(within(xiaomiItem!).getByRole('button', { name: 'Dodaj' }));\n\n    expect(screen.getByRole('region', { name: 'Dodaj termometr' })).toBeVisible();\n    expect(screen.queryByRole('heading', { name: 'Dodaj termometr' })).toBeNull();""",
)
replace_once(
    test,
    """    expect(await screen.findByText('Termometr 24:CD')).toBeInTheDocument();\n    expect(screen.getByText('21.3°C')).toBeInTheDocument();\n    expect(screen.getByText('45.7%')).toBeInTheDocument();\n    const sensorCard = getSavedSensorCard('Termometr 24:CD');""",
    """    expect(await screen.findByText('Salon półka')).toBeInTheDocument();\n    expect(screen.getByText('21.3°C')).toBeInTheDocument();\n    expect(screen.getByText('45.7%')).toBeInTheDocument();\n    const sensorCard = getSavedSensorCard('Salon półka');""",
)
# Add-only screens entered from the persistent shell should not duplicate the bottom-nav back destination.
insert_marker = """  it('opens device add flows as full child pages instead of modals', async () => {"""
insert = """  it('keeps standalone device-add pages free of duplicate top navigation and titles', () => {\n    const { unmount } = renderHardwareSetup({ plugAddOnly: true });\n    expect(screen.getByRole('region', { name: 'Dodaj gniazdko' })).toBeVisible();\n    expect(document.querySelector('.app-page-back-row')).toBeNull();\n    expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();\n\n    unmount();\n    renderHardwareSetup({ sensorAddOnly: true, sensorAddMode: 'phone-scan' });\n    expect(screen.getByRole('region', { name: 'Dodaj termometr' })).toBeVisible();\n    expect(document.querySelector('.app-page-back-row')).toBeNull();\n    expect(screen.queryByRole('heading', { name: 'Dodaj termometr' })).toBeNull();\n  });\n\n""" + insert_marker
replace_once(test, insert_marker, insert)

# Quality gate captures the new boundary so the page header/card pattern does not creep back.
ux = 'scripts/quality/ux-gate.mjs'
replace_once(
    ux,
    """  if (!routesSource.includes(\"type: 'device-add'\")) {\n    addFailure(routesPath, 'device add flows must be represented in the app page tree');\n  }\n};""",
    """  if (!routesSource.includes(\"type: 'device-add'\")) {\n    addFailure(routesPath, 'device add flows must be represented in the app page tree');\n  }\n  if (sensorSource.includes('device-add-page__header')) {\n    addFailure(sensorPath, 'standalone thermometer add page must not duplicate shell navigation/title');\n  }\n  if (shellySource.includes('device-add-page__header')) {\n    addFailure(shellyPath, 'standalone plug add page must not duplicate shell navigation/title');\n  }\n};""",
)

print('Refined plug and thermometer add-page UX')

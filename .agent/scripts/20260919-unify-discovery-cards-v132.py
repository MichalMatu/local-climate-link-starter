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


# Shelly add page: remove preset/help chrome and use the shared discovery-card layout.
shelly = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace_once(shelly, "import { InfoLabel, Modal, ToastViewport } from '@lcl/ui';", "import { Modal, ToastViewport } from '@lcl/ui';")
replace_once(
    shelly,
    """import {\n  formatShellyScanEstimate,\n  SavedShellyDeviceCard,\n  ShellyAddForm\n} from './ShellySetupPresentation.js';""",
    """import { SavedShellyDeviceCard, ShellyAddForm } from './ShellySetupPresentation.js';""",
)
replace_once(
    shelly,
    """const SHELLY_AP_SCAN_ADDRESS = '192.168.33.1';\nconst SHELLY_STA_SCAN_START = '192.168.0.1';\nconst SHELLY_STA_SCAN_END = '192.168.0.254';\n\n""",
    '',
)
replace_once(shelly, "  const { locale, t } = useTranslation();", "  const { t } = useTranslation();")
replace_once(
    shelly,
    """  const shellyScanEstimate = formatShellyScanEstimate(\n    flow.shellyScanStartInput,\n    flow.shellyScanEndInput,\n    locale,\n    t\n  );\n""",
    '',
)
replace_once(
    shelly,
    """  const applyShellyScanPreset = (start: string, end: string) => {\n    flow.resetShellyScan();\n    setDidSubmitShellyScan(false);\n    setScanResultNames({});\n    flow.setShellyScanStartInput(start);\n    flow.setShellyScanEndInput(end);\n  };\n\n""",
    '',
)
replace_once(
    shelly,
    """                  <div\n                    className=\"shelly-network-scan__presets\"\n                    role=\"group\"\n                    aria-label={t('hardware.shelly.networkScanTitle')}\n                  >\n                    <button\n                      className=\"shelly-network-scan__preset\"\n                      type=\"button\"\n                      disabled={isShellyScanActive}\n                      onClick={() =>\n                        applyShellyScanPreset(SHELLY_STA_SCAN_START, SHELLY_STA_SCAN_END)\n                      }\n                    >\n                      STA\n                    </button>\n                    <button\n                      className=\"shelly-network-scan__preset\"\n                      type=\"button\"\n                      disabled={isShellyScanActive}\n                      onClick={() =>\n                        applyShellyScanPreset(\n                          SHELLY_AP_SCAN_ADDRESS,\n                          SHELLY_AP_SCAN_ADDRESS\n                        )\n                      }\n                    >\n                      AP\n                    </button>\n                  </div>\n""",
    '',
)
replace_once(
    shelly,
    """                  <p className=\"device-add-page__hint\">\n                    <InfoLabel\n                      label={shellyScanEstimate}\n                      infoLabel={t('hardware.shelly.infoScanLabel')}\n                      title={t('hardware.shelly.infoScanTitle')}\n                    >\n                      {t('hardware.shelly.scannerBehavior')}\n                    </InfoLabel>\n                  </p>\n""",
    '',
)
old_shelly_card = """                        <article\n                          key={result.baseUrl}\n                          className=\"saved-list__item shelly-scan-result\"\n                        >\n                          <div className=\"shelly-scan-result__row\">\n                            <div className=\"shelly-scan-result__content\">\n                              <label className=\"shelly-scan-result__name\">\n                                <span>{t('hardware.shelly.deviceNameLabel')}</span>\n                                <input\n                                  className=\"shelly-scan-result__name-input\"\n                                  aria-label={`${t('hardware.shelly.deviceNameLabel')}: ${result.baseUrl}`}\n                                  type=\"text\"\n                                  value={scannedShellyName(result)}\n                                  disabled={isSavedShellyScanResult(result)}\n                                  onChange={(event) =>\n                                    setScannedShellyName(\n                                      result,\n                                      event.currentTarget.value\n                                    )\n                                  }\n                                />\n                              </label>\n                              <div className=\"shelly-scan-result__meta\">\n                                <span>{result.baseUrl}</span>\n                                <span>\n                                  {result.deviceInfo.model}, gen {result.deviceInfo.gen}\n                                </span>\n                              </div>\n                            </div>\n                            <button\n                              aria-label={\n                                isSavedShellyScanResult(result)\n                                  ? `${t('hardware.shelly.alreadyAdded')}: ${result.baseUrl}`\n                                  : `${t('common.add')}: ${result.baseUrl}`\n                              }\n                              aria-busy={isAddingScannedShelly(result) || undefined}\n                              className=\"primary-action shelly-scan-result__add\"\n                              type=\"button\"\n                              disabled={\n                                isSavedShellyScanResult(result) ||\n                                flow.checkShellyMutation.isPending ||\n                                scannedShellyName(result).trim().length === 0\n                              }\n                              onClick={() => addScannedShellyDevice(result)}\n                            >\n                              {isSavedShellyScanResult(result)\n                                ? t('hardware.shelly.alreadyAdded')\n                                : isAddingScannedShelly(result)\n                                  ? t('hardware.shelly.checking')\n                                  : t('common.add')}\n                            </button>\n                          </div>\n                        </article>"""
new_shelly_card = """                        <article\n                          key={result.baseUrl}\n                          className=\"device-discovery-card shelly-scan-result\"\n                        >\n                          <div className=\"device-discovery-card__primary\">\n                            <label className=\"device-discovery-card__name\">\n                              <span>{t('hardware.shelly.deviceNameLabel')}</span>\n                              <input\n                                className=\"device-discovery-card__name-input shelly-scan-result__name-input\"\n                                aria-label={`${t('hardware.shelly.deviceNameLabel')}: ${result.baseUrl}`}\n                                type=\"text\"\n                                value={scannedShellyName(result)}\n                                disabled={isSavedShellyScanResult(result)}\n                                onChange={(event) =>\n                                  setScannedShellyName(result, event.currentTarget.value)\n                                }\n                              />\n                            </label>\n                            <button\n                              aria-label={\n                                isSavedShellyScanResult(result)\n                                  ? `${t('hardware.shelly.alreadyAdded')}: ${result.baseUrl}`\n                                  : `${t('common.add')}: ${result.baseUrl}`\n                              }\n                              aria-busy={isAddingScannedShelly(result) || undefined}\n                              className=\"primary-action device-discovery-card__action shelly-scan-result__add\"\n                              type=\"button\"\n                              disabled={\n                                isSavedShellyScanResult(result) ||\n                                flow.checkShellyMutation.isPending ||\n                                scannedShellyName(result).trim().length === 0\n                              }\n                              onClick={() => addScannedShellyDevice(result)}\n                            >\n                              {isSavedShellyScanResult(result)\n                                ? t('hardware.shelly.alreadyAdded')\n                                : isAddingScannedShelly(result)\n                                  ? t('hardware.shelly.checking')\n                                  : t('common.add')}\n                            </button>\n                          </div>\n                          <div className=\"device-discovery-card__meta shelly-scan-result__meta\">\n                            <span>{result.baseUrl}</span>\n                            <span>\n                              {result.deviceInfo.model}, gen {result.deviceInfo.gen}\n                            </span>\n                          </div>\n                        </article>"""
replace_once(shelly, old_shelly_card, new_shelly_card)

# Thermometer scan results use exactly the same primary-row/name/action contract.
sensor = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
old_sensor_card = """              <article key={candidate.runtimeAddress} className=\"ble-candidate-item\">\n                <div className=\"ble-candidate-content\">\n                  <label className=\"ble-candidate-name\">\n                    <span>{t('hardware.sensor.nameLabel')}</span>\n                    <input\n                      aria-label={`${t('hardware.sensor.nameLabel')}: ${candidate.runtimeAddress}`}\n                      type=\"text\"\n                      value={displayName}\n                      disabled={isSavedSensor}\n                      onChange={(event) =>\n                        setScannedSensorName(candidate, event.currentTarget.value)\n                      }\n                    />\n                  </label>\n                  <div className=\"ble-candidate-main\">\n                    <strong>{candidate.runtimeAddress}</strong>\n                    <span>{sensorProfileDisplayLabels[candidate.profileId]}</span>\n                  </div>\n                  <dl className=\"ble-candidate-metrics\">\n                    <div>\n                      <dt>RSSI</dt>\n                      <dd>\n                        {formatSensorMetric(\n                          candidate.rssi,\n                          ' dBm',\n                          0,\n                          t('common.missing')\n                        )}\n                      </dd>\n                    </div>\n                    {hasTemperature && (\n                      <div>\n                        <dt>{t('hardware.metrics.temperatureShort')}</dt>\n                        <dd>\n                          {formatSensorMetric(\n                            candidate.temperatureC,\n                            '°C',\n                            1,\n                            t('common.missing')\n                          )}\n                        </dd>\n                      </div>\n                    )}\n                    {hasHumidity && (\n                      <div>\n                        <dt>{t('hardware.metrics.humidityShort')}</dt>\n                        <dd>\n                          {formatSensorMetric(\n                            candidate.humidityPct,\n                            '%',\n                            1,\n                            t('common.missing')\n                          )}\n                        </dd>\n                      </div>\n                    )}\n                  </dl>\n                </div>\n                <button\n                  className=\"primary-action ble-candidate-action\"\n                  type=\"button\"\n                  disabled={isSavedSensor || displayName.trim().length === 0}\n                  title={\n                    isSavedSensor\n                      ? t('hardware.sensor.saveThermometerSavedTitle')\n                      : t('hardware.sensor.saveThermometerTitle')\n                  }\n                  onClick={() => saveScannedSensor(candidate)}\n                >\n                  {isSavedSensor ? t('hardware.sensor.saved') : t('common.add')}\n                </button>\n              </article>"""
new_sensor_card = """              <article\n                key={candidate.runtimeAddress}\n                className=\"device-discovery-card ble-candidate-item\"\n              >\n                <div className=\"device-discovery-card__primary\">\n                  <label className=\"device-discovery-card__name ble-candidate-name\">\n                    <span>{t('hardware.sensor.nameLabel')}</span>\n                    <input\n                      className=\"device-discovery-card__name-input\"\n                      aria-label={`${t('hardware.sensor.nameLabel')}: ${candidate.runtimeAddress}`}\n                      type=\"text\"\n                      value={displayName}\n                      disabled={isSavedSensor}\n                      onChange={(event) =>\n                        setScannedSensorName(candidate, event.currentTarget.value)\n                      }\n                    />\n                  </label>\n                  <button\n                    className=\"primary-action device-discovery-card__action ble-candidate-action\"\n                    type=\"button\"\n                    disabled={isSavedSensor || displayName.trim().length === 0}\n                    title={\n                      isSavedSensor\n                        ? t('hardware.sensor.saveThermometerSavedTitle')\n                        : t('hardware.sensor.saveThermometerTitle')\n                    }\n                    onClick={() => saveScannedSensor(candidate)}\n                  >\n                    {isSavedSensor ? t('hardware.sensor.saved') : t('common.add')}\n                  </button>\n                </div>\n                <div className=\"device-discovery-card__meta ble-candidate-main\">\n                  <strong>{candidate.runtimeAddress}</strong>\n                  <span>{sensorProfileDisplayLabels[candidate.profileId]}</span>\n                </div>\n                <dl className=\"device-discovery-card__metrics ble-candidate-metrics\">\n                  <div>\n                    <dt>RSSI</dt>\n                    <dd>\n                      {formatSensorMetric(\n                        candidate.rssi,\n                        ' dBm',\n                        0,\n                        t('common.missing')\n                      )}\n                    </dd>\n                  </div>\n                  {hasTemperature && (\n                    <div>\n                      <dt>{t('hardware.metrics.temperatureShort')}</dt>\n                      <dd>\n                        {formatSensorMetric(\n                          candidate.temperatureC,\n                          '°C',\n                          1,\n                          t('common.missing')\n                        )}\n                      </dd>\n                    </div>\n                  )}\n                  {hasHumidity && (\n                    <div>\n                      <dt>{t('hardware.metrics.humidityShort')}</dt>\n                      <dd>\n                        {formatSensorMetric(\n                          candidate.humidityPct,\n                          '%',\n                          1,\n                          t('common.missing')\n                        )}\n                      </dd>\n                    </div>\n                  )}\n                </dl>\n              </article>"""
replace_once(sensor, old_sensor_card, new_sensor_card)

# Shared compact discovery-card styling for both plug and thermometer scan results.
theme = 'apps/mobile/src/theme/theme.css'
p = ROOT / theme
text = p.read_text(encoding='utf-8')
shared_css = """

/* Shared scan-result card contract: editable name + compact action, then metadata. */
.device-discovery-card {
  background: var(--lcl-color-surface);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-md);
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: minmax(0, 1fr);
  padding: var(--lcl-spacing-md);
}

.device-discovery-card__primary {
  align-items: end;
  display: grid;
  gap: var(--lcl-spacing-md);
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
}

.device-discovery-card__name {
  display: grid;
  gap: var(--lcl-spacing-xs);
  min-width: 0;
}

.device-discovery-card__name > span {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-semibold);
  line-height: var(--lcl-line-height-normal);
}

.device-discovery-card__name-input {
  background: var(--lcl-color-surface);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text);
  min-height: var(--lcl-size-compact-control-min-height);
  min-width: 0;
  padding: 0 var(--lcl-spacing-md);
  width: 100%;
}

.device-discovery-card__name-input:focus-visible {
  border-color: var(--lcl-color-accent);
  outline: var(--lcl-border-width-md) solid var(--lcl-color-focus-ring);
  outline-offset: var(--lcl-border-width-sm);
}

.device-discovery-card__name-input:disabled {
  background: var(--lcl-color-surface-muted);
  color: var(--lcl-color-text-muted);
}

.device-discovery-card__action {
  align-self: end;
  min-height: var(--lcl-size-compact-control-min-height);
  padding-inline: var(--lcl-spacing-md);
  width: auto;
}

.device-discovery-card__meta {
  color: var(--lcl-color-text-muted);
  display: flex;
  flex-wrap: wrap;
  font-size: var(--lcl-font-size-sm);
  gap: var(--lcl-spacing-xs) var(--lcl-spacing-md);
  line-height: var(--lcl-line-height-normal);
  min-width: 0;
  overflow-wrap: anywhere;
}

.device-discovery-card__metrics {
  margin: 0;
}

.device-discovery-card.ble-candidate-item {
  grid-template-columns: minmax(0, 1fr);
}

.device-discovery-card .ble-candidate-main {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lcl-spacing-xs) var(--lcl-spacing-md);
}

.device-discovery-card .ble-candidate-main strong,
.device-discovery-card .ble-candidate-main span {
  font-size: var(--lcl-font-size-sm);
  line-height: var(--lcl-line-height-normal);
}

@media (max-width: 30rem) {
  .device-discovery-card {
    padding: var(--lcl-spacing-sm) var(--lcl-spacing-md);
  }

  .device-discovery-card__primary {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .device-discovery-card__action,
  .ble-candidate-action,
  .shelly-scan-result__add {
    justify-self: end;
    width: auto;
  }
}
"""
if '/* Shared scan-result card contract:' in text:
    raise SystemExit('shared discovery-card CSS already present')
p.write_text(text.rstrip() + shared_css + '\n', encoding='utf-8')

# Tests: replace obsolete scanner-help/preset expectations and assert the shared card contract.
tests = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
replace_once(
    tests,
    """    const scannedRow = scannedName.closest(\n      '.shelly-scan-result__row'\n    ) as HTMLElement | null;\n    expect(scannedRow).not.toBeNull();\n    expect(within(scannedRow!).getAllByRole('textbox')).toHaveLength(1);\n    expect(within(scannedRow!).getByText('http://192.168.0.20/')).toBeVisible();\n    expect(within(scannedRow!).getByText('S3PL-00112EU, gen 3')).toBeVisible();""",
    """    const scannedRow = scannedName.closest('.device-discovery-card') as HTMLElement | null;\n    expect(scannedRow).not.toBeNull();\n    expect(scannedRow).toHaveClass('shelly-scan-result');\n    expect(scannedName).toHaveClass('device-discovery-card__name-input');\n    expect(within(scannedRow!).getAllByRole('textbox')).toHaveLength(1);\n    expect(within(scannedRow!).getByText('http://192.168.0.20/')).toBeVisible();\n    expect(within(scannedRow!).getByText('S3PL-00112EU, gen 3')).toBeVisible();\n    expect(\n      within(scannedRow!).getByRole('button', { name: 'Dodaj: http://192.168.0.20/' })\n    ).toHaveClass('device-discovery-card__action');""",
)
start = "  it('shows Shelly scan help in the shared info popover', async () => {"
end = "  it('uses the discovered model as the default scanner name without populating the manual form', async () => {"
replacement = """  it('keeps the Shelly scan page minimal without presets or help chrome', async () => {\n    renderHardwareSetup();\n\n    const page = await openShellyAddDialog('scan');\n    expect(within(page).getByLabelText('Od')).toHaveValue('192.168.0.1');\n    expect(within(page).getByLabelText('Do')).toHaveValue('192.168.0.254');\n    expect(within(page).queryByRole('button', { name: 'STA' })).toBeNull();\n    expect(within(page).queryByRole('button', { name: 'AP' })).toBeNull();\n    expect(\n      within(page).queryByRole('button', { name: 'Informacja o skanowaniu Shelly' })\n    ).toBeNull();\n    expect(within(page).queryByText(/Zakres:/)).toBeNull();\n    expect(\n      within(page).getByRole('button', { name: 'Rozpocznij skan' })\n    ).toHaveClass('secondary-action');\n\n    const manualTab = within(page).getByRole('tab', { name: 'Dodaj ręcznie' });\n    fireEvent.click(manualTab);\n    expect(\n      within(page).getByRole('tabpanel', { name: 'Dodaj ręcznie' })\n    ).toBeInTheDocument();\n    fireEvent.click(within(page).getByRole('tab', { name: 'Skanuj sieć' }));\n    expect(\n      within(page).getByRole('tabpanel', { name: 'Skanuj sieć' })\n    ).toBeInTheDocument();\n  });\n\n  it('uses the discovered model as the default scanner name without populating the manual form', async () => {"""
replace_span(tests, start, end, replacement)
replace_once(
    tests,
    """    expect(within(xiaomiItem!).getByRole('button', { name: 'Dodaj' })).toHaveAttribute(\n      'title',\n      'Zapisz ten termometr w aplikacji'\n    );\n    expect(\n      within(xiaomiItem!).getByRole('textbox', {\n        name: 'Nazwa termometru: A4:C1:38:4F:24:CD'\n      })\n    ).toHaveValue('Termometr 24:CD');""",
    """    expect(xiaomiItem).toHaveClass('device-discovery-card');\n    const xiaomiAddButton = within(xiaomiItem!).getByRole('button', { name: 'Dodaj' });\n    expect(xiaomiAddButton).toHaveAttribute(\n      'title',\n      'Zapisz ten termometr w aplikacji'\n    );\n    expect(xiaomiAddButton).toHaveClass('device-discovery-card__action');\n    const xiaomiNameInput = within(xiaomiItem!).getByRole('textbox', {\n      name: 'Nazwa termometru: A4:C1:38:4F:24:CD'\n    });\n    expect(xiaomiNameInput).toHaveValue('Termometr 24:CD');\n    expect(xiaomiNameInput).toHaveClass('device-discovery-card__name-input');""",
)

print('Unified Shelly and thermometer discovery-card UX')

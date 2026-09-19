from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected snippet not found in {path}: {old[:120]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"Expected snippet exactly once in {path}, found {text.count(old)}")
    p.write_text(text.replace(old, new, 1))


shelly = "apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx"
sensor = "apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx"
theme = "apps/mobile/src/theme/theme.css"
tests = "apps/mobile/src/__tests__/hardware-setup.test.tsx"

# Shelly: promote the URL to the same primary identity semantics as BLE.
replace_once(
    shelly,
    '''                          <div className="device-discovery-card__meta shelly-scan-result__meta">\n                            <span>{result.baseUrl}</span>\n                            <span>\n                              {result.deviceInfo.model}, gen {result.deviceInfo.gen}\n                            </span>\n                          </div>''',
    '''                          <div className="device-discovery-card__meta shelly-scan-result__meta">\n                            <strong className="device-discovery-card__identity">\n                              {result.baseUrl}\n                            </strong>\n                            <span>\n                              {result.deviceInfo.model}, gen {result.deviceInfo.gen}\n                            </span>\n                          </div>'''
)

# Shelly: active scan state lives inside the control itself.
replace_once(
    shelly,
    '''                    <button\n                      className="secondary-action"\n                      type="button"\n                      title={\n                        isShellyScanActive\n                          ? t('hardware.shelly.scanStopTitle')\n                          : t('hardware.shelly.scanStartTitle')\n                      }\n                      onClick={isShellyScanActive ? stopShellyScan : startShellyScan}\n                    >\n                      {isShellyScanActive\n                        ? t('hardware.shelly.scanStop')\n                        : t('hardware.shelly.scanStart')}\n                    </button>''',
    '''                    <button\n                      className="secondary-action device-scan-action"\n                      type="button"\n                      aria-busy={isShellyScanActive || undefined}\n                      title={\n                        isShellyScanActive\n                          ? t('hardware.shelly.scanStopTitle')\n                          : t('hardware.shelly.scanStartTitle')\n                      }\n                      onClick={isShellyScanActive ? stopShellyScan : startShellyScan}\n                    >\n                      {isShellyScanActive && (\n                        <span className="device-scan-action__spinner" aria-hidden="true" />\n                      )}\n                      <span>\n                        {isShellyScanActive\n                          ? t('hardware.shelly.scanStop')\n                          : t('hardware.shelly.scanStart')}\n                      </span>\n                    </button>'''
)

# BLE: same primary identity class and same active-scan control semantics.
replace_once(
    sensor,
    '''                <div className="device-discovery-card__meta ble-candidate-main">\n                  <strong>{candidate.runtimeAddress}</strong>\n                  <span>{sensorProfileDisplayLabels[candidate.profileId]}</span>\n                </div>''',
    '''                <div className="device-discovery-card__meta ble-candidate-main">\n                  <strong className="device-discovery-card__identity">\n                    {candidate.runtimeAddress}\n                  </strong>\n                  <span>{sensorProfileDisplayLabels[candidate.profileId]}</span>\n                </div>'''
)
replace_once(
    sensor,
    '''        <button\n          className="secondary-action"\n          type="button"\n          title={\n            isPhoneBleScanPending\n              ? t('hardware.sensor.scanStopTitle')\n              : t('hardware.sensor.scanAgainTitle')\n          }\n          onClick={isPhoneBleScanPending ? flow.stopPhoneBleScan : startPhoneBleScan}\n        >\n          {isPhoneBleScanPending\n            ? t('hardware.shelly.scanStop')\n            : t('hardware.shelly.scanBleAgain')}\n        </button>''',
    '''        <button\n          className="secondary-action device-scan-action"\n          type="button"\n          aria-busy={isPhoneBleScanPending || undefined}\n          title={\n            isPhoneBleScanPending\n              ? t('hardware.sensor.scanStopTitle')\n              : t('hardware.sensor.scanAgainTitle')\n          }\n          onClick={isPhoneBleScanPending ? flow.stopPhoneBleScan : startPhoneBleScan}\n        >\n          {isPhoneBleScanPending && (\n            <span className="device-scan-action__spinner" aria-hidden="true" />\n          )}\n          <span>\n            {isPhoneBleScanPending\n              ? t('hardware.shelly.scanStop')\n              : t('hardware.shelly.scanBleAgain')}\n          </span>\n        </button>'''
)

# Remove stale Shelly discovery layout that predates device-discovery-card and is still widening Add.
replace_once(
    theme,
    '''.shelly-scan-result__row {\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(8rem, 1fr) auto;\n}\n\n.shelly-scan-result__name-input {\n  min-width: 0;\n  width: 100%;\n}\n\n.shelly-scan-result__add {\n  align-self: end;\n  min-width: var(--lcl-size-action-min-width);\n}\n\n''',
    ''
)
replace_once(
    theme,
    '''  .shelly-scan-result__row {\n    grid-template-columns: minmax(0, 1fr);\n  }\n\n  .shelly-scan-result__add {\n    width: 100%;\n  }\n\n''',
    ''
)
replace_once(
    theme,
    '''.shelly-scan-result__add,\n.ble-candidate-action {\n  align-self: center;\n  min-height: var(--lcl-size-compact-control-min-height);\n  padding-inline: var(--lcl-spacing-md);\n  width: auto;\n}\n\n.ble-candidate-item {\n  align-items: center;\n  grid-template-columns: minmax(0, 1fr) auto;\n}\n\n.ble-candidate-content,\n.ble-candidate-name {\n  display: grid;\n  gap: var(--lcl-spacing-sm);\n  min-width: 0;\n}\n\n.ble-candidate-name {\n  gap: var(--lcl-spacing-xs);\n}\n\n.ble-candidate-name input,\n.shelly-scan-result__name-input {\n  min-width: 0;\n  width: 100%;\n}\n\n@media (max-width: 30rem) {\n  .ble-candidate-item,\n  .shelly-scan-result__row {\n    grid-template-columns: minmax(0, 1fr);\n  }\n\n  .ble-candidate-action,\n  .shelly-scan-result__add {\n    justify-self: end;\n    width: auto;\n  }\n}\n\n''',
    ''
)

# Shared discovery contract: short equal Add buttons, primary identity, compact in-button scan activity.
replace_once(
    theme,
    '''.device-discovery-card__action {\n  align-self: end;\n  min-height: var(--lcl-size-compact-control-min-height);\n  padding-inline: var(--lcl-spacing-md);\n  width: auto;\n}\n\n.device-discovery-card__meta {''',
    '''.device-discovery-card__action {\n  align-self: end;\n  min-height: var(--lcl-size-compact-control-min-height);\n  min-width: 0;\n  padding-inline: var(--lcl-spacing-md);\n  width: auto;\n}\n\n.device-discovery-card__meta {'''
)
replace_once(
    theme,
    '''.device-discovery-card__metrics {\n  margin: 0;\n}\n\n.device-discovery-card.ble-candidate-item {''',
    '''.device-discovery-card__identity {\n  color: var(--lcl-color-text);\n  font-weight: var(--lcl-font-weight-bold);\n}\n\n.device-discovery-card__metrics {\n  margin: 0;\n}\n\n.device-scan-action {\n  gap: var(--lcl-spacing-sm);\n}\n\n.device-scan-action__spinner {\n  animation: lcl-scan-spin 0.85s linear infinite;\n  border: var(--lcl-border-width-md) solid var(--lcl-color-border);\n  border-radius: 50%;\n  border-top-color: var(--lcl-color-accent);\n  flex: 0 0 auto;\n  height: 1rem;\n  width: 1rem;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .device-scan-action__spinner {\n    animation: none;\n  }\n}\n\n.device-discovery-card.ble-candidate-item {'''
)
replace_once(
    theme,
    '''  .device-discovery-card__action,\n  .ble-candidate-action,\n  .shelly-scan-result__add {\n    justify-self: end;\n    width: auto;\n  }''',
    '''  .device-discovery-card__action {\n    justify-self: end;\n    width: auto;\n  }'''
)

# Tests: shared card semantics, equal action contract, identity hierarchy, and busy spinner state.
replace_once(
    tests,
    '''    const scannedRow = scannedName.closest(\n      '.shelly-scan-result__row'\n    ) as HTMLElement | null;\n    expect(scannedRow).not.toBeNull();\n    expect(within(scannedRow!).getAllByRole('textbox')).toHaveLength(1);\n    expect(within(scannedRow!).getByText('http://192.168.0.20/')).toBeVisible();\n    expect(within(scannedRow!).getByText('S3PL-00112EU, gen 3')).toBeVisible();\n    fireEvent.change(scannedName, { target: { value: 'Salon' } });\n\n    fireEvent.click(\n      within(page).getByRole('button', { name: 'Dodaj: http://192.168.0.20/' })\n    );''',
    '''    const scannedCard = scannedName.closest('.device-discovery-card') as HTMLElement | null;\n    expect(scannedCard).not.toBeNull();\n    expect(within(scannedCard!).getAllByRole('textbox')).toHaveLength(1);\n    expect(\n      within(scannedCard!).getByText('http://192.168.0.20/')\n    ).toHaveClass('device-discovery-card__identity');\n    expect(within(scannedCard!).getByText('S3PL-00112EU, gen 3')).toBeVisible();\n    const shellyAddButton = within(page).getByRole('button', {\n      name: 'Dodaj: http://192.168.0.20/'\n    });\n    expect(shellyAddButton).toHaveClass('device-discovery-card__action');\n    fireEvent.change(scannedName, { target: { value: 'Salon' } });\n\n    fireEvent.click(shellyAddButton);'''
)
replace_once(
    tests,
    '''    fireEvent.click(within(page).getByRole('button', { name: 'Rozpocznij skan' }));\n\n    expect(await within(page).findByText('http://192.168.0.20/')).toBeInTheDocument();''',
    '''    fireEvent.click(within(page).getByRole('button', { name: 'Rozpocznij skan' }));\n    const shellyStopScan = within(page).getByRole('button', { name: 'Zatrzymaj skan' });\n    expect(shellyStopScan).toHaveAttribute('aria-busy', 'true');\n    expect(shellyStopScan.querySelector('.device-scan-action__spinner')).not.toBeNull();\n\n    expect(await within(page).findByText('http://192.168.0.20/')).toBeInTheDocument();'''
)
replace_once(
    tests,
    '''    expect(\n      within(xiaomiItem!).getByRole('button', { name: 'Dodaj' })\n    ).toHaveAttribute('title', 'Zapisz ten termometr w aplikacji');\n    expect(\n      within(xiaomiItem!).getByRole('textbox', {\n        name: 'Nazwa termometru: A4:C1:38:4F:24:CD'\n      })\n    ).toHaveValue('Termometr 24:CD');\n    expect(within(xiaomiItem!).getByText('BTHome v2')).toBeInTheDocument();''',
    '''    const sensorAddButton = within(xiaomiItem!).getByRole('button', { name: 'Dodaj' });\n    expect(sensorAddButton).toHaveAttribute(\n      'title',\n      'Zapisz ten termometr w aplikacji'\n    );\n    expect(sensorAddButton).toHaveClass('device-discovery-card__action');\n    expect(\n      within(xiaomiItem!).getByRole('textbox', {\n        name: 'Nazwa termometru: A4:C1:38:4F:24:CD'\n      })\n    ).toHaveValue('Termometr 24:CD');\n    expect(\n      within(xiaomiItem!).getByText('A4:C1:38:4F:24:CD')\n    ).toHaveClass('device-discovery-card__identity');\n    expect(within(xiaomiItem!).getByText('BTHome v2')).toBeInTheDocument();'''
)
replace_once(
    tests,
    '''    expect(within(xiaomiItem!).getByText('-58 dBm')).toBeInTheDocument();\n\n    await waitFor(() => expect(within(page).getAllByRole('article')).toHaveLength(2));''',
    '''    expect(within(xiaomiItem!).getByText('-58 dBm')).toBeInTheDocument();\n    const bleStopScan = within(page).getByRole('button', { name: 'Zatrzymaj skan' });\n    expect(bleStopScan).toHaveAttribute('aria-busy', 'true');\n    expect(bleStopScan.querySelector('.device-scan-action__spinner')).not.toBeNull();\n\n    await waitFor(() => expect(within(page).getAllByRole('article')).toHaveLength(2));'''
)

print("Applied final discovery-card polish")

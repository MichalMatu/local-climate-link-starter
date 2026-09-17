from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}")
    file.write_text(text.replace(old, new, 1))


def replace_test(path: str, name: str, replacement: str) -> None:
    file = Path(path)
    text = file.read_text()
    start_marker = f"  it('{name}'"
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"{path}: missing test {name!r}")
    end = text.find("\n  it(", start + len(start_marker))
    if end < 0:
        raise SystemExit(f"{path}: could not find end of test {name!r}")
    file.write_text(text[:start] + replacement.rstrip() + "\n" + text[end:])


# Reuse the existing checked-add mutation for both manual and scanner-originated adds.
replace_once(
    "apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts",
    "type ShellyCheckMutationResult = HardwareSetupStatus & {\n  checkedDevice: ShellyDraftDevice;\n};",
    "type ShellyCheckMutationInput = {\n  baseUrl: string;\n  name: string;\n};\n\ntype ShellyCheckMutationResult = HardwareSetupStatus & {\n  checkedDevice: ShellyDraftDevice;\n};",
)

replace_once(
    "apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts",
    """  const checkShellyMutation = useMutation({\n    mutationFn: async (): Promise<ShellyCheckMutationResult> => {\n      if (!shellyInputState.ok) {\n        throw new Error(\n          shellyInputState.fieldErrors.url ??\n            shellyInputState.fieldErrors.name ??\n            t('hardware.flow.fixShellyData')\n        );\n      }\n      const { baseUrl, name } = shellyInputState;\n""",
    """  const checkShellyMutation = useMutation({\n    mutationFn: async (\n      input?: ShellyCheckMutationInput\n    ): Promise<ShellyCheckMutationResult> => {\n      const inputState = input\n        ? deriveShellyInputState({\n            shellyNameInput: input.name,\n            shellyUrlInput: input.baseUrl\n          })\n        : shellyInputState;\n      if (!inputState.ok) {\n        throw new Error(\n          inputState.fieldErrors.url ??\n            inputState.fieldErrors.name ??\n            t('hardware.flow.fixShellyData')\n        );\n      }\n      const { baseUrl, name } = inputState;\n""",
)

# Scanner results own their display-name draft instead of filling the manual form.
replace_once(
    "apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx",
    """  const [didSubmitShellyScan, setDidSubmitShellyScan] = useState(false);\n  const [activeAddSection, setActiveAddSection] = useState<'manual' | 'scan' | null>(\n    'manual'\n  );\n""",
    """  const [didSubmitShellyScan, setDidSubmitShellyScan] = useState(false);\n  const [scanResultNames, setScanResultNames] = useState<Record<string, string>>({});\n  const [activeAddSection, setActiveAddSection] = useState<'manual' | 'scan' | null>(\n    'manual'\n  );\n""",
)

replace_once(
    "apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx",
    """    setDidSubmitShellyAdd(false);\n    setDidSubmitShellyScan(false);\n    setActiveAddSection('manual');\n""",
    """    setDidSubmitShellyAdd(false);\n    setDidSubmitShellyScan(false);\n    setScanResultNames({});\n    setActiveAddSection('manual');\n""",
)

replace_once(
    "apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx",
    """  const applyShellyScanPreset = (start: string, end: string) => {\n    flow.resetShellyScan();\n    setDidSubmitShellyScan(false);\n    flow.setShellyScanStartInput(start);\n""",
    """  const applyShellyScanPreset = (start: string, end: string) => {\n    flow.resetShellyScan();\n    setDidSubmitShellyScan(false);\n    setScanResultNames({});\n    flow.setShellyScanStartInput(start);\n""",
)

replace_once(
    "apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx",
    """  const startShellyScan = () => {\n    setDidSubmitShellyScan(true);\n    if (shellyScanRangeError) {\n      return;\n    }\n    flow.startShellyScan();\n  };\n""",
    """  const startShellyScan = () => {\n    setDidSubmitShellyScan(true);\n    if (shellyScanRangeError) {\n      return;\n    }\n    setScanResultNames({});\n    flow.startShellyScan();\n  };\n""",
)

replace_once(
    "apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx",
    """  const selectScannedShellyDevice = (result: ShellySetupScanResult) => {\n    if (!flow.shellyNameInput.trim()) {\n      flow.setShellyNameInput(result.deviceInfo.model);\n    }\n    flow.setShellyUrlInput(result.baseUrl);\n    flow.resetShellyScan();\n    setDidSubmitShellyScan(false);\n  };\n\n""",
    """  const scannedShellyName = (result: ShellySetupScanResult) =>\n    scanResultNames[result.baseUrl] ?? result.deviceInfo.model;\n\n  const setScannedShellyName = (result: ShellySetupScanResult, value: string) => {\n    setScanResultNames((current) => ({ ...current, [result.baseUrl]: value }));\n  };\n\n  const isAddingScannedShelly = (result: ShellySetupScanResult) =>\n    flow.checkShellyMutation.isPending &&\n    flow.checkShellyMutation.variables != null &&\n    normalizeScanBaseUrl(flow.checkShellyMutation.variables.baseUrl) ===\n      normalizeScanBaseUrl(result.baseUrl);\n\n  const addScannedShellyDevice = (result: ShellySetupScanResult) => {\n    const name = scannedShellyName(result).trim();\n    if (!name) {\n      return;\n    }\n    flow.recheckShellyMutation.reset();\n    flow.checkShellyMutation.reset();\n    flow.checkShellyMutation.mutate(\n      { baseUrl: result.baseUrl, name },\n      {\n        onSuccess: () => {\n          pushToast('ok', t('hardware.shelly.added'));\n          if (addOnly) {\n            flow.stopShellyScan();\n            setDialog({ kind: 'none' });\n            onAddComplete?.();\n          }\n        },\n        onError: () => {\n          pushToast(\n            'warning',\n            t('hardware.shelly.checkFailedTitle'),\n            t('hardware.shelly.checkFailedDetail')\n          );\n        }\n      }\n    );\n  };\n\n""",
)

replace_once(
    "apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx",
    """                      <div className=\"saved-list__field\">\n                        <span>{t('common.model')}</span>\n                        <strong>\n                          {result.deviceInfo.model}, gen {result.deviceInfo.gen}\n                        </strong>\n                      </div>\n                      <button\n                        aria-label={\n                          isSavedShellyScanResult(result)\n                            ? `${t('hardware.shelly.alreadyAdded')}: ${result.baseUrl}`\n                            : `${t('common.select')}: ${result.baseUrl}`\n                        }\n                        className=\"secondary-action shelly-scan-result__add\"\n                        type=\"button\"\n                        disabled={isSavedShellyScanResult(result)}\n                        onClick={() => selectScannedShellyDevice(result)}\n                      >\n                        {isSavedShellyScanResult(result)\n                          ? t('hardware.shelly.alreadyAdded')\n                          : t('common.select')}\n                      </button>\n""",
    """                      <div className=\"saved-list__field\">\n                        <span>{t('common.model')}</span>\n                        <strong>\n                          {result.deviceInfo.model}, gen {result.deviceInfo.gen}\n                        </strong>\n                      </div>\n                      <label className=\"saved-list__field shelly-scan-result__name\">\n                        <span>{t('hardware.shelly.deviceNameLabel')}</span>\n                        <input\n                          className=\"shelly-scan-result__name-input\"\n                          aria-label={`${t('hardware.shelly.deviceNameLabel')}: ${result.baseUrl}`}\n                          type=\"text\"\n                          value={scannedShellyName(result)}\n                          disabled={isSavedShellyScanResult(result)}\n                          onChange={(event) =>\n                            setScannedShellyName(result, event.currentTarget.value)\n                          }\n                        />\n                      </label>\n                      <button\n                        aria-label={\n                          isSavedShellyScanResult(result)\n                            ? `${t('hardware.shelly.alreadyAdded')}: ${result.baseUrl}`\n                            : `${t('common.add')}: ${result.baseUrl}`\n                        }\n                        aria-busy={isAddingScannedShelly(result) || undefined}\n                        className=\"primary-action shelly-scan-result__add\"\n                        type=\"button\"\n                        disabled={\n                          isSavedShellyScanResult(result) ||\n                          flow.checkShellyMutation.isPending ||\n                          scannedShellyName(result).trim().length === 0\n                        }\n                        onClick={() => addScannedShellyDevice(result)}\n                      >\n                        {isSavedShellyScanResult(result)\n                          ? t('hardware.shelly.alreadyAdded')\n                          : isAddingScannedShelly(result)\n                            ? t('hardware.shelly.checking')\n                            : t('common.add')}\n                      </button>\n""",
)

# Four-column desktop row: address, model, editable name, direct Add.
replace_once(
    "apps/mobile/src/theme/theme.css",
    """.shelly-scan-result__row {\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;\n}\n\n.shelly-scan-result__add {\n""",
    """.shelly-scan-result__row {\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(8rem, 1fr) auto;\n}\n\n.shelly-scan-result__name-input {\n  min-width: 0;\n  width: 100%;\n}\n\n.shelly-scan-result__add {\n""",
)

# Rewrite the integration tests so they protect direct scanner ownership rather than the legacy form bridge.
replace_test(
    "apps/mobile/src/__tests__/hardware-setup.test.tsx",
    "scans the local network inside the add task and fills the form before adding",
    """  it('adds a scanned Shelly directly with an editable per-result name', async () => {\n    renderHardwareSetup();\n\n    const dialog = await openShellyAddDialog();\n    expect(within(dialog).getByLabelText('Od')).toHaveValue('192.168.0.1');\n    expect(within(dialog).getByLabelText('Do')).toHaveValue('192.168.0.254');\n\n    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));\n\n    expect(await within(dialog).findByText('http://192.168.0.20/')).toBeInTheDocument();\n    expect(within(dialog).getByText('S3PL-00112EU, gen 3')).toBeInTheDocument();\n    const scannedName = within(dialog).getByRole('textbox', {\n      name: 'Nazwa gniazdka: http://192.168.0.20/'\n    });\n    expect(scannedName).toHaveValue('S3PL-00112EU');\n    fireEvent.change(scannedName, { target: { value: 'Salon' } });\n\n    fireEvent.click(\n      within(dialog).getByRole('button', { name: 'Dodaj: http://192.168.0.20/' })\n    );\n\n    expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();\n    expect(screen.getByRole('dialog', { name: 'Dodaj gniazdko' })).toBe(dialog);\n    expect(within(dialog).getByText('http://192.168.0.20/')).toBeInTheDocument();\n    expect(\n      within(dialog).getByRole('button', { name: 'Dodane: http://192.168.0.20/' })\n    ).toBeDisabled();\n    expect(within(dialog).getByLabelText('Adres IP Shelly')).not.toHaveValue(\n      'http://192.168.0.20/'\n    );\n    const savedPlugList = screen.getByLabelText('Dodane gniazdka');\n    expect(within(savedPlugList).getByText('Salon')).toBeInTheDocument();\n  });\n""",
)

replace_test(
    "apps/mobile/src/__tests__/hardware-setup.test.tsx",
    "uses the scan result action to populate the add form before final add",
    """  it('uses the discovered model as the default scanner name without populating the manual form', async () => {\n    renderHardwareSetup();\n\n    const dialog = await openShellyAddDialog();\n    const manualName = within(dialog).getByLabelText('Nazwa gniazdka');\n    const manualAddress = within(dialog).getByLabelText('Adres IP Shelly');\n    const initialManualName = (manualName as HTMLInputElement).value;\n    const initialManualAddress = (manualAddress as HTMLInputElement).value;\n\n    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));\n    await within(dialog).findByText('http://192.168.0.20/');\n\n    expect(\n      within(dialog).getByRole('textbox', {\n        name: 'Nazwa gniazdka: http://192.168.0.20/'\n      })\n    ).toHaveValue('S3PL-00112EU');\n    fireEvent.click(\n      within(dialog).getByRole('button', { name: 'Dodaj: http://192.168.0.20/' })\n    );\n\n    expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();\n    expect(within(dialog).getByLabelText('Nazwa gniazdka')).toHaveValue(initialManualName);\n    expect(within(dialog).getByLabelText('Adres IP Shelly')).toHaveValue(\n      initialManualAddress\n    );\n    const savedPlugList = screen.getByLabelText('Dodane gniazdka');\n    expect(within(savedPlugList).getByText('S3PL-00112EU')).toBeInTheDocument();\n  });\n""",
)

# Only the available-result action label changes in the existing full-range regression test.
replace_once(
    "apps/mobile/src/__tests__/hardware-setup.test.tsx",
    """    expect(\n      within(dialog).getByRole('button', { name: 'Wybierz: http://192.168.0.21/' })\n    ).toBeEnabled();\n""",
    """    expect(\n      within(dialog).getByRole('button', { name: 'Dodaj: http://192.168.0.21/' })\n    ).toBeEnabled();\n""",
)

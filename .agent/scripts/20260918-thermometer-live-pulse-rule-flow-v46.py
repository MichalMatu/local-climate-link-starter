from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {count}: {old[:80]!r}")
    file_path.write_text(text.replace(old, new, 1))


# A: make the saved-sensor live scan self-healing while the thermometer page is active.
feedback = "apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts"
replace_once(
    feedback,
    "type PushToast = (tone: ToastTone, title: string, detail?: string) => void;\n",
    "type PushToast = (tone: ToastTone, title: string, detail?: string) => void;\n\n"
    "const SAVED_SENSOR_LIVE_SCAN_RETRY_MS = 1000;\n",
)
replace_once(
    feedback,
    "  useEffect(() => {\n"
    "    let resumeTimer: ReturnType<typeof setTimeout> | null = null;\n",
    "  useEffect(() => {\n"
    "    if (shouldRunSavedSensorLiveScan && !flow.savedSensorLiveScanState.running) {\n"
    "      const retryTimer = setTimeout(() => {\n"
    "        flow.startSavedSensorLiveScan();\n"
    "      }, SAVED_SENSOR_LIVE_SCAN_RETRY_MS);\n\n"
    "      return () => clearTimeout(retryTimer);\n"
    "    }\n\n"
    "    return undefined;\n"
    "  }, [\n"
    "    flow.savedSensorLiveScanState.running,\n"
    "    flow.startSavedSensorLiveScan,\n"
    "    shouldRunSavedSensorLiveScan\n"
    "  ]);\n\n"
    "  useEffect(() => {\n"
    "    let resumeTimer: ReturnType<typeof setTimeout> | null = null;\n",
)

# B: retrigger the pulse for every newer sample, even if packets arrive during the prior pulse.
presentation = "apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.tsx"
replace_once(
    presentation,
    "  const [isSamplePulseActive, setIsSamplePulseActive] = useState(false);\n",
    "  const [isSamplePulseActive, setIsSamplePulseActive] = useState(false);\n"
    "  const [samplePulseSequence, setSamplePulseSequence] = useState(0);\n",
)
replace_once(
    presentation,
    "    previousSeenAtMsRef.current = latestSeenAtMs;\n"
    "    setIsSamplePulseActive(true);\n",
    "    previousSeenAtMsRef.current = latestSeenAtMs;\n"
    "    setSamplePulseSequence((current) => current + 1);\n"
    "    setIsSamplePulseActive(true);\n",
)
replace_once(
    presentation,
    "          <IconTemperature className=\"sensor-card-leading-icon__icon\" />\n",
    "          <IconTemperature\n"
    "            key={samplePulseSequence}\n"
    "            className=\"sensor-card-leading-icon__icon\"\n"
    "          />\n",
)

# B visual: keep the badge background fixed; pulse only the thermometer glyph color.
theme = Path("apps/mobile/src/theme/theme.css")
css = theme.read_text()
old_selector = ".sensor-card-leading-icon--fresh {\n  animation: sensor-card-reading-pulse 650ms ease-out;\n}"
if css.count(old_selector) != 1:
    raise SystemExit(f"theme.css: expected one fresh selector, got {css.count(old_selector)}")
css = css.replace(
    old_selector,
    ".sensor-card-leading-icon--fresh .sensor-card-leading-icon__icon {\n"
    "  animation: sensor-card-reading-pulse 650ms ease-out;\n"
    "}",
    1,
)
css, keyframe_count = re.subn(
    r"@keyframes sensor-card-reading-pulse \{.*?\n\}",
    "@keyframes sensor-card-reading-pulse {\n"
    "  0%,\n"
    "  100% {\n"
    "    color: var(--lcl-color-text-muted);\n"
    "  }\n"
    "  45% {\n"
    "    color: var(--lcl-color-accent);\n"
    "  }\n"
    "}",
    css,
    count=1,
    flags=re.S,
)
if keyframe_count != 1:
    raise SystemExit(f"theme.css: expected one pulse keyframe, got {keyframe_count}")
old_reduced = (
    ".sensor-card-leading-icon--fresh {\n"
    "    animation: none;\n"
    "    color: var(--lcl-color-accent);\n"
    "  }"
)
if css.count(old_reduced) != 1:
    raise SystemExit(f"theme.css: expected one reduced-motion pulse rule, got {css.count(old_reduced)}")
css = css.replace(
    old_reduced,
    ".sensor-card-leading-icon--fresh .sensor-card-leading-icon__icon {\n"
    "    animation: none;\n"
    "    color: var(--lcl-color-accent);\n"
    "  }",
    1,
)
theme.write_text(css)

# C: a climate automation started from a concrete plug already has its Shelly context.
# Go directly to Rule and hide the redundant one-item setup navigation.
hardware_screen = "apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx"
replace_once(
    hardware_screen,
    "  return fixedShellyId\n"
    "    ? CLIMATE_HARDWARE_TABS.filter((tab) => tab.id !== 'shelly')\n"
    "    : CLIMATE_HARDWARE_TABS;\n",
    "  return fixedShellyId\n"
    "    ? CLIMATE_HARDWARE_TABS.filter((tab) => tab.id === 'rule')\n"
    "    : CLIMATE_HARDWARE_TABS;\n",
)
replace_once(
    hardware_screen,
    "      {!plugAddOnly && (\n"
    "        <nav className=\"setup-top-nav\" aria-label={t('hardware.nav.label')}>\n",
    "      {!plugAddOnly && availableTabs.length > 1 && (\n"
    "        <nav className=\"setup-top-nav\" aria-label={t('hardware.nav.label')}>\n",
)

# Regression coverage for A and C in the existing hardware integration test.
test_path = "apps/mobile/src/__tests__/hardware-setup.test.tsx"
replace_once(
    test_path,
    "  startCount: 0,\n  stopCount: 0\n",
    "  startCount: 0,\n  stopCount: 0,\n  endContinuousScanCount: 0\n",
)
replace_once(
    test_path,
    "      while (options?.timeoutMs === 0 && !this.stopped) {\n"
    "        await new Promise((resolve) => setTimeout(resolve, 10));\n"
    "      }\n",
    "      if (\n"
    "        options?.timeoutMs === 0 &&\n"
    "        phoneBleScannerMock.endContinuousScanCount > 0\n"
    "      ) {\n"
    "        phoneBleScannerMock.endContinuousScanCount -= 1;\n"
    "        return;\n"
    "      }\n\n"
    "      while (options?.timeoutMs === 0 && !this.stopped) {\n"
    "        await new Promise((resolve) => setTimeout(resolve, 10));\n"
    "      }\n",
)
replace_once(
    test_path,
    "const renderHardwareSetup = () => {\n",
    "const renderHardwareSetup = (\n"
    "  props: Parameters<typeof HardwareSetupScreen>[0] = {}\n"
    ") => {\n",
)
replace_once(
    test_path,
    "        <HardwareSetupScreen />\n",
    "        <HardwareSetupScreen {...props} />\n",
)
replace_once(
    test_path,
    "    phoneBleScannerMock.startCount = 0;\n"
    "    phoneBleScannerMock.stopCount = 0;\n",
    "    phoneBleScannerMock.startCount = 0;\n"
    "    phoneBleScannerMock.stopCount = 0;\n"
    "    phoneBleScannerMock.endContinuousScanCount = 0;\n",
)
replace_once(
    test_path,
    "  it('does not duplicate app settings inside developer diagnostics', () => {\n",
    "  it('opens fixed climate setup directly on the rule editor', () => {\n"
    "    const shellyId = 'http://192.168.0.30/';\n"
    "    useHardwareSetupDraftStore.getState().upsertShellyDevice({\n"
    "      id: shellyId,\n"
    "      name: 'Grzejnik',\n"
    "      baseUrl: shellyId,\n"
    "      scriptIdInput: '1'\n"
    "    });\n\n"
    "    renderHardwareSetup({ setupIntent: 'temperature', fixedShellyId: shellyId });\n\n"
    "    expect(screen.queryByRole('button', { name: 'Termometry' })).not.toBeInTheDocument();\n"
    "    expect(screen.queryByRole('button', { name: 'Reguła' })).not.toBeInTheDocument();\n"
    "    expect(screen.getByRole('combobox', { name: 'Termometr' })).toBeInTheDocument();\n"
    "    expect(screen.getByRole('combobox', { name: 'Tryb reguły' })).toBeInTheDocument();\n"
    "  });\n\n"
    "  it('does not duplicate app settings inside developer diagnostics', () => {\n",
)
replace_once(
    test_path,
    "  it('shows phone BLE scan startup errors as toast feedback', async () => {\n",
    "  it('restarts saved thermometer live scan after an unexpected scanner end', async () => {\n"
    "    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');\n"
    "    useHardwareSetupDraftStore.setState({\n"
    "      ...DEFAULT_HARDWARE_SETUP_DRAFT,\n"
    "      sensorDevices: [\n"
    "        {\n"
    "          id: 'A4:C1:38:4F:24:CD',\n"
    "          name: 'Xiaomi salon',\n"
    "          runtimeAddress: 'A4:C1:38:4F:24:CD',\n"
    "          profileId: 'xiaomi_lywsd03mmc_bthome_v2'\n"
    "        }\n"
    "      ]\n"
    "    });\n"
    "    phoneBleScannerMock.endContinuousScanCount = 1;\n"
    "    renderHardwareSetup();\n\n"
    "    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));\n"
    "    expect(await screen.findByText('21.3°C')).toBeInTheDocument();\n"
    "    await waitFor(\n"
    "      () => expect(phoneBleScannerMock.startCount).toBeGreaterThanOrEqual(2),\n"
    "      { timeout: 2500 }\n"
    "    );\n"
    "  });\n\n"
    "  it('shows phone BLE scan startup errors as toast feedback', async () => {\n",
)

print("Applied A+B+C thermometer/live-scan/rule-flow patch")

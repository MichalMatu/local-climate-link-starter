from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'target not found in {path}: {old[:140]!r}')
    file.write_text(text.replace(old, new, 1))


# Let ShellySetupPage delegate saved-device settings and BLE surfaces to a parent page tree.
path = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace_once(
    path,
    """  onAddRequest?: () => void;\n  onSettingsClose?: () => void;\n  onBleScanPageRequest?: (device: ShellyDraftDevice) => void;\n  onBleScanClose?: () => void;\n};\n""",
    """  onAddRequest?: () => void;\n  onSettingsClose?: () => void;\n  onSettingsPageRequest?: (device: ShellyDraftDevice) => void;\n  onBleScanPageRequest?: (device: ShellyDraftDevice) => void;\n  onBleScanClose?: () => void;\n};\n""",
)
replace_once(
    path,
    """  onAddRequest,\n  onSettingsClose,\n  onBleScanPageRequest,\n  onBleScanClose\n}: ShellySetupPageProps) => {\n""",
    """  onAddRequest,\n  onSettingsClose,\n  onSettingsPageRequest,\n  onBleScanPageRequest,\n  onBleScanClose\n}: ShellySetupPageProps) => {\n""",
)
replace_once(
    path,
    """  const openBleScanModal = (device: ShellyDraftDevice) => {\n    if (settingsOnlyDeviceId && onBleScanPageRequest) {\n      onBleScanPageRequest(device);\n      return;\n    }\n""",
    """  const openBleScanModal = (device: ShellyDraftDevice) => {\n    if (onBleScanPageRequest) {\n      onBleScanPageRequest(device);\n      return;\n    }\n""",
)
replace_once(
    path,
    """  const openInfoModal = (device: ShellyDraftDevice) => {\n    flow.checkShellyMutation.reset();\n    flow.recheckShellyMutation.reset();\n    setDialog({ kind: 'info', deviceId: device.id });\n    flow.recheckShellyMutation.mutate(device);\n  };\n""",
    """  const openInfoModal = (device: ShellyDraftDevice) => {\n    flow.checkShellyMutation.reset();\n    flow.recheckShellyMutation.reset();\n    if (onSettingsPageRequest) {\n      onSettingsPageRequest(device);\n      return;\n    }\n    setDialog({ kind: 'info', deviceId: device.id });\n    flow.recheckShellyMutation.mutate(device);\n  };\n""",
)

# Add a local nested page tree to the configurator, parallel to its existing local Add pages.
path = 'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx'
replace_once(
    path,
    """type SensorAddMode = 'manual' | 'phone-scan';\ntype LocalAddPage = 'plug' | 'sensor' | null;\n""",
    """type SensorAddMode = 'manual' | 'phone-scan';\ntype LocalAddPage = 'plug' | 'sensor' | null;\ntype LocalShellyPage =\n  | { kind: 'settings'; deviceId: string }\n  | { kind: 'ble'; deviceId: string; returnTo: 'shelly' | 'settings' }\n  | null;\n""",
)
replace_once(
    path,
    """  const [localAddPage, setLocalAddPage] = useState<LocalAddPage>(null);\n  const [localSensorAddMode, setLocalSensorAddMode] = useState<SensorAddMode>('manual');\n""",
    """  const [localAddPage, setLocalAddPage] = useState<LocalAddPage>(null);\n  const [localShellyPage, setLocalShellyPage] = useState<LocalShellyPage>(null);\n  const [localSensorAddMode, setLocalSensorAddMode] = useState<SensorAddMode>('manual');\n""",
)
replace_once(
    path,
    """  if (localAddPage !== null) {\n""",
    """  if (localShellyPage !== null) {\n    const localShelly = flow.shellyDevices.find(\n      (device) => device.id === localShellyPage.deviceId\n    );\n\n    if (localShellyPage.kind === 'settings') {\n      const closeSettings = () => setLocalShellyPage(null);\n      return (\n        <main className=\"demo-shell hardware-shell\">\n          <AppPageBack label={t('hardware.nav.shelly')} onBack={closeSettings} />\n          <ShellySetupPage\n            flow={flow}\n            enableBleDiscovery={setupIntent !== 'time'}\n            settingsOnlyDeviceId={localShellyPage.deviceId}\n            onSettingsClose={closeSettings}\n            onBleScanPageRequest={(device) =>\n              setLocalShellyPage({\n                kind: 'ble',\n                deviceId: device.id,\n                returnTo: 'settings'\n              })\n            }\n          />\n        </main>\n      );\n    }\n\n    const closeBleScan = () =>\n      setLocalShellyPage(\n        localShellyPage.returnTo === 'settings'\n          ? { kind: 'settings', deviceId: localShellyPage.deviceId }\n          : null\n      );\n    return (\n      <main className=\"demo-shell hardware-shell\">\n        <AppPageBack\n          label={\n            localShellyPage.returnTo === 'settings'\n              ? (localShelly?.name ?? t('hardware.nav.shelly'))\n              : t('hardware.nav.shelly')\n          }\n          onBack={closeBleScan}\n        />\n        <ShellySetupPage\n          flow={flow}\n          bleScanOnlyDeviceId={localShellyPage.deviceId}\n          onBleScanClose={closeBleScan}\n        />\n      </main>\n    );\n  }\n\n  if (localAddPage !== null) {\n""",
)
replace_once(
    path,
    """      {activeTab === 'shelly' && (\n        <ShellySetupPage\n          flow={flow}\n          enableBleDiscovery={setupIntent !== 'time'}\n          addOnly={plugAddOnly}\n          onAddRequest={openPlugAdd}\n        />\n      )}\n""",
    """      {activeTab === 'shelly' && (\n        <ShellySetupPage\n          flow={flow}\n          enableBleDiscovery={setupIntent !== 'time'}\n          addOnly={plugAddOnly}\n          onAddRequest={openPlugAdd}\n          {...(!plugAddOnly && !sensorAddOnly\n            ? {\n                onSettingsPageRequest: (device) =>\n                  setLocalShellyPage({ kind: 'settings', deviceId: device.id }),\n                onBleScanPageRequest: (device) =>\n                  setLocalShellyPage({\n                    kind: 'ble',\n                    deviceId: device.id,\n                    returnTo: 'shelly'\n                  })\n              }\n            : {})}\n        />\n      )}\n""",
)

print('Configurator Shelly child-page implementation applied')

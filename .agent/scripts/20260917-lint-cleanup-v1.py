from pathlib import Path

# useShellySetupScanFlow.test.ts: avoid forbidden import() type annotation.
p = Path('apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.test.ts')
s = p.read_text()
s = s.replace(
    "import { describe, expect, it, vi } from 'vitest';\n",
    "import { describe, expect, it, vi } from 'vitest';\nimport type * as ShellyRequestsModule from './shellyRequests.js';\n",
)
s = s.replace(
    "  const actual = await importOriginal<typeof import('./shellyRequests.js')>();",
    "  const actual = await importOriginal<typeof ShellyRequestsModule>();",
)
p.write_text(s)

# AppRoutes.tsx: remove unused installed-automation subscription and lookup.
p = Path('apps/mobile/src/routes/AppRoutes.tsx')
s = p.read_text()
s = s.replace("import { useInstalledAutomationStore } from '../flows/installations/store.js';\n", '')
s = s.replace(
    "  const installations = useInstalledAutomationStore((state) => state.installations);\n",
    '',
)
s = s.replace(
    "        onOpenInstallation={(installationId) => {\n"
    "          const installation = installations.find(\n"
    "            (candidate) => candidate.id === installationId\n"
    "          );\n"
    "          navigate({\n",
    "        onOpenInstallation={(installationId) => {\n"
    "          navigate({\n",
)
p.write_text(s)

# useShellyControlFlow.ts: narrow physical-control target and stabilize callbacks.
p = Path('apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts')
s = p.read_text()
s = s.replace(
    "type ShellyControlMutationResult = {\n  device: ShellyDraftDevice;\n  status: ShellyControlStatus;\n};",
    "type ShellyControlTarget = Pick<ShellyDraftDevice, 'id' | 'baseUrl'>;\n\n"
    "type ShellyControlMutationResult = {\n  device: ShellyControlTarget;\n  status: ShellyControlStatus;\n};",
)
s = s.replace("    device: ShellyDraftDevice,\n    status: ShellyControlStatus,", "    device: ShellyControlTarget,\n    status: ShellyControlStatus,")
s = s.replace("    device: ShellyDraftDevice,\n    error: unknown,", "    device: ShellyControlTarget,\n    error: unknown,")
s = s.replace("      device: ShellyDraftDevice\n", "      device: ShellyControlTarget\n")
s = s.replace(
    "  const refreshShellyControl = (device: ShellyDraftDevice) => {\n"
    "    refreshShellyControlMutation.mutate(device);\n"
    "  };\n\n"
    "  const turnRelayOn = (device: ShellyDraftDevice) => {\n"
    "    turnRelayOnMutation.mutate(device);\n"
    "  };\n\n"
    "  const turnRelayOff = (device: ShellyDraftDevice) => {\n"
    "    turnRelayOffMutation.mutate(device);\n"
    "  };",
    "  const refreshShellyControl = useCallback(\n"
    "    (device: ShellyControlTarget) => refreshShellyControlMutation.mutate(device),\n"
    "    [refreshShellyControlMutation.mutate]\n"
    "  );\n\n"
    "  const turnRelayOn = useCallback(\n"
    "    (device: ShellyControlTarget) => turnRelayOnMutation.mutate(device),\n"
    "    [turnRelayOnMutation.mutate]\n"
    "  );\n\n"
    "  const turnRelayOff = useCallback(\n"
    "    (device: ShellyControlTarget) => turnRelayOffMutation.mutate(device),\n"
    "    [turnRelayOffMutation.mutate]\n"
    "  );",
)
p.write_text(s)

# AutomationDashboardScreen.tsx: refresh only when physical target id/address changes.
p = Path('apps/mobile/src/screens/AutomationDashboardScreen.tsx')
s = p.read_text()
s = s.replace(
    "  useEffect(() => {\n"
    "    refreshShellyControl(device);\n"
    "  }, [device.id, device.baseUrl]);",
    "  useEffect(() => {\n"
    "    refreshShellyControl({ id: device.id, baseUrl: device.baseUrl });\n"
    "  }, [device.id, device.baseUrl, refreshShellyControl]);",
)
s = s.replace(
    "  const [settingsDeviceId, setSettingsDeviceId] = useState<string | null>(null);\n",
    "  const [settingsDeviceId, setSettingsDeviceId] = useState<string | null>(null);\n"
    "  const closePlugSettings = useCallback(() => setSettingsDeviceId(null), []);\n",
)
s = s.replace("          onClose={() => setSettingsDeviceId(null)}\n", "          onClose={closePlugSettings}\n")
p.write_text(s)

# ShellySetupPage.tsx: depend on the exact stable mutation functions and saved-device list.
p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = p.read_text()
needle = "  const infoShelly =\n    infoShellyId === null\n      ? null\n      : (shellyDevices.find((device) => device.id === infoShellyId) ?? null);\n"
if needle in s:
    s = s.replace(
        needle,
        needle
        + "  const recheckShelly = flow.recheckShellyMutation.mutate;\n"
        + "  const resetRecheckShelly = flow.recheckShellyMutation.reset;\n",
    )
s = s.replace(
    "    flow.recheckShellyMutation.reset();\n"
    "    flow.recheckShellyMutation.mutate(device);\n"
    "  }, [settingsOnlyDeviceId]);",
    "    resetRecheckShelly();\n"
    "    recheckShelly(device);\n"
    "  }, [\n"
    "    onSettingsClose,\n"
    "    recheckShelly,\n"
    "    resetRecheckShelly,\n"
    "    settingsOnlyDeviceId,\n"
    "    shellyDevices\n"
    "  ]);",
)
p.write_text(s)

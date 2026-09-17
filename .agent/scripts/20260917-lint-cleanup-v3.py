from pathlib import Path

p = Path('apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts')
s = p.read_text()
s = s.replace(
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
    "  const refreshShellyControl = (device: ShellyControlTarget) => {\n"
    "    refreshShellyControlMutation.mutate(device);\n"
    "  };\n\n"
    "  const turnRelayOn = (device: ShellyControlTarget) => {\n"
    "    turnRelayOnMutation.mutate(device);\n"
    "  };\n\n"
    "  const turnRelayOff = (device: ShellyControlTarget) => {\n"
    "    turnRelayOffMutation.mutate(device);\n"
    "  };",
)
p.write_text(s)

p = Path('apps/mobile/src/screens/AutomationDashboardScreen.tsx')
s = p.read_text()
s = s.replace(
    "import { useCallback, useEffect, useState } from 'react';",
    "import { useCallback, useEffect, useRef, useState } from 'react';",
)
s = s.replace(
    "  const controlState = shellyControlStates[device.id];\n",
    "  const refreshShellyControlRef = useRef(refreshShellyControl);\n"
    "  const controlState = shellyControlStates[device.id];\n",
)
s = s.replace(
    "  useEffect(() => {\n"
    "    refreshShellyControl({ id: device.id, baseUrl: device.baseUrl });\n"
    "  }, [device.id, device.baseUrl, refreshShellyControl]);",
    "  useEffect(() => {\n"
    "    refreshShellyControlRef.current = refreshShellyControl;\n"
    "  }, [refreshShellyControl]);\n\n"
    "  useEffect(() => {\n"
    "    refreshShellyControlRef.current({ id: device.id, baseUrl: device.baseUrl });\n"
    "  }, [device.id, device.baseUrl]);",
)
p.write_text(s)

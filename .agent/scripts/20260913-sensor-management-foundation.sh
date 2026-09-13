#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='9bdddf8c065d24aa0ce8f3a7b73b3563680396af'

git fetch --prune origin "$BRANCH" agent-control
if [ -n "$(git status --porcelain)" ]; then
  echo 'ERROR: working tree is not clean.' >&2
  git status --short >&2
  exit 20
fi
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"

python3 - <<'PY'
from pathlib import Path

p = Path('apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts')
s = p.read_text()
s = s.replace(
"""import {
  CapacitorBleGattClient,
  CapacitorBleScanner,
  setPvvxDeviceTime,
  type BleScanner
} from '@lcl/ble-core';
""",
"""import {
  CapacitorBleGattClient,
  CapacitorBleScanner,
  setPvvxDeviceTime,
  type BleScanner
} from '@lcl/ble-core';
import type { SensorProfileId } from '@lcl/device-profiles';
""",
1,
)
s = s.replace(
"import { useHardwareSetupDraftStore, type SensorDraftDevice } from './setupDraftStore.js';\n",
"",
1,
)
s = s.replace(
"""type PvvxTimeMutationResult = {
  device: SensorDraftDevice;
  acknowledged: boolean;
};
""",
"""export type SensorRuntimeDevice = {
  id: string;
  name: string;
  runtimeAddress: string;
  profileId: SensorProfileId;
};

type PvvxTimeMutationResult = {
  device: SensorRuntimeDevice;
  acknowledged: boolean;
};
""",
1,
)
s = s.replace(
"""export const usePhoneSensorFlow = (sensorDevices: readonly SensorDraftDevice[]) => {
  const appendSensorReading = useHardwareSetupReadingsStore(
    (state) => state.appendSensorReading
  );
  const upsertSensorDevice = useHardwareSetupDraftStore(
    (state) => state.upsertSensorDevice
  );
""",
"""export const usePhoneSensorFlow = (
  sensorDevices: readonly SensorRuntimeDevice[],
  upsertSensorDevice: (device: SensorRuntimeDevice) => void
) => {
  const appendSensorReading = useHardwareSetupReadingsStore(
    (state) => state.appendSensorReading
  );
""",
1,
)
s = s.replace(
"mutationFn: async (device: SensorDraftDevice): Promise<PvvxTimeMutationResult> => {",
"mutationFn: async (device: SensorRuntimeDevice): Promise<PvvxTimeMutationResult> => {",
1,
)
p.write_text(s)

p = Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s = p.read_text()
s = s.replace(
"  } = usePhoneSensorFlow(sensorDevices);",
"  } = usePhoneSensorFlow(sensorDevices, upsertSensorDevice);",
1,
)
p.write_text(s)

p = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s = p.read_text()
s = s.replace(
"    flow.sensorSamplesById[device.id.toUpperCase()] ?? [];",
"    flow.sensorSamplesById[device.runtimeAddress.toUpperCase()] ?? [];",
1,
)
p.write_text(s)
PY

cat > apps/mobile/src/flows/devices/sensors/useSensorManagementFlow.ts <<'EOF'
import type { SensorProfileId } from '@lcl/device-profiles';
import { useMemo, useState } from 'react';
import { deriveSensorInputState } from '../../hardware-setup/ruleConfigDerivation.js';
import { useHardwareSetupReadingsStore } from '../../hardware-setup/sensorReadingsStore.js';
import {
  usePhoneSensorFlow,
  type SensorRuntimeDevice
} from '../../hardware-setup/usePhoneSensorFlow.js';
import { useSensorStore } from '../../registry/devicesAndRules.js';
import type { RegistryResult } from '../../registry/result.js';
import { createSavedSensor, type SavedSensor } from './model.js';

const DEFAULT_SENSOR_PROFILE: SensorProfileId = 'xiaomi_lywsd03mmc_bthome_v2';

export const useSensorManagementFlow = () => {
  const sensorDevices = useSensorStore((state) => state.items);
  const upsertSavedSensor = useSensorStore((state) => state.upsert);
  const removeSavedSensor = useSensorStore((state) => state.remove);
  const clearSensorReadings = useHardwareSetupReadingsStore(
    (state) => state.clearSensorReadings
  );
  const sensorSamplesById = useHardwareSetupReadingsStore(
    (state) => state.samplesBySensorId
  );
  const [sensorProfileInput, setSensorProfileInput] =
    useState<SensorProfileId>(DEFAULT_SENSOR_PROFILE);
  const [sensorMacInput, setSensorMacInput] = useState('');
  const [sensorNameInput, setSensorNameInput] = useState('');

  const sensorInputState = useMemo(
    () =>
      deriveSensorInputState({
        sensorMacInput,
        sensorNameInput,
        sensorProfileInput
      }),
    [sensorMacInput, sensorNameInput, sensorProfileInput]
  );

  const persistRuntimeDevice = (
    device: SensorRuntimeDevice
  ): RegistryResult<SavedSensor> => {
    const created = createSavedSensor({
      profileId: device.profileId,
      runtimeAddress: device.runtimeAddress,
      name: device.name,
      nowMs: Date.now()
    });
    return created.ok ? upsertSavedSensor(created.value) : created;
  };

  const phoneSensorFlow = usePhoneSensorFlow(sensorDevices, (device) => {
    persistRuntimeDevice(device);
  });

  const addSensorDraft = (): RegistryResult<SavedSensor> => {
    if (!sensorInputState.ok) {
      return { ok: false, error: { kind: 'validation-failed' } };
    }
    return persistRuntimeDevice(sensorInputState.device);
  };

  const setSensorDeviceName = (
    id: string,
    name: string
  ): RegistryResult<SavedSensor> => {
    const device = sensorDevices.find((candidate) => candidate.id === id);
    if (!device) {
      return {
        ok: false,
        error: { kind: 'device-missing', deviceKind: 'sensor', deviceId: id }
      };
    }
    return upsertSavedSensor({ ...device, name, updatedAtMs: Date.now() });
  };

  const removeSensorDevice = (id: string): RegistryResult<null> => {
    const device = sensorDevices.find((candidate) => candidate.id === id);
    const removed = removeSavedSensor(id);
    if (removed.ok && device) {
      clearSensorReadings(device.runtimeAddress);
    }
    return removed;
  };

  return {
    sensorDevices,
    sensorSamplesById,
    sensorProfileInput,
    setSensorProfileInput,
    sensorMacInput,
    setSensorMacInput,
    sensorNameInput,
    setSensorNameInput,
    sensorInputState,
    addSensorDraft,
    setSensorDeviceName,
    removeSensorDevice,
    ...phoneSensorFlow
  };
};

export type SensorManagementFlow = ReturnType<typeof useSensorManagementFlow>;
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('docs/implementation/device-rule-decoupling-progress.md')
s = p.read_text()
marker = "## Remaining work and exact next step\n"
entry = """### Phase B2 sensor-management foundation\n\nPhone BLE/GATT orchestration no longer owns hardware-draft persistence: the caller\ninjects the device write boundary. A dedicated `useSensorManagementFlow` now binds\nthat orchestration to the independent sensor registry while keeping live readings\nseparate. `SensorSetupPage` reads samples by runtime address rather than durable\nregistry id, which avoids a subtle break when the new profile-qualified sensor ids\nreplace the old MAC-as-id draft shape. Product routing is not switched yet.\n\n"""
if entry not in s:
    s = s.replace(marker, entry + marker, 1)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/flows/devices/sensors/useSensorManagementFlow.ts \
  docs/implementation/device-rule-decoupling-progress.md

git diff --check
pnpm --dir apps/mobile exec vitest run \
  src/flows/hardware-setup/sensorReadingsStore.test.ts \
  src/flows/registry/devicesAndRules.test.ts \
  src/__tests__/hardware-setup.test.tsx
pnpm quality:repo
pnpm typecheck

git add \
  apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/flows/devices/sensors/useSensorManagementFlow.ts \
  docs/implementation/device-rule-decoupling-progress.md
git commit -m 'Decouple sensor management from setup draft'
git push origin HEAD:"$BRANCH"

echo "SENSOR_MANAGEMENT_HEAD=$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"

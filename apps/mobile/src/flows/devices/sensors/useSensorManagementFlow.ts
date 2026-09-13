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

  const setSensorDeviceName = (id: string, name: string): RegistryResult<SavedSensor> => {
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

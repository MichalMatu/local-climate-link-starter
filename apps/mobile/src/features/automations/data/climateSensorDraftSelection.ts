import {
  MAX_CLIMATE_SENSORS,
  type ClimateSensorAggregation
} from '@lcl/script-generator';

type SensorListItem = { id: string };

type SensorDraftSelectionState<TSensor extends SensorListItem> = {
  sensorDevices: readonly TSensor[];
  selectedSensorId: string | null;
  additionalSensorIds: readonly string[];
};

export type SensorDraftActions<TSensor extends SensorListItem> = {
  upsertSensorDevice(device: TSensor): void;
  selectSensorDevice(id: string): void;
  setAdditionalSensorIds(ids: readonly string[]): void;
  toggleAdditionalSensorDevice(id: string): void;
  setSensorAggregation(value: ClimateSensorAggregation): void;
  setSensorDeviceName(id: string, name: string): void;
  removeSensorDevice(id: string): void;
};

export const validAdditionalSensorIds = <TSensor extends SensorListItem>(
  state: SensorDraftSelectionState<TSensor>,
  ids: readonly string[],
  selectedSensorId = state.selectedSensorId
): string[] => {
  const availableIds = new Set(state.sensorDevices.map((device) => device.id));
  return [...new Set(ids)]
    .filter((id) => id !== selectedSensorId && availableIds.has(id))
    .slice(0, MAX_CLIMATE_SENSORS - 1);
};

export const upsertSensorSelection = <TSensor extends SensorListItem>(
  state: SensorDraftSelectionState<TSensor>,
  device: TSensor
) => ({
  sensorDevices: [device, ...state.sensorDevices.filter((item) => item.id !== device.id)],
  selectedSensorId: device.id,
  additionalSensorIds: state.additionalSensorIds.filter((id) => id !== device.id)
});

export const selectSensorSelection = <TSensor extends SensorListItem>(
  state: SensorDraftSelectionState<TSensor>,
  id: string
) =>
  state.sensorDevices.some((item) => item.id === id)
    ? {
        selectedSensorId: id,
        additionalSensorIds: state.additionalSensorIds.filter(
          (sensorId) => sensorId !== id
        )
      }
    : null;

export const setAdditionalSensorSelection = <TSensor extends SensorListItem>(
  state: SensorDraftSelectionState<TSensor>,
  ids: readonly string[]
) => ({ additionalSensorIds: validAdditionalSensorIds(state, ids) });

export const toggleAdditionalSensorSelection = <TSensor extends SensorListItem>(
  state: SensorDraftSelectionState<TSensor>,
  id: string
) => {
  if (
    id === state.selectedSensorId ||
    !state.sensorDevices.some((item) => item.id === id)
  ) {
    return null;
  }
  return {
    additionalSensorIds: state.additionalSensorIds.includes(id)
      ? state.additionalSensorIds.filter((sensorId) => sensorId !== id)
      : validAdditionalSensorIds(state, [...state.additionalSensorIds, id])
  };
};

export const removeSensorSelection = <TSensor extends SensorListItem>(
  state: SensorDraftSelectionState<TSensor>,
  id: string
) => {
  const sensorDevices = state.sensorDevices.filter((item) => item.id !== id);
  if (sensorDevices.length === state.sensorDevices.length) return null;

  const selectedSensorId =
    state.selectedSensorId === id
      ? (sensorDevices[0]?.id ?? null)
      : state.selectedSensorId;
  return {
    sensorDevices,
    selectedSensorId,
    additionalSensorIds: validAdditionalSensorIds(
      { ...state, sensorDevices, selectedSensorId },
      state.additionalSensorIds.filter((sensorId) => sensorId !== id),
      selectedSensorId
    )
  };
};

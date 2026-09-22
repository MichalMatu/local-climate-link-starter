import type { ClimateInstalledAutomation } from './installedAutomation.js';

type ClimateAutomationEditDraftState = {
  shellyDevices: readonly {
    id: string;
    name: string;
    baseUrl: string;
    scriptIdInput: string;
    model?: string | undefined;
    gen?: number | undefined;
  }[];
  sensorDevices: readonly {
    id: string;
    name: string;
    runtimeAddress: string;
    profileId: ClimateInstalledAutomation['config']['sensor']['profileId'];
  }[];
  inheritedSensorIds?: readonly string[];
};

const sensorIdentityKey = (runtimeAddress: string): string =>
  runtimeAddress.trim().toUpperCase();

const hasRecoveredRuntimeIdentity = (
  sensor: ClimateInstalledAutomation['config']['sensor']
): boolean =>
  sensorIdentityKey(sensor.sensorId) === sensorIdentityKey(sensor.runtimeAddress);

export const createClimateAutomationEditDraftPatch = (
  state: ClimateAutomationEditDraftState,
  installation: ClimateInstalledAutomation
) => {
  const { config } = installation;
  const shellyDevice = {
    id: installation.shelly.deviceId,
    name: installation.shelly.name,
    baseUrl: installation.shelly.baseUrl,
    scriptIdInput: String(installation.script.id),
    model: installation.shelly.model,
    gen: installation.shelly.gen
  };
  const configuredSensors = [
    config.sensor,
    ...(config.sensorSet?.additionalSensors ?? [])
  ];
  const savedSensorByIdentityKey = new Map(
    state.sensorDevices.map((sensor) => [
      sensorIdentityKey(sensor.runtimeAddress),
      sensor
    ])
  );
  const savedSensorIdentityKeys = new Set(savedSensorByIdentityKey.keys());
  const inheritedSensorIdentityKeys = new Set(
    (state.inheritedSensorIds ?? []).map(sensorIdentityKey)
  );
  const configuredSensorDevices = configuredSensors.map((sensor) => ({
    id: sensor.runtimeAddress,
    name:
      savedSensorByIdentityKey.get(sensorIdentityKey(sensor.runtimeAddress))?.name ??
      sensor.displayName,
    runtimeAddress: sensor.runtimeAddress,
    profileId: sensor.profileId
  }));
  const configuredIdentityKeys = new Set(
    configuredSensorDevices.map((sensor) => sensorIdentityKey(sensor.runtimeAddress))
  );
  const seenIdentityKeys = new Set(configuredIdentityKeys);
  const savedOnlySensorDevices = state.sensorDevices.flatMap((sensor) => {
    const identityKey = sensorIdentityKey(sensor.runtimeAddress);
    if (seenIdentityKeys.has(identityKey)) return [];
    seenIdentityKeys.add(identityKey);
    return [{ ...sensor, id: sensor.runtimeAddress }];
  });
  const sensorDevices = [...configuredSensorDevices, ...savedOnlySensorDevices];

  return {
    shellyDevices: [
      shellyDevice,
      ...state.shellyDevices.filter((item) => item.id !== shellyDevice.id)
    ],
    sensorDevices,
    selectedShellyId: shellyDevice.id,
    selectedSensorId: configuredSensorDevices[0]!.id,
    additionalSensorIds: configuredSensorDevices.slice(1).map((sensor) => sensor.id),
    inheritedSensorIds: configuredSensors
      .filter((sensor) => {
        const identityKey = sensorIdentityKey(sensor.runtimeAddress);
        return (
          hasRecoveredRuntimeIdentity(sensor) ||
          inheritedSensorIdentityKeys.has(identityKey) ||
          !savedSensorIdentityKeys.has(identityKey)
        );
      })
      .map((sensor) => sensor.runtimeAddress),
    sensorAggregation: config.sensorSet?.aggregation ?? 'avg',
    rulePreset: config.rule.mode,
    onThresholdInput: String(config.rule.control.onThreshold),
    offThresholdInput: String(config.rule.control.offThreshold),
    vpdAssistEnabled: config.rule.vpdAssist.enabled,
    vpdTargetInput: String(config.rule.vpdAssist.targetKpa),
    rssiMinInput: String(config.rule.rssiMin),
    staleTimeoutMinInput: String(config.rule.staleTimeoutSec / 60),
    minChangeMinInput: String(config.rule.minChangeMs / 60_000),
    maxOnHoursInput: String(config.rule.maxOnMs / 3_600_000)
  };
};

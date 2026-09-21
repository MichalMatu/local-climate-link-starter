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
};

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
  const sensorDevices = configuredSensors.map((sensor) => ({
    id: sensor.sensorId,
    name: sensor.displayName,
    runtimeAddress: sensor.runtimeAddress,
    profileId: sensor.profileId
  }));
  const configuredSensorIds = new Set(sensorDevices.map((sensor) => sensor.id));

  return {
    shellyDevices: [
      shellyDevice,
      ...state.shellyDevices.filter((item) => item.id !== shellyDevice.id)
    ],
    sensorDevices: [
      ...sensorDevices,
      ...state.sensorDevices.filter((item) => !configuredSensorIds.has(item.id))
    ],
    selectedShellyId: shellyDevice.id,
    selectedSensorId: sensorDevices[0]!.id,
    additionalSensorIds: sensorDevices.slice(1).map((sensor) => sensor.id),
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

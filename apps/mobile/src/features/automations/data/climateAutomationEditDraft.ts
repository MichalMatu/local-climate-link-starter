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
  const sensorDevice = {
    id: config.sensor.sensorId,
    name: config.sensor.displayName,
    runtimeAddress: config.sensor.runtimeAddress,
    profileId: config.sensor.profileId
  };

  return {
    shellyDevices: [
      shellyDevice,
      ...state.shellyDevices.filter((item) => item.id !== shellyDevice.id)
    ],
    sensorDevices: [
      sensorDevice,
      ...state.sensorDevices.filter((item) => item.id !== sensorDevice.id)
    ],
    selectedShellyId: shellyDevice.id,
    selectedSensorId: sensorDevice.id,
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

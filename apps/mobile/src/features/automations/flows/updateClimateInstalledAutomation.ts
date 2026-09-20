import {
  generateShellyThermostatScript,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import {
  createInstallPlan,
  hashScriptCode,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  normalizeShellyDeviceId,
  RpcShellyClient,
  RpcShellyScheduleClient,
  type ShellyInstallResult
} from '@lcl/shelly-client';
import { createShellyTransport } from '../../../platform/shellyHttpTransport.js';
import { unwrapShellyResult } from '../../../platform/shellyResult.js';
import {
  findInstalledRelayOwner,
  type ClimateInstalledAutomation,
  type InstalledAutomation
} from '../data/installedAutomation.js';
import { readShellyAutomationScriptState } from '../data/shellyManagedAutomation.js';
import { findScheduleRelayConflict } from '../data/timeAutomationSchedule.js';

export type ClimateAutomationEditServices = {
  readManagedRuntime(baseUrl: string): ReturnType<typeof readShellyAutomationScriptState>;
  readDeviceId(baseUrl: string): Promise<string>;
  hasNativeScheduleConflict(baseUrl: string, relayId: number): Promise<boolean>;
  forceRelayOff(baseUrl: string, relayId: number): Promise<void>;
  replaceManagedScript(baseUrl: string, code: string): Promise<ShellyInstallResult>;
  nowMs(): number;
};

const defaultServices: ClimateAutomationEditServices = {
  readManagedRuntime: readShellyAutomationScriptState,
  readDeviceId: async (baseUrl) => {
    const client = new RpcShellyClient(createShellyTransport(baseUrl));
    const info = unwrapShellyResult(await client.getDeviceInfo());
    const deviceId = info.id?.trim();
    if (!deviceId) throw new Error('Shelly did not expose a stable device id.');
    return deviceId;
  },
  hasNativeScheduleConflict: async (baseUrl, relayId) => {
    const schedules = unwrapShellyResult(
      await new RpcShellyScheduleClient(createShellyTransport(baseUrl)).list()
    );
    return findScheduleRelayConflict(schedules.jobs, relayId) !== null;
  },
  forceRelayOff: async (baseUrl, relayId) => {
    const client = new RpcShellyClient(createShellyTransport(baseUrl));
    unwrapShellyResult(await client.setRelayOff({ relayId }));
    const status = unwrapShellyResult(await client.getStatus());
    if (status.relayOn) throw new Error('Shelly relay did not confirm OFF.');
  },
  replaceManagedScript: async (baseUrl, code) =>
    unwrapShellyResult(
      await new RpcShellyClient(createShellyTransport(baseUrl)).installScript(
        createInstallPlan(code)
      )
    ),
  nowMs: Date.now
};

const runtimeHash = (code: string): string =>
  hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${code}`);

const assertManagedRuntimeMatches = async (
  installation: ClimateInstalledAutomation,
  services: ClimateAutomationEditServices
): Promise<void> => {
  const runtime = await services.readManagedRuntime(installation.shelly.baseUrl);
  if (
    runtime.script?.id !== installation.script.id ||
    runtime.code === null ||
    runtimeHash(runtime.code) !== installation.script.hash
  ) {
    throw new Error('Stored automation script does not match Shelly.');
  }
};

export const updateClimateInstalledAutomation = async ({
  installation,
  config,
  installations,
  services = defaultServices
}: {
  installation: ClimateInstalledAutomation;
  config: ShellyThermostatConfig;
  installations: readonly InstalledAutomation[];
  services?: ClimateAutomationEditServices;
}): Promise<{
  installation: ClimateInstalledAutomation;
  install: ShellyInstallResult;
}> => {
  if (config.output.relayId !== installation.config.output.relayId) {
    throw new Error('Changing the relay requires reinstalling the automation.');
  }

  const remoteDeviceId = await services.readDeviceId(installation.shelly.baseUrl);
  if (
    normalizeShellyDeviceId(remoteDeviceId) !==
    normalizeShellyDeviceId(installation.shelly.deviceId)
  ) {
    throw new Error('Shelly identity does not match the installed automation.');
  }

  const owner = findInstalledRelayOwner({
    installations,
    deviceId: installation.shelly.deviceId,
    relayId: config.output.relayId,
    ignoreInstallationId: installation.id
  });
  if (owner) throw new Error('Another managed automation owns this relay.');

  if (
    await services.hasNativeScheduleConflict(
      installation.shelly.baseUrl,
      config.output.relayId
    )
  ) {
    throw new Error('A native Shelly schedule already owns this relay.');
  }

  await assertManagedRuntimeMatches(installation, services);
  await services.forceRelayOff(installation.shelly.baseUrl, config.output.relayId);

  const code = generateShellyThermostatScript(config);
  const install = await services.replaceManagedScript(installation.shelly.baseUrl, code);
  if (install.scriptId !== installation.script.id) {
    throw new Error('Editing changed the managed Shelly script id.');
  }

  await services.forceRelayOff(installation.shelly.baseUrl, config.output.relayId);
  const verified = await services.readManagedRuntime(installation.shelly.baseUrl);
  if (
    verified.script?.id !== install.scriptId ||
    verified.script.running !== true ||
    verified.code === null ||
    runtimeHash(verified.code) !== install.scriptHash
  ) {
    throw new Error('Shelly did not confirm the edited automation runtime.');
  }

  return {
    install,
    installation: {
      ...installation,
      config,
      script: { id: install.scriptId, hash: install.scriptHash },
      updatedAtMs: Math.max(services.nowMs(), installation.updatedAtMs + 1)
    }
  };
};

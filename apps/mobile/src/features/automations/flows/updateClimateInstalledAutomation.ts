import {
  configHash,
  decodeShellyThermostatScript,
  generateShellyRuntimeConfigUpdateEval,
  generateShellyThermostatScript,
  supportsShellyRuntimeConfigPersistence,
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
import {
  readShellyAutomationScriptState,
  type ShellyAutomationScriptState
} from '../data/shellyManagedAutomation.js';
import { findScheduleRelayConflict } from '../data/timeAutomationSchedule.js';

export type ClimateAutomationEditServices = {
  readManagedRuntime(baseUrl: string): ReturnType<typeof readShellyAutomationScriptState>;
  readDeviceId(baseUrl: string): Promise<string>;
  hasNativeScheduleConflict(baseUrl: string, relayId: number): Promise<boolean>;
  forceRelayOff(baseUrl: string, relayId: number): Promise<void>;
  replaceManagedScript(baseUrl: string, code: string): Promise<ShellyInstallResult>;
  updateRuntimeConfig(baseUrl: string, scriptId: number, code: string): Promise<string | null>;
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
  updateRuntimeConfig: async (baseUrl, scriptId, code) =>
    unwrapShellyResult(
      await new RpcShellyClient(createShellyTransport(baseUrl)).evaluateScript(scriptId, code)
    ),
  nowMs: Date.now
};

const runtimeHash = (code: string): string =>
  hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${code}`);

const effectiveRuntimeConfigHash = (
  runtime: ShellyAutomationScriptState
): string | null => {
  if (runtime.code === null) return null;
  return (
    decodeShellyThermostatScript(runtime.code, runtime.persistedRuntimeConfigJson)
      ?.runtimeConfig.k ?? null
  );
};

const assertManagedRuntimeMatches = async (
  installation: ClimateInstalledAutomation,
  services: ClimateAutomationEditServices
): Promise<ShellyAutomationScriptState> => {
  const runtime = await services.readManagedRuntime(installation.shelly.baseUrl);
  if (
    runtime.script?.id !== installation.script.id ||
    runtime.code === null ||
    runtimeHash(runtime.code) !== installation.script.hash
  ) {
    throw new Error('Stored automation script does not match Shelly.');
  }
  if (
    supportsShellyRuntimeConfigPersistence(runtime.code) &&
    effectiveRuntimeConfigHash(runtime) !== configHash(installation.config)
  ) {
    throw new Error('Stored automation config does not match Shelly.');
  }
  return runtime;
};

const verifyPersistentRuntime = async ({
  installation,
  expectedConfig,
  services
}: {
  installation: ClimateInstalledAutomation;
  expectedConfig: ShellyThermostatConfig;
  services: ClimateAutomationEditServices;
}): Promise<void> => {
  const runtime = await services.readManagedRuntime(installation.shelly.baseUrl);
  if (
    runtime.script?.id !== installation.script.id ||
    runtime.script.running !== true ||
    runtime.code === null ||
    runtimeHash(runtime.code) !== installation.script.hash ||
    effectiveRuntimeConfigHash(runtime) !== configHash(expectedConfig)
  ) {
    throw new Error('Shelly did not confirm the edited automation runtime.');
  }
};

const updatePersistentRuntime = async ({
  installation,
  config,
  services
}: {
  installation: ClimateInstalledAutomation;
  config: ShellyThermostatConfig;
  services: ClimateAutomationEditServices;
}): Promise<void> => {
  const confirmedHash = await services.updateRuntimeConfig(
    installation.shelly.baseUrl,
    installation.script.id,
    generateShellyRuntimeConfigUpdateEval(config)
  );
  if (confirmedHash !== configHash(config)) {
    throw new Error('Shelly did not confirm the runtime config update.');
  }
};

const rollbackPersistentRuntime = async (
  installation: ClimateInstalledAutomation,
  services: ClimateAutomationEditServices
): Promise<void> => {
  await updatePersistentRuntime({ installation, config: installation.config, services });
  await services.forceRelayOff(
    installation.shelly.baseUrl,
    installation.config.output.relayId
  );
  await verifyPersistentRuntime({
    installation,
    expectedConfig: installation.config,
    services
  });
};

const persistentEdit = async ({
  installation,
  config,
  services
}: {
  installation: ClimateInstalledAutomation;
  config: ShellyThermostatConfig;
  services: ClimateAutomationEditServices;
}): Promise<ShellyInstallResult> => {
  try {
    await updatePersistentRuntime({ installation, config, services });
    await services.forceRelayOff(installation.shelly.baseUrl, config.output.relayId);
    await verifyPersistentRuntime({ installation, expectedConfig: config, services });
  } catch (error) {
    try {
      await rollbackPersistentRuntime(installation, services);
    } catch {
      throw new Error('Climate config update failed and rollback was not confirmed.');
    }
    throw error;
  }

  return {
    scriptId: installation.script.id,
    scriptHash: installation.script.hash,
    running: true
  };
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

  const currentRuntime = await assertManagedRuntimeMatches(installation, services);
  await services.forceRelayOff(installation.shelly.baseUrl, config.output.relayId);

  let install: ShellyInstallResult;
  if (
    currentRuntime.code !== null &&
    currentRuntime.script?.running === true &&
    supportsShellyRuntimeConfigPersistence(currentRuntime.code)
  ) {
    install = await persistentEdit({ installation, config, services });
  } else {
    const code = generateShellyThermostatScript(config);
    install = await services.replaceManagedScript(installation.shelly.baseUrl, code);
    if (install.scriptId !== installation.script.id) {
      throw new Error('Editing changed the managed Shelly script id.');
    }

    await services.forceRelayOff(installation.shelly.baseUrl, config.output.relayId);
    const verified = await services.readManagedRuntime(installation.shelly.baseUrl);
    if (
      verified.script?.id !== install.scriptId ||
      verified.script.running !== true ||
      verified.code === null ||
      runtimeHash(verified.code) !== install.scriptHash ||
      effectiveRuntimeConfigHash(verified) !== configHash(config)
    ) {
      throw new Error('Shelly did not confirm the edited automation runtime.');
    }
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

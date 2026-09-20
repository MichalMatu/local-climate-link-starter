import { normalizeShellyDeviceId, RpcShellyClient } from '@lcl/shelly-client';
import { createShellyTransport } from '../../../platform/shellyHttpTransport.js';
import { unwrapShellyResult } from '../../../platform/shellyResult.js';
import {
  findInstalledRelayOwner,
  type InstalledAutomation,
  type TimeInstalledAutomation
} from '../data/installedAutomation.js';
import { readShellyControlStatus } from '../data/shellyManagedAutomation.js';
import { updateDailyTimeAutomation } from '../data/timeAutomationRuntime.js';
import type { DailyTimeAutomationConfig } from '../data/timeAutomationConfig.js';
import type { TimeAutomationRuntimeSnapshot } from '../data/timeAutomationRuntimeState.js';

export type TimeAutomationEditServices = {
  readDeviceId(baseUrl: string): Promise<string>;
  hasManagedClimateScript(baseUrl: string): Promise<boolean>;
  updateRuntime(
    installation: TimeInstalledAutomation,
    config: DailyTimeAutomationConfig
  ): Promise<TimeAutomationRuntimeSnapshot>;
  nowMs(): number;
};

const defaultServices: TimeAutomationEditServices = {
  readDeviceId: async (baseUrl) => {
    const client = new RpcShellyClient(createShellyTransport(baseUrl));
    const info = unwrapShellyResult(await client.getDeviceInfo());
    const deviceId = info.id?.trim();
    if (!deviceId) throw new Error('Shelly did not expose a stable device id.');
    return deviceId;
  },
  hasManagedClimateScript: async (baseUrl) =>
    (await readShellyControlStatus(baseUrl)).automationScriptId !== null,
  updateRuntime: (installation, config) =>
    updateDailyTimeAutomation({ installation, config }),
  nowMs: Date.now
};

export const updateTimeInstalledAutomation = async ({
  installation,
  config,
  installations,
  services = defaultServices
}: {
  installation: TimeInstalledAutomation;
  config: DailyTimeAutomationConfig;
  installations: readonly InstalledAutomation[];
  services?: TimeAutomationEditServices;
}): Promise<{
  installation: TimeInstalledAutomation;
  runtime: TimeAutomationRuntimeSnapshot;
}> => {
  if (config.relayId !== installation.config.relayId) {
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
    relayId: config.relayId,
    ignoreInstallationId: installation.id
  });
  if (owner) throw new Error('Another managed automation owns this relay.');

  if (await services.hasManagedClimateScript(installation.shelly.baseUrl)) {
    throw new Error('A managed climate script already owns this Shelly runtime.');
  }

  const runtime = await services.updateRuntime(installation, config);
  return {
    runtime,
    installation: {
      ...installation,
      config,
      updatedAtMs: Math.max(services.nowMs(), installation.updatedAtMs + 1)
    }
  };
};

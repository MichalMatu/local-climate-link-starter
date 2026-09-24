import { unwrapShellyResult } from '../../platform/shellyResult.js';
import { createShellyTransport } from '../../platform/shellyHttpTransport.js';
import { generateShellyThermostatScript } from '@lcl/script-generator';
import {
  createInstallPlan,
  normalizeShellyDeviceId,
  RpcShellyClient
} from '@lcl/shelly-client';
import type { ClimateInstalledAutomation } from './model.js';
import { forceRelayOffAndConfirm } from './relaySafety.js';
import {
  readInstalledAutomationControlStatus,
  type InstalledAutomationControlStatus
} from './runtimeStatus.js';

export type InstalledAutomationRuntimePreparation = {
  installation: ClimateInstalledAutomation;
  status: InstalledAutomationControlStatus;
  upgraded: boolean;
};

const assertStoredDeviceIdentity = async (
  installation: ClimateInstalledAutomation
): Promise<void> => {
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  const info = unwrapShellyResult(await client.getDeviceInfo());
  const remoteDeviceId = info.id?.trim();
  if (
    !remoteDeviceId ||
    normalizeShellyDeviceId(remoteDeviceId) !==
      normalizeShellyDeviceId(installation.shelly.deviceId)
  ) {
    throw new Error('Shelly identity does not match the installed automation.');
  }
};

const reinstallCurrentRuntime = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimePreparation> => {
  await assertStoredDeviceIdentity(installation);
  const relayId = installation.config.output.relayId;
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));

  await forceRelayOffAndConfirm(client, relayId);
  const code = generateShellyThermostatScript(installation.config);
  const installed = unwrapShellyResult(
    await client.installScript(createInstallPlan(code))
  );
  await forceRelayOffAndConfirm(client, relayId);

  const upgradedInstallation: ClimateInstalledAutomation = {
    ...installation,
    script: { id: installed.scriptId, hash: installed.scriptHash },
    updatedAtMs: Math.max(Date.now(), installation.updatedAtMs + 1)
  };
  const status = await readInstalledAutomationControlStatus(upgradedInstallation);
  if (
    status.automationScriptId !== upgradedInstallation.script.id ||
    status.automationMode !== 'auto' ||
    !status.runtimeModeSupported ||
    status.relayOn
  ) {
    throw new Error('Shelly did not confirm the replaced automation runtime.');
  }

  return { installation: upgradedInstallation, status, upgraded: true };
};

export const ensureInstalledAutomationRuntimeCurrent = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimePreparation> => {
  await assertStoredDeviceIdentity(installation);
  const status = await readInstalledAutomationControlStatus(installation);
  if (
    status.automationScriptId === installation.script.id &&
    status.automationMode !== 'missing' &&
    status.automationMode !== 'stopped' &&
    status.runtimeModeSupported
  ) {
    return { installation, status, upgraded: false };
  }

  return reinstallCurrentRuntime(installation);
};

export const recoverInstalledAutomationRuntime = (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimePreparation> =>
  reinstallCurrentRuntime(installation);

import { generateShellyThermostatScript } from '@lcl/script-generator';
import { createInstallPlan, RpcShellyClient } from '@lcl/shelly-client';
import {
  createShellyTransport,
  readShellyControlStatus,
  unwrapShellyResult
} from '../hardware-setup/shellyRequests.js';
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

const assertStoredScriptOwnership = async (
  installation: ClimateInstalledAutomation
): Promise<void> => {
  const status = await readShellyControlStatus(installation.shelly.baseUrl);
  if (status.automationScriptId !== installation.script.id) {
    throw new Error('Stored automation script does not match Shelly.');
  }
};

const reinstallCurrentRuntime = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimePreparation> => {
  await assertStoredScriptOwnership(installation);
  const relayId = installation.config.output.relayId;
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));

  await forceRelayOffAndConfirm(client, relayId);
  const code = generateShellyThermostatScript(installation.config);
  const installed = unwrapShellyResult(
    await client.installScript(createInstallPlan(code))
  );
  if (installed.scriptId !== installation.script.id) {
    throw new Error('Runtime upgrade changed the stored Shelly script id.');
  }
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
    throw new Error('Shelly did not confirm the upgraded automation runtime.');
  }

  return { installation: upgradedInstallation, status, upgraded: true };
};

export const ensureInstalledAutomationRuntimeCurrent = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimePreparation> => {
  const status = await readInstalledAutomationControlStatus(installation);
  if (
    status.automationScriptId !== installation.script.id ||
    status.automationMode === 'missing'
  ) {
    throw new Error('Stored automation script does not match Shelly.');
  }
  if (status.automationMode === 'stopped') {
    throw new Error('Stopped automation runtime requires recovery.');
  }
  if (status.runtimeModeSupported) {
    return { installation, status, upgraded: false };
  }
  return reinstallCurrentRuntime(installation);
};

export const recoverInstalledAutomationRuntime = (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimePreparation> =>
  reinstallCurrentRuntime(installation);

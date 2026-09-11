import { LOCAL_CLIMATE_LINK_SCRIPT_NAME, RpcShellyClient } from '@lcl/shelly-client';
import {
  createShellyTransport,
  readShellySetupStatus,
  unwrapShellyResult
} from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';
import { forceRelayOffAndConfirm } from './relaySafety.js';
import { setInstalledAutomationRuntimeMode } from './runtimeModeTransport.js';
import {
  readInstalledAutomationControlStatus,
  type InstalledAutomationControlStatus
} from './runtimeStatus.js';
import {
  ensureInstalledAutomationRuntimeCurrent,
  recoverInstalledAutomationRuntime
} from './runtimeUpgrade.js';

export { readInstalledAutomationControlStatus } from './runtimeStatus.js';

export type InstalledAutomationScriptMatch = 'matched' | 'missing' | 'mismatch';

export type InstalledAutomationActionResult = {
  installation: ClimateInstalledAutomation;
  status: InstalledAutomationControlStatus;
};

export const installedAutomationScriptMatch = (
  installation: ClimateInstalledAutomation,
  status: Pick<InstalledAutomationControlStatus, 'automationScriptId'>
): InstalledAutomationScriptMatch => {
  if (status.automationScriptId === null) {
    return 'missing';
  }
  return status.automationScriptId === installation.script.id ? 'matched' : 'mismatch';
};

const requireMatchedInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationControlStatus> => {
  const status = await readInstalledAutomationControlStatus(installation);
  if (installedAutomationScriptMatch(installation, status) !== 'matched') {
    throw new Error('Stored automation script does not match Shelly.');
  }
  return status;
};

const verifyModeWithRelayOff = async (
  installation: ClimateInstalledAutomation,
  expectedMode: 'auto' | 'manual'
): Promise<InstalledAutomationControlStatus> => {
  const status = await requireMatchedInstalledAutomation(installation);
  if (status.automationMode !== expectedMode || !status.runtimeModeSupported) {
    throw new Error(`Shelly did not confirm ${expectedMode.toUpperCase()} runtime mode.`);
  }
  if (status.relayOn) {
    throw new Error(
      `Shelly did not confirm relay OFF while entering ${expectedMode.toUpperCase()}.`
    );
  }
  return status;
};

export const pauseInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationActionResult> => {
  const prepared = await ensureInstalledAutomationRuntimeCurrent(installation);
  if (
    prepared.status.automationMode !== 'auto' &&
    prepared.status.automationMode !== 'manual'
  ) {
    throw new Error('Automation runtime is not available for MANUAL mode.');
  }

  const nextInstallation = prepared.installation;
  await setInstalledAutomationRuntimeMode(nextInstallation, 'manual');
  const client = new RpcShellyClient(
    createShellyTransport(nextInstallation.shelly.baseUrl)
  );
  const relayId = nextInstallation.config.output.relayId;

  // Mode is blocked first, so no new automatic decision may be emitted. Two
  // confirmed OFF passes close an already in-flight Switch.Set from AUTO.
  await forceRelayOffAndConfirm(client, relayId);
  await forceRelayOffAndConfirm(client, relayId);

  return {
    installation: nextInstallation,
    status: await verifyModeWithRelayOff(nextInstallation, 'manual')
  };
};

export const resumeInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationActionResult> => {
  const prepared = await ensureInstalledAutomationRuntimeCurrent(installation);
  if (prepared.status.automationMode !== 'manual') {
    throw new Error('Automation must be in MANUAL before it can return to AUTO.');
  }

  const nextInstallation = prepared.installation;
  const client = new RpcShellyClient(
    createShellyTransport(nextInstallation.shelly.baseUrl)
  );
  await forceRelayOffAndConfirm(client, nextInstallation.config.output.relayId);
  await setInstalledAutomationRuntimeMode(nextInstallation, 'auto');

  return {
    installation: nextInstallation,
    status: await verifyModeWithRelayOff(nextInstallation, 'auto')
  };
};

export const recoverInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationActionResult> => {
  const recovered = await recoverInstalledAutomationRuntime(installation);
  return { installation: recovered.installation, status: recovered.status };
};

export const setInstalledAutomationRelayState = async (
  installation: ClimateInstalledAutomation,
  on: boolean
): Promise<InstalledAutomationActionResult> => {
  const initialStatus = await requireMatchedInstalledAutomation(installation);
  if (initialStatus.automationMode !== 'manual' || !initialStatus.runtimeModeSupported) {
    throw new Error('Manual relay control requires a live MANUAL automation runtime.');
  }

  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  const relayId = installation.config.output.relayId;
  unwrapShellyResult(
    on ? await client.setRelayOn({ relayId }) : await client.setRelayOff({ relayId })
  );

  const verified = await requireMatchedInstalledAutomation(installation);
  if (verified.automationMode !== 'manual' || verified.relayOn !== on) {
    throw new Error(`Shelly did not confirm relay ${on ? 'ON' : 'OFF'} in MANUAL mode.`);
  }
  return { installation, status: verified };
};

export const deleteInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<void> => {
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  const relayId = installation.config.output.relayId;
  const setup = await readShellySetupStatus(installation.shelly.baseUrl);
  const targetScript = setup.scripts.find(
    (script) => script.id === installation.script.id
  );
  const conflictingManagedScript = setup.scripts.find(
    (script) =>
      script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME &&
      script.id !== installation.script.id
  );

  if (targetScript && targetScript.name !== LOCAL_CLIMATE_LINK_SCRIPT_NAME) {
    throw new Error('Stored script id belongs to a different Shelly script.');
  }
  if (conflictingManagedScript) {
    throw new Error('Shelly contains another Local Climate Link automation script.');
  }

  await forceRelayOffAndConfirm(client, relayId);
  if (!targetScript) {
    return;
  }

  if (targetScript.running) {
    const stopResult = await client.stopScript(targetScript.id);
    await forceRelayOffAndConfirm(client, relayId);
    unwrapShellyResult(stopResult);
  }

  const deleteResult = await client.deleteScript(targetScript.id);
  await forceRelayOffAndConfirm(client, relayId);
  unwrapShellyResult(deleteResult);

  const verified = await readShellySetupStatus(installation.shelly.baseUrl);
  if (
    verified.status.relayOn ||
    verified.scripts.some((script) => script.id === installation.script.id)
  ) {
    throw new Error('Shelly did not confirm a safely deleted automation.');
  }
};

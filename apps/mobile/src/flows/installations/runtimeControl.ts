import { LOCAL_CLIMATE_LINK_SCRIPT_NAME, RpcShellyClient } from '@lcl/shelly-client';
import {
  createShellyTransport,
  readShellyControlStatus,
  readShellySetupStatus,
  unwrapShellyResult,
  type ShellyControlStatus
} from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';

export type InstalledAutomationScriptMatch = 'matched' | 'missing' | 'mismatch';

export const installedAutomationScriptMatch = (
  installation: ClimateInstalledAutomation,
  status: ShellyControlStatus
): InstalledAutomationScriptMatch => {
  if (status.automationScriptId === null) {
    return 'missing';
  }
  return status.automationScriptId === installation.script.id ? 'matched' : 'mismatch';
};

export const readInstalledAutomationControlStatus = (
  installation: ClimateInstalledAutomation
): Promise<ShellyControlStatus> => readShellyControlStatus(installation.shelly.baseUrl);

const forceRelayOffAndConfirm = async (
  client: RpcShellyClient,
  relayId: number
): Promise<void> => {
  unwrapShellyResult(await client.setRelayOff({ relayId }));
  const shellyStatus = unwrapShellyResult(await client.getStatus());
  if (shellyStatus.relayOn) {
    throw new Error('Shelly relay did not confirm OFF.');
  }
};

export const pauseInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<ShellyControlStatus> => {
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  const relayId = installation.config.output.relayId;

  // Never stop the controller while its output is still ON: if a later OFF RPC
  // failed, stopping first could leave an energized relay without automation.
  await forceRelayOffAndConfirm(client, relayId);
  const stopResult = await client.stopScript(installation.script.id);

  // Close the race where the script could reassert the relay between the first
  // OFF confirmation and Script.Stop. This also runs when Script.Stop reports
  // an RPC failure because Result errors are unwrapped only after the second OFF.
  await forceRelayOffAndConfirm(client, relayId);
  unwrapShellyResult(stopResult);

  const controlStatus = await readShellyControlStatus(installation.shelly.baseUrl);
  if (
    installedAutomationScriptMatch(installation, controlStatus) !== 'matched' ||
    controlStatus.automationMode !== 'manual' ||
    controlStatus.relayOn
  ) {
    throw new Error('Shelly did not confirm a safely paused automation.');
  }
  return controlStatus;
};

export const resumeInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<ShellyControlStatus> => {
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  unwrapShellyResult(
    await client.setRelayOff({ relayId: installation.config.output.relayId })
  );
  unwrapShellyResult(await client.startScript(installation.script.id));

  const controlStatus = await readShellyControlStatus(installation.shelly.baseUrl);
  if (
    installedAutomationScriptMatch(installation, controlStatus) !== 'matched' ||
    controlStatus.automationMode !== 'auto'
  ) {
    throw new Error('Shelly did not confirm a running automation.');
  }
  return controlStatus;
};

export const deleteInstalledAutomation = async (
  installation: ClimateInstalledAutomation
): Promise<void> => {
  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));
  const relayId = installation.config.output.relayId;
  const setup = await readShellySetupStatus(installation.shelly.baseUrl);
  const targetScript = setup.scripts.find((script) => script.id === installation.script.id);
  const conflictingManagedScript = setup.scripts.find(
    (script) =>
      script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME && script.id !== installation.script.id
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

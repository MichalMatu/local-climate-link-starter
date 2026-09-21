import { normalizeShellyDeviceId } from '@lcl/shelly-client';
import { unwrapShellyResult } from '../../../platform/shellyResult.js';
import type { TimeAutomationClients } from './timeAutomationClients.js';
import type { TimeAutomationRuntimeInstallation } from './timeAutomationRuntimeState.js';

export type OwnedTimeAutomationRuntimeInstallation = TimeAutomationRuntimeInstallation & {
  shelly: TimeAutomationRuntimeInstallation['shelly'] & { deviceId: string };
};

export const requireStoredTimeAutomationDeviceIdentity = async (
  installation: OwnedTimeAutomationRuntimeInstallation,
  clients: TimeAutomationClients
): Promise<void> => {
  const info = unwrapShellyResult(await clients.device.getDeviceInfo());
  const remoteDeviceId = info.id?.trim();
  if (
    !remoteDeviceId ||
    normalizeShellyDeviceId(remoteDeviceId) !==
      normalizeShellyDeviceId(installation.shelly.deviceId)
  ) {
    throw new Error('Shelly identity does not match the installed automation.');
  }
};

import {
  RpcShellyClient,
  type ShellyDeviceInfo,
  type ShellyStatus
} from '@lcl/shelly-client';
import { createVerifiedPlugSettingsTransport } from './plugSettingsTarget.js';
import { unwrapShellyResult } from '../../../platform/shellyResult.js';
import type { PlugSettingsTarget } from './plugSettingsTarget.js';

export type PlugInformation = {
  deviceInfo: ShellyDeviceInfo;
  status: ShellyStatus;
};

export const readPlugInformation = async (
  target: PlugSettingsTarget
): Promise<PlugInformation> => {
  const transport = await createVerifiedPlugSettingsTransport(target);
  const client = new RpcShellyClient(transport);
  const [deviceInfo, status] = await Promise.all([
    client.getDeviceInfo(),
    client.getStatus()
  ]);

  return {
    deviceInfo: unwrapShellyResult(deviceInfo),
    status: unwrapShellyResult(status)
  };
};

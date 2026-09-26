import type { ShellyDeviceInfo, ShellyStatus } from '@lcl/shelly-client';
import { unwrapShellyResult } from '../../../platform/shellyResult.js';
import {
  withVerifiedPlugReadOnlyClient,
  type PlugReadOnlyManagementDependencies,
  type PlugReadOnlyManagementTarget
} from './plugReadOnlyManagementTarget.js';
import type { SavedBlePlug } from './savedBlePlug.js';
import type { PlugSettingsTarget } from './plugSettingsTarget.js';

export type PlugInformation = {
  deviceInfo: ShellyDeviceInfo;
  status: ShellyStatus;
};

export const readPlugInformationFromTarget = async (
  target: PlugReadOnlyManagementTarget,
  dependencies?: PlugReadOnlyManagementDependencies
): Promise<PlugInformation> =>
  withVerifiedPlugReadOnlyClient(
    target,
    async (client) => {
      const [deviceInfo, status] = await Promise.all([
        client.getDeviceInfo(),
        client.getStatus()
      ]);

      return {
        deviceInfo: unwrapShellyResult(deviceInfo),
        status: unwrapShellyResult(status)
      };
    },
    dependencies
  );

export const readPlugInformation = async (
  target: PlugSettingsTarget
): Promise<PlugInformation> =>
  readPlugInformationFromTarget({
    transport: 'wifi',
    physicalId: target.deviceId,
    baseUrl: target.baseUrl
  });

export const readBlePlugInformation = async (
  plug: Pick<SavedBlePlug, 'physicalId' | 'bleDeviceId'>
): Promise<PlugInformation> =>
  readPlugInformationFromTarget({
    transport: 'bluetooth',
    physicalId: plug.physicalId,
    bleDeviceId: plug.bleDeviceId
  });

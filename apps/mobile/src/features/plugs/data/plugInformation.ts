import type { ShellyDeviceInfo, ShellyStatus } from '@lcl/shelly-client';
import { unwrapShellyResult } from '../../../platform/shellyResult.js';
import { unwrapBlePlugReadOnlyResult } from './blePlugReadOnlyError.js';
import {
  withVerifiedPlugReadOnlyClient,
  type PlugReadOnlyManagementDependencies,
  type PlugReadOnlyManagementTarget
} from './plugReadOnlyManagementTarget.js';
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
        deviceInfo:
          target.transport === 'bluetooth'
            ? unwrapBlePlugReadOnlyResult(deviceInfo)
            : unwrapShellyResult(deviceInfo),
        status:
          target.transport === 'bluetooth'
            ? unwrapBlePlugReadOnlyResult(status)
            : unwrapShellyResult(status)
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

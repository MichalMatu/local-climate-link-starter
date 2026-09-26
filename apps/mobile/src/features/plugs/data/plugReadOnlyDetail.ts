import {
  RpcShellyClient,
  RpcShellyCloudClient,
  RpcShellyPlugsUiClient,
  type ShellyCloudReadResult,
  type ShellyPlugsUiReadResult
} from '@lcl/shelly-client';
import { unwrapShellyResult } from '../../../platform/shellyResult.js';
import { unwrapBlePlugReadOnlyResult } from './blePlugReadOnlyError.js';
import type { PlugInformation } from './plugInformation.js';
import {
  withVerifiedPlugReadOnlyTransport,
  type PlugReadOnlyManagementDependencies,
  type PlugReadOnlyManagementTarget
} from './plugReadOnlyManagementTarget.js';
import type { SavedBlePlug } from './savedBlePlug.js';

export type PlugReadOnlyDetail = {
  information: PlugInformation;
  deviceSettings: ShellyPlugsUiReadResult;
  cloud: ShellyCloudReadResult;
};

export const readPlugReadOnlyDetailFromTarget = async (
  target: PlugReadOnlyManagementTarget,
  dependencies?: PlugReadOnlyManagementDependencies
): Promise<PlugReadOnlyDetail> =>
  withVerifiedPlugReadOnlyTransport(
    target,
    async (transport) => {
      const client = new RpcShellyClient(transport);
      const plugsUiClient = new RpcShellyPlugsUiClient(transport);
      const cloudClient = new RpcShellyCloudClient(transport);

      const deviceInfoResult = await client.getDeviceInfo();
      const statusResult = await client.getStatus();
      const deviceSettingsResult = await plugsUiClient.readConfig();
      const cloudResult = await cloudClient.readConfig();
      const unwrap =
        target.transport === 'bluetooth'
          ? unwrapBlePlugReadOnlyResult
          : unwrapShellyResult;

      return {
        information: {
          deviceInfo: unwrap(deviceInfoResult),
          status: unwrap(statusResult)
        },
        deviceSettings: unwrap(deviceSettingsResult),
        cloud: unwrap(cloudResult)
      };
    },
    dependencies
  );

export const readBlePlugReadOnlyDetail = async (
  plug: Pick<SavedBlePlug, 'physicalId' | 'bleDeviceId'>
): Promise<PlugReadOnlyDetail> =>
  readPlugReadOnlyDetailFromTarget({
    transport: 'bluetooth',
    physicalId: plug.physicalId,
    bleDeviceId: plug.bleDeviceId
  });

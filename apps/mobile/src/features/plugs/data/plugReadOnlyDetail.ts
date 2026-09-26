import {
  RpcShellyClient,
  RpcShellyPlugsUiClient,
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

      const deviceInfoResult = await client.getDeviceInfo();
      const statusResult = await client.getStatus();
      const deviceSettingsResult = await plugsUiClient.readConfig();
      const unwrap = target.transport === 'bluetooth' ? unwrapBlePlugReadOnlyResult : unwrapShellyResult;

      return {
        information: {
          deviceInfo: unwrap(deviceInfoResult),
          status: unwrap(statusResult)
        },
        deviceSettings: unwrap(deviceSettingsResult)
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

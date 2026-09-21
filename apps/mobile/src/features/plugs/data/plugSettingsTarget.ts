import {
  normalizeShellyDeviceId,
  RpcShellyClient,
  RpcShellyPlugsUiClient,
  type Result
} from '@lcl/shelly-client';
import { createShellyTransport } from '../../../platform/shellyHttpTransport.js';

export type PlugSettingsTarget = {
  deviceId: string;
  baseUrl: string;
};

export const unwrapPlugSettingsResult = <T>(result: Result<T>): T => {
  if (result.ok) return result.value;
  throw new Error(
    result.error.technicalMessage ??
      result.error.userMessageKey ??
      'Shelly PLUGS_UI request failed.'
  );
};

export const createVerifiedPlugUiClient = async (target: PlugSettingsTarget) => {
  const transport = createShellyTransport(target.baseUrl);
  const info = unwrapPlugSettingsResult(await new RpcShellyClient(transport).getDeviceInfo());
  const remoteDeviceId = info.id?.trim();
  if (!remoteDeviceId) {
    throw new Error('Shelly did not expose a stable device id.');
  }
  if (
    normalizeShellyDeviceId(remoteDeviceId) !== normalizeShellyDeviceId(target.deviceId)
  ) {
    throw new Error('Shelly identity does not match the saved Plug.');
  }
  return new RpcShellyPlugsUiClient(transport);
};

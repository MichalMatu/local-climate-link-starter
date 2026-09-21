import {
  normalizeShellyDeviceId,
  RpcShellyClient,
  RpcShellyPlugsUiClient,
  type Result,
  type ShellyRpcTransport
} from '@lcl/shelly-client';
import { createShellyTransport } from '../../../platform/shellyHttpTransport.js';

export type PlugSettingsTarget = {
  deviceId: string;
  baseUrl: string;
};

export const unwrapPlugSettingsResult = <T>(result: Result<T>): T => {
  if (result.ok) return result.value;
  throw new Error(
    result.error.technicalMessage ?? result.error.userMessageKey ?? 'Shelly settings request failed.'
  );
};

export const createVerifiedPlugSettingsTransport = async (
  target: PlugSettingsTarget
): Promise<ShellyRpcTransport> => {
  const transport = createShellyTransport(target.baseUrl);
  const info = unwrapPlugSettingsResult(
    await new RpcShellyClient(transport).getDeviceInfo()
  );
  const remoteDeviceId = info.id?.trim();
  if (!remoteDeviceId) {
    throw new Error('Shelly did not expose a stable device id.');
  }
  if (
    normalizeShellyDeviceId(remoteDeviceId) !== normalizeShellyDeviceId(target.deviceId)
  ) {
    throw new Error('Shelly identity does not match the saved Plug.');
  }
  return transport;
};

export const createVerifiedPlugUiClient = async (target: PlugSettingsTarget) =>
  new RpcShellyPlugsUiClient(await createVerifiedPlugSettingsTransport(target));

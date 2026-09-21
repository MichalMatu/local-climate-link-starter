import {
  normalizeShellyDeviceId,
  RpcShellyClient,
  RpcShellyPlugsUiClient,
  type Result,
  type ShellyPlugsUiLedsPatch,
  type ShellyPlugsUiReadResult,
  type ShellyRpcTransport
} from '@lcl/shelly-client';
import { createShellyTransport } from '../../../platform/shellyHttpTransport.js';

export type PlugLedSettingsTarget = {
  deviceId: string;
  baseUrl: string;
};

const unwrap = <T>(result: Result<T>): T => {
  if (result.ok) return result.value;
  throw new Error(
    result.error.technicalMessage ??
      result.error.userMessageKey ??
      'Shelly PLUGS_UI request failed.'
  );
};

const verifyTargetIdentity = async (
  target: PlugLedSettingsTarget,
  transport: ShellyRpcTransport
) => {
  const info = unwrap(await new RpcShellyClient(transport).getDeviceInfo());
  const remoteDeviceId = info.id?.trim();
  if (!remoteDeviceId) {
    throw new Error('Shelly did not expose a stable device id.');
  }
  if (
    normalizeShellyDeviceId(remoteDeviceId) !== normalizeShellyDeviceId(target.deviceId)
  ) {
    throw new Error('Shelly identity does not match the saved Plug.');
  }
};

export const readPlugLedSettings = async (
  target: PlugLedSettingsTarget
): Promise<ShellyPlugsUiReadResult> => {
  const transport = createShellyTransport(target.baseUrl);
  await verifyTargetIdentity(target, transport);
  return unwrap(await new RpcShellyPlugsUiClient(transport).read());
};

export const updatePlugLedSettings = async (
  target: PlugLedSettingsTarget,
  patch: ShellyPlugsUiLedsPatch
): Promise<ShellyPlugsUiReadResult> => {
  const transport = createShellyTransport(target.baseUrl);
  await verifyTargetIdentity(target, transport);
  const client = new RpcShellyPlugsUiClient(transport);
  unwrap(await client.setLeds(patch));
  return unwrap(await client.read());
};

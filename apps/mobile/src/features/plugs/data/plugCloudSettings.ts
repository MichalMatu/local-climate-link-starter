import { RpcShellyCloudClient, type ShellyCloudReadResult } from '@lcl/shelly-client';
import {
  createVerifiedPlugSettingsTransport,
  type PlugSettingsTarget,
  unwrapPlugSettingsResult
} from './plugSettingsTarget.js';

export type PlugCloudSettingsTarget = PlugSettingsTarget;
export type PlugCloudSettingsReadResult =
  { supported: false } | { supported: true; enabled: boolean; connected: boolean };

const cloudSettings = (settings: ShellyCloudReadResult): PlugCloudSettingsReadResult =>
  settings.supported
    ? {
        supported: true,
        enabled: settings.config.enable,
        connected: settings.status.connected
      }
    : { supported: false };

const createVerifiedCloudClient = async (target: PlugCloudSettingsTarget) =>
  new RpcShellyCloudClient(await createVerifiedPlugSettingsTransport(target));

export const readPlugCloudSettings = async (
  target: PlugCloudSettingsTarget
): Promise<PlugCloudSettingsReadResult> => {
  const client = await createVerifiedCloudClient(target);
  return cloudSettings(unwrapPlugSettingsResult(await client.read()));
};

export const updatePlugCloudSettings = async (
  target: PlugCloudSettingsTarget,
  enabled: boolean
): Promise<PlugCloudSettingsReadResult> => {
  const client = await createVerifiedCloudClient(target);
  unwrapPlugSettingsResult(await client.setEnabled(enabled));
  return cloudSettings(unwrapPlugSettingsResult(await client.read()));
};

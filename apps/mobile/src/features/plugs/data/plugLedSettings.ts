import type { ShellyPlugsUiLedsPatch, ShellyPlugsUiReadResult } from '@lcl/shelly-client';
import {
  createVerifiedPlugUiClient,
  type PlugSettingsTarget,
  unwrapPlugSettingsResult
} from './plugSettingsTarget.js';

export type PlugLedSettingsTarget = PlugSettingsTarget;

export const readPlugLedSettings = async (
  target: PlugLedSettingsTarget
): Promise<ShellyPlugsUiReadResult> => {
  const client = await createVerifiedPlugUiClient(target);
  return unwrapPlugSettingsResult(await client.read());
};

export const updatePlugLedSettings = async (
  target: PlugLedSettingsTarget,
  patch: ShellyPlugsUiLedsPatch
): Promise<ShellyPlugsUiReadResult> => {
  const client = await createVerifiedPlugUiClient(target);
  unwrapPlugSettingsResult(await client.setLeds(patch));
  return unwrapPlugSettingsResult(await client.read());
};

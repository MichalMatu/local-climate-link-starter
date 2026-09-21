import type {
  ShellyPlugsUiButtonInputMode,
  ShellyPlugsUiReadResult
} from '@lcl/shelly-client';
import {
  createVerifiedPlugUiClient,
  type PlugSettingsTarget,
  unwrapPlugSettingsResult
} from './plugSettingsTarget.js';

export type PlugButtonModeSettingsTarget = PlugSettingsTarget;
export type PlugButtonModeSettingsReadResult =
  { supported: false } | { supported: true; mode: ShellyPlugsUiButtonInputMode };

const buttonModeSettings = (
  settings: ShellyPlugsUiReadResult
): PlugButtonModeSettingsReadResult => {
  if (!settings.supported || !settings.controlCapabilities.buttonInputMode) {
    return { supported: false };
  }
  const mode = settings.config.controls?.['switch:0']?.in_mode;
  return mode ? { supported: true, mode } : { supported: false };
};

export const readPlugButtonModeSettings = async (
  target: PlugButtonModeSettingsTarget
): Promise<PlugButtonModeSettingsReadResult> => {
  const client = await createVerifiedPlugUiClient(target);
  return buttonModeSettings(unwrapPlugSettingsResult(await client.read()));
};

export const updatePlugButtonModeSettings = async (
  target: PlugButtonModeSettingsTarget,
  mode: ShellyPlugsUiButtonInputMode
): Promise<PlugButtonModeSettingsReadResult> => {
  const client = await createVerifiedPlugUiClient(target);
  unwrapPlugSettingsResult(await client.setButtonInputMode(mode));
  return buttonModeSettings(unwrapPlugSettingsResult(await client.read()));
};

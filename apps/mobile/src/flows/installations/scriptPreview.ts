import { readShellyAutomationScriptState } from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';

export const installedAutomationScriptSourceQueryKey = (
  installation: ClimateInstalledAutomation
) => [
  'installed-automation-script-source',
  installation.shelly.baseUrl,
  installation.script.id
] as const;

export const loadInstalledAutomationScriptSource = async (
  installation: ClimateInstalledAutomation
): Promise<string> => {
  const state = await readShellyAutomationScriptState(installation.shelly.baseUrl);

  if (state.script?.id !== installation.script.id || state.code === null) {
    throw new Error('Shelly did not return the exact managed automation script.');
  }

  return state.code;
};

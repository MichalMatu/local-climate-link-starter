import { createShellyTransport } from '../hardware-setup/shellyRequests.js';
import {
  readClimateMode,
  writeClimateMode,
  type ClimateRuntimeMode
} from '../runtime/modeProtocol.js';
import type { ClimateInstalledAutomation } from './model.js';

export type InstalledAutomationRuntimeMode = ClimateRuntimeMode;
export type InstalledAutomationRuntimeModeState = {
  mode: ClimateRuntimeMode;
  supported: boolean;
};
export const readInstalledAutomationRuntimeMode = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationRuntimeModeState> => {
  const mode = await readClimateMode(
    createShellyTransport(installation.shelly.baseUrl),
    installation.script.id
  );
  return { mode: mode ?? 'auto', supported: mode !== null };
};
export const setInstalledAutomationRuntimeMode = (
  installation: ClimateInstalledAutomation,
  mode: ClimateRuntimeMode
): Promise<void> =>
  writeClimateMode(
    createShellyTransport(installation.shelly.baseUrl),
    installation.script.id,
    mode
  );

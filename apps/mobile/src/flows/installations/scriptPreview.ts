import { readShellyManagedAutomationScriptCode } from '../../features/automations/index.js';
import type { ClimateInstalledAutomation } from './model.js';

export const installedAutomationScriptSourceQueryKey = (
  installation: ClimateInstalledAutomation
) =>
  [
    'installed-automation-script-source',
    installation.shelly.baseUrl,
    installation.script.id
  ] as const;

export const loadInstalledAutomationScriptSource = (
  installation: ClimateInstalledAutomation
): Promise<string> =>
  readShellyManagedAutomationScriptCode(
    installation.shelly.baseUrl,
    installation.script.id
  );

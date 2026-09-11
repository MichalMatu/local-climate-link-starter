import type { ShellyControlStatus } from '../hardware-setup/shellyRequests.js';
import { readShellyControlStatus } from '../hardware-setup/shellyRequests.js';
import type { ClimateInstalledAutomation } from './model.js';
import { readInstalledAutomationRuntimeMode } from './runtimeModeTransport.js';

export type InstalledAutomationControlMode = 'auto' | 'manual' | 'stopped' | 'missing';

export type InstalledAutomationControlStatus = Omit<
  ShellyControlStatus,
  'automationMode'
> & {
  automationMode: InstalledAutomationControlMode;
  runtimeModeSupported: boolean;
};

const nonRunningMode = (status: ShellyControlStatus): InstalledAutomationControlMode =>
  status.automationMode === 'manual' ? 'stopped' : status.automationMode;

export const readInstalledAutomationControlStatus = async (
  installation: ClimateInstalledAutomation
): Promise<InstalledAutomationControlStatus> => {
  const status = await readShellyControlStatus(installation.shelly.baseUrl);
  if (
    status.automationScriptId === null ||
    status.automationScriptId !== installation.script.id ||
    status.automationMode !== 'auto'
  ) {
    return {
      ...status,
      automationMode: nonRunningMode(status),
      runtimeModeSupported: false
    };
  }

  const runtime = await readInstalledAutomationRuntimeMode(installation);
  return {
    ...status,
    automationMode: runtime.mode,
    runtimeModeSupported: runtime.supported
  };
};

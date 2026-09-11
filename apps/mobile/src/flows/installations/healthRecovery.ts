import type { InstalledAutomationControlMode } from './runtimeStatus.js';
import type { InstalledAutomationHealth } from './runtimeDiagnostics.js';
import type { InstalledAutomationScriptMatch } from './runtimeControl.js';

export type InstallationRecoveryIssue =
  'offline' | 'script-stopped' | 'sensor-missing' | 'ownership-problem';

export type InstallationRecoveryAction = 'refresh' | 'resume';

export type InstallationRecoveryState = {
  issue: InstallationRecoveryIssue;
  action: InstallationRecoveryAction;
};

type InstallationRecoveryInput = {
  diagnosticsError: boolean;
  controlError: boolean;
  scriptMatch: InstalledAutomationScriptMatch | null;
  automationMode: InstalledAutomationControlMode | null;
  runtimeHealth: InstalledAutomationHealth | null;
};

export const installationRecoveryState = ({
  diagnosticsError,
  controlError,
  scriptMatch,
  automationMode,
  runtimeHealth
}: InstallationRecoveryInput): InstallationRecoveryState | null => {
  if (diagnosticsError && controlError) {
    return { issue: 'offline', action: 'refresh' };
  }

  if (scriptMatch && scriptMatch !== 'matched') {
    return { issue: 'ownership-problem', action: 'refresh' };
  }

  if (scriptMatch === 'matched' && automationMode === 'stopped') {
    return { issue: 'script-stopped', action: 'resume' };
  }

  if (runtimeHealth === 'stale') {
    return { issue: 'sensor-missing', action: 'refresh' };
  }

  return null;
};

import { useQuery } from '@tanstack/react-query';
import type { ClimateInstalledAutomation } from './model.js';
import { fetchInstalledAutomationDiagnostics } from './runtimeDiagnostics.js';
import { readInstalledAutomationControlStatus } from './runtimeControl.js';

const installationQueryIdentity = (installation: ClimateInstalledAutomation) =>
  [
    installation.id,
    installation.shelly.baseUrl,
    installation.script.id,
    installation.script.hash,
    installation.updatedAtMs
  ] as const;

export const installedAutomationDiagnosticsQueryKey = (
  installation: ClimateInstalledAutomation
) =>
  [
    'installed-automation-diagnostics',
    ...installationQueryIdentity(installation)
  ] as const;

export const installedAutomationControlQueryKey = (
  installation: ClimateInstalledAutomation
) =>
  ['installed-automation-control', ...installationQueryIdentity(installation)] as const;

export const useInstalledAutomationDiagnostics = (
  installation: ClimateInstalledAutomation,
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    queryKey: installedAutomationDiagnosticsQueryKey(installation),
    queryFn: () => fetchInstalledAutomationDiagnostics(installation),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false
  });

export const useInstalledAutomationControl = (
  installation: ClimateInstalledAutomation,
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    queryKey: installedAutomationControlQueryKey(installation),
    queryFn: () => readInstalledAutomationControlStatus(installation),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false
  });

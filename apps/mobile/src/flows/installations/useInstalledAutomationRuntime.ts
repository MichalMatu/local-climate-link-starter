import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClimateInstalledAutomation } from './model.js';
import { fetchInstalledAutomationDiagnostics } from './runtimeDiagnostics.js';
import {
  pauseInstalledAutomation,
  readInstalledAutomationControlStatus,
  resumeInstalledAutomation,
  setInstalledAutomationRelayState
} from './runtimeControl.js';

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
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
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
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

export type InstalledAutomationControlAction = 'auto' | 'manual' | 'on' | 'off';

export const useInstalledAutomationActions = (
  installation: ClimateInstalledAutomation
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: InstalledAutomationControlAction) => {
      switch (action) {
        case 'auto':
          return resumeInstalledAutomation(installation);
        case 'manual':
          return pauseInstalledAutomation(installation);
        case 'on':
          return setInstalledAutomationRelayState(installation, true);
        case 'off':
          return setInstalledAutomationRelayState(installation, false);
      }
    },
    onSuccess: (status) => {
      queryClient.setQueryData(installedAutomationControlQueryKey(installation), status);
      void queryClient.invalidateQueries({
        queryKey: installedAutomationDiagnosticsQueryKey(installation)
      });
    }
  });
};

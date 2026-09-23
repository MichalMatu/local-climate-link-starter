import { useQuery } from '@tanstack/react-query';
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

export const useInstalledAutomationScriptSource = (
  installation: ClimateInstalledAutomation,
  enabled: boolean
) =>
  useQuery({
    queryKey: installedAutomationScriptSourceQueryKey(installation),
    queryFn: () => loadInstalledAutomationScriptSource(installation),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0
  });

export const copyInstalledAutomationScriptSource = (
  source: string | undefined,
  onSuccess: () => void,
  onError: () => void
): void => {
  if (!source || typeof navigator === 'undefined' || !navigator.clipboard) {
    onError();
    return;
  }
  void navigator.clipboard.writeText(source).then(onSuccess).catch(onError);
};

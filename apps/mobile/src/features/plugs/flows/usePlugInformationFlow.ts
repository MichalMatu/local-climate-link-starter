import { useQuery } from '@tanstack/react-query';
import type { PlugSettingsTarget } from '../data/plugSettingsTarget.js';
import { readPlugInformation } from '../data/plugInformation.js';

export const plugInformationQueryKey = (target: PlugSettingsTarget) =>
  ['plug-information', target.deviceId, target.baseUrl] as const;

export const usePlugInformationFlow = (
  target: PlugSettingsTarget,
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    queryKey: plugInformationQueryKey(target),
    queryFn: () => readPlugInformation(target),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

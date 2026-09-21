import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  readPlugCloudSettings,
  updatePlugCloudSettings,
  type PlugCloudSettingsTarget
} from '../data/plugCloudSettings.js';

export const plugCloudSettingsQueryKey = (target: PlugCloudSettingsTarget) =>
  ['plug-cloud-settings', target.deviceId, target.baseUrl] as const;

export const usePlugCloudSettingsFlow = (target: PlugCloudSettingsTarget) => {
  const queryClient = useQueryClient();
  const queryKey = plugCloudSettingsQueryKey(target);
  const query = useQuery({
    queryKey,
    queryFn: () => readPlugCloudSettings(target),
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
  const updateMutation = useMutation({
    mutationFn: (enabled: boolean) => updatePlugCloudSettings(target, enabled),
    onSuccess: (settings) => queryClient.setQueryData(queryKey, settings)
  });

  return { query, updateMutation };
};

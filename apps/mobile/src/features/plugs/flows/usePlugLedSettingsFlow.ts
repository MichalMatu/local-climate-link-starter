import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ShellyPlugsUiLedsPatch } from '@lcl/shelly-client';
import {
  readPlugLedSettings,
  updatePlugLedSettings,
  type PlugLedSettingsTarget
} from '../data/plugLedSettings.js';

export const plugLedSettingsQueryKey = (target: PlugLedSettingsTarget) =>
  ['plug-led-settings', target.deviceId, target.baseUrl] as const;

export const usePlugLedSettingsFlow = (target: PlugLedSettingsTarget) => {
  const queryClient = useQueryClient();
  const queryKey = plugLedSettingsQueryKey(target);
  const query = useQuery({
    queryKey,
    queryFn: () => readPlugLedSettings(target),
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
  const updateMutation = useMutation({
    mutationFn: (patch: ShellyPlugsUiLedsPatch) => updatePlugLedSettings(target, patch),
    onSuccess: (settings) => queryClient.setQueryData(queryKey, settings)
  });

  return { query, updateMutation };
};

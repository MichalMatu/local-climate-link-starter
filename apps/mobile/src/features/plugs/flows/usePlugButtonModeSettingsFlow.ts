import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ShellyPlugsUiButtonInputMode } from '@lcl/shelly-client';
import {
  readPlugButtonModeSettings,
  updatePlugButtonModeSettings,
  type PlugButtonModeSettingsTarget
} from '../data/plugButtonModeSettings.js';

export const plugButtonModeSettingsQueryKey = (target: PlugButtonModeSettingsTarget) =>
  ['plug-button-mode-settings', target.deviceId, target.baseUrl] as const;

export const usePlugButtonModeSettingsFlow = (target: PlugButtonModeSettingsTarget) => {
  const queryClient = useQueryClient();
  const queryKey = plugButtonModeSettingsQueryKey(target);
  const query = useQuery({
    queryKey,
    queryFn: () => readPlugButtonModeSettings(target),
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
  const updateMutation = useMutation({
    mutationFn: (mode: ShellyPlugsUiButtonInputMode) =>
      updatePlugButtonModeSettings(target, mode),
    onSuccess: (settings) => queryClient.setQueryData(queryKey, settings)
  });

  return { query, updateMutation };
};

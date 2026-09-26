import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import { setBlePlugRelay, type BlePlugRuntimeStatus } from '../data/blePlugRuntime.js';
import { useSavedBlePlugStore } from '../state/savedBlePlugStore.js';
import { readSavedBlePlugRuntimeStatus } from './readSavedBlePlugRuntimeStatus.js';

export const SAVED_BLE_PLUG_RUNTIME_REFRESH_MS = 5_000;

export const savedBlePlugRuntimeQueryKey = (
  plug: Pick<SavedBlePlug, 'physicalId' | 'bleDeviceId'>
) => ['saved-ble-plug-runtime', plug.physicalId, plug.bleDeviceId] as const;

type SavedBlePlugRuntimeOptions = {
  enabled?: boolean;
  refetchIntervalMs?: number;
};

export const useSavedBlePlugRuntime = (
  plug: SavedBlePlug,
  options: SavedBlePlugRuntimeOptions = {}
) => {
  const queryClient = useQueryClient();
  const replaceLocator = useSavedBlePlugStore((state) => state.replaceLocator);
  const queryKey = savedBlePlugRuntimeQueryKey(plug);
  const query = useQuery({
    queryKey,
    queryFn: () =>
      readSavedBlePlugRuntimeStatus(plug, {
        persistLocator: replaceLocator
      }),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: options.refetchIntervalMs ?? SAVED_BLE_PLUG_RUNTIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  const relayMutation = useMutation({
    mutationFn: async (relayOn: boolean) => {
      await setBlePlugRelay(plug, relayOn);
      return relayOn;
    },
    retry: false,
    onMutate: async (relayOn) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BlePlugRuntimeStatus>(queryKey);
      if (previous) {
        queryClient.setQueryData<BlePlugRuntimeStatus>(queryKey, {
          ...previous,
          relayOn
        });
      }
      return { previous };
    },
    onError: (_error, _relayOn, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    }
  });

  return {
    status: query.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    statusError: query.error ?? null,
    isRelayPending: relayMutation.isPending,
    isRelayError: relayMutation.isError,
    relayError: relayMutation.error ?? null,
    turnRelayOn: () => relayMutation.mutate(true),
    turnRelayOff: () => relayMutation.mutate(false)
  };
};

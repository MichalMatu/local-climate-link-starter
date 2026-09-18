import { RpcShellyClient } from '@lcl/shelly-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  createShellyTransport,
  readShellyRuntimeStatus,
  type ShellyRuntimeStatus,
  unwrapShellyResult
} from './shellyRequests.js';
import type { ShellyDraftDevice } from './setupDraftStore.js';

export const PLAIN_SHELLY_RUNTIME_REFRESH_MS = 5000;
const PLAIN_SHELLY_RUNTIME_SETTLE_MS = 1000;

export const plainShellyRuntimeQueryKey = (
  device: Pick<ShellyDraftDevice, 'id' | 'baseUrl'>
) => ['plain-shelly-runtime', device.id, device.baseUrl] as const;

type PlainShellyRuntimeOptions = {
  enabled?: boolean;
  refetchIntervalMs?: number;
};

export const usePlainShellyRuntime = (
  device: Pick<ShellyDraftDevice, 'id' | 'baseUrl'>,
  options: PlainShellyRuntimeOptions = {}
) => {
  const queryClient = useQueryClient();
  const settleTimerRef = useRef<number | null>(null);
  const queryKey = plainShellyRuntimeQueryKey(device);
  const query = useQuery({
    queryKey,
    queryFn: () => readShellyRuntimeStatus(device.baseUrl),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: options.refetchIntervalMs ?? PLAIN_SHELLY_RUNTIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    },
    []
  );

  const relayMutation = useMutation({
    mutationFn: async (relayOn: boolean) => {
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      unwrapShellyResult(
        relayOn ? await client.setRelayOn() : await client.setRelayOff()
      );
      return relayOn;
    },
    onMutate: async (relayOn) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ShellyRuntimeStatus>(queryKey);
      if (previous) {
        queryClient.setQueryData<ShellyRuntimeStatus>(queryKey, {
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
      settleTimerRef.current = window.setTimeout(() => {
        settleTimerRef.current = null;
        void queryClient.refetchQueries({ queryKey, type: 'active' });
      }, PLAIN_SHELLY_RUNTIME_SETTLE_MS);
    }
  });

  return {
    status: query.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    isRelayPending: relayMutation.isPending,
    turnRelayOn: () => relayMutation.mutate(true),
    turnRelayOff: () => relayMutation.mutate(false)
  };
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { usePlugStore, useRuleStore } from '../../registry/devicesAndRules.js';
import type { AutomationRule } from '../../rules/model.js';
import type { SavedPlug } from './model.js';
import { createPlugManagement } from './management.js';

const management = createPlugManagement({
  readPlugs: usePlugStore.getState,
  readRules: useRuleStore.getState
});

export const plugRuntimeQueryKey = (id: string, baseUrl: string) =>
  ['plug-runtime', id, baseUrl] as const;

export const usePlugRuntimeQuery = (
  plug: SavedPlug | null,
  rules: readonly AutomationRule[],
  enabled = true
) =>
  useQuery({
    queryKey: [...plugRuntimeQueryKey(plug?.id ?? '', plug?.baseUrl ?? ''), rules],
    enabled: enabled && plug !== null,
    retry: false,
    queryFn: () => management.refresh(plug!.id)
  });

export const usePlugManagementFlow = () => {
  const queryClient = useQueryClient();
  const plugs = usePlugStore((state) => state.items);
  const rules = useRuleStore((state) => state.items);
  const loadError = usePlugStore((state) => state.loadError);
  const rulesLoadError = useRuleStore((state) => state.loadError);
  const [selectedPlugId, selectPlug] = useState<string | null>(null);
  const selectedPlug = plugs.find((plug) => plug.id === selectedPlugId) ?? null;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['plug-runtime'] });
  };
  const registration = useMutation({
    mutationFn: ({ baseUrl, name }: { baseUrl: string; name: string }) =>
      management.register(baseUrl, name),
    onSuccess: async (result) => {
      if (result.ok) selectPlug(result.value.id);
      await invalidate();
    }
  });
  const runtime = usePlugRuntimeQuery(selectedPlug, rules, !loadError && !rulesLoadError);
  const relay = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => management.setRelay(id, on),
    onSettled: invalidate
  });
  const orphanRemoval = useMutation({
    mutationFn: ({ id, scriptId }: { id: string; scriptId: number }) =>
      management.deleteOrphan(id, scriptId),
    onSettled: invalidate
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      management.rename(id, name),
    onSettled: invalidate
  });
  const removal = useMutation({
    mutationFn: (id: string) => management.remove(id),
    onSuccess: async (result, id) => {
      if (result.ok) {
        queryClient.removeQueries({ queryKey: ['plug-runtime', id] });
        if (selectedPlugId === id) selectPlug(null);
      }
      await invalidate();
    }
  });

  const snapshot = runtime.data?.ok ? runtime.data.value : null;
  const runtimeError = runtime.data && !runtime.data.ok ? runtime.data.error : null;
  return {
    plugs,
    rules,
    selectedPlug,
    selectPlug,
    loadError: loadError ?? rulesLoadError,
    registration,
    runtime,
    snapshot,
    relay,
    orphanRemoval,
    rename,
    removal,
    runtimeError,
    canControlRelay:
      !loadError &&
      !rulesLoadError &&
      !runtime.isError &&
      snapshot?.ownership.status === 'no-conflict' &&
      !runtime.isFetching &&
      !relay.isPending &&
      !orphanRemoval.isPending
  };
};

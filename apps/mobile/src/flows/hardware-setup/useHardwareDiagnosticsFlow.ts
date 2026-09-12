import { useMutation } from '@tanstack/react-query';
import { RPC_METHODS, scriptStatusSchema } from '@lcl/shelly-client';
import { useState } from 'react';
import { t } from '../../app/i18n.js';
import {
  readShellyResourceDiagnostics,
  type ShellyResourceDiagnostics
} from './resourceDiagnostics.js';
import { diagnosticSnapshotSchema, type HardwareDiagnosticSnapshot } from './schemas.js';
import {
  createShellyTransport,
  fetchShellyJson,
  unwrapShellyResult
} from './shellyRequests.js';
import type { ShellyDraftDevice } from './setupDraftStore.js';
import { toNumberOrFallback } from './validation.js';

export const resolveScriptDiagnosticStatusMessage = (payload: unknown): string | null => {
  const parsed = scriptStatusSchema.safeParse(payload);
  if (
    !parsed.success ||
    parsed.data.running === true ||
    (parsed.data.running === undefined &&
      parsed.data.error === undefined &&
      parsed.data.errors === undefined)
  ) {
    return null;
  }

  const status = parsed.data.errors?.map(String).join(', ') || 'stopped';
  return status.includes('out_of_memory')
    ? t('hardware.diagnostics.scriptOutOfMemory')
    : t('hardware.diagnostics.scriptNotRunning', { status });
};

const diagnosticScriptStatusMessage = async (
  baseUrl: string,
  scriptId: number
): Promise<string | null> => {
  const response = await createShellyTransport(baseUrl).call<unknown>({
    method: RPC_METHODS.ScriptGetStatus,
    params: { id: scriptId }
  });
  if (!response.ok) {
    return null;
  }

  return resolveScriptDiagnosticStatusMessage(unwrapShellyResult(response));
};

export const useHardwareDiagnosticsFlow = (
  diagnosticShelly: ShellyDraftDevice | null
) => {
  const [diagnosticSnapshot, setDiagnosticSnapshot] =
    useState<HardwareDiagnosticSnapshot | null>(null);
  const [diagnosticResources, setDiagnosticResources] =
    useState<ShellyResourceDiagnostics | null>(null);
  const [diagnosticFetchedAtMs, setDiagnosticFetchedAtMs] = useState<number | null>(null);

  const clearDiagnosticSnapshot = () => {
    setDiagnosticSnapshot(null);
    setDiagnosticResources(null);
    setDiagnosticFetchedAtMs(null);
  };

  const defaultScriptId = () =>
    Math.trunc(toNumberOrFallback(diagnosticShelly?.scriptIdInput ?? '1', 1));

  const fetchDiagnostics = async (
    scriptId = defaultScriptId()
  ): Promise<HardwareDiagnosticSnapshot> => {
    if (!diagnosticShelly) {
      throw new Error(t('hardware.flow.noSelectedDiagnosticShelly'));
    }
    const endpoint = new URL(`/script/${scriptId}/diag`, diagnosticShelly.baseUrl);
    try {
      const payload = await fetchShellyJson(endpoint, 5000);
      const parsed = diagnosticSnapshotSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.message);
      }
      return parsed.data;
    } catch {
      const scriptStatusMessage = await diagnosticScriptStatusMessage(
        diagnosticShelly.baseUrl,
        scriptId
      ).catch(() => null);
      throw new Error(scriptStatusMessage ?? t('hardware.diagnostics.readFailed'));
    }
  };

  const diagnosticMutation = useMutation({
    mutationFn: fetchDiagnostics,
    onSuccess: (snapshot) => {
      setDiagnosticSnapshot(snapshot);
      setDiagnosticFetchedAtMs(Date.now());
    }
  });

  const diagnosticResourceMutation = useMutation<
    ShellyResourceDiagnostics,
    Error,
    number | undefined
  >({
    mutationFn: async (
      scriptId = defaultScriptId()
    ): Promise<ShellyResourceDiagnostics> => {
      if (!diagnosticShelly) {
        throw new Error(t('hardware.flow.noSelectedDiagnosticShelly'));
      }
      return readShellyResourceDiagnostics(diagnosticShelly.baseUrl, scriptId);
    },
    onSuccess: (resources) => setDiagnosticResources(resources)
  });

  const refreshDiagnostics = (scriptId?: number) => {
    diagnosticMutation.mutate(scriptId);
    diagnosticResourceMutation.mutate(scriptId);
  };

  return {
    diagnosticSnapshot,
    diagnosticResources,
    diagnosticFetchedAtMs,
    clearDiagnosticSnapshot,
    diagnosticMutation,
    diagnosticResourceMutation,
    refreshDiagnostics
  };
};

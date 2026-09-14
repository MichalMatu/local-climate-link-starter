import { useQuery } from '@tanstack/react-query';
import type { SavedPlug } from '../devices/plugs/model.js';
import {
  diagnosticSnapshotSchema,
  type HardwareDiagnosticSnapshot
} from '../hardware-setup/schemas.js';
import { fetchShellyJson } from '../hardware-setup/shellyRequests.js';
import type { ClimateRule } from './model.js';

export const climateRuleDiagnosticsQueryKey = (
  ruleId: string,
  baseUrl: string,
  scriptId: number | null
) => ['climate-rule-diagnostics', ruleId, baseUrl, scriptId] as const;

export const useClimateRuleDiagnostics = (rule: ClimateRule | null, plug: SavedPlug) =>
  useQuery<HardwareDiagnosticSnapshot>({
    queryKey: climateRuleDiagnosticsQueryKey(
      rule?.id ?? '',
      plug.baseUrl,
      rule?.deployment?.scriptId ?? null
    ),
    enabled: Boolean(rule?.deployment),
    retry: false,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!rule?.deployment) throw new Error('Climate rule is not deployed.');
      const endpoint = new URL(`/script/${rule.deployment.scriptId}/diag`, plug.baseUrl);
      const payload = await fetchShellyJson(endpoint, 5000);
      const parsed = diagnosticSnapshotSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.message);
      return parsed.data;
    }
  });

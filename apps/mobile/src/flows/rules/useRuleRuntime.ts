import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePlugStore, useRuleStore } from '../registry/devicesAndRules.js';
import {
  deleteRule,
  deployRule,
  pauseRule,
  recoverRule,
  resumeRule,
  setRuleRelay,
  verifyRule
} from './lifecycle.js';
import { readClimateRuleRuntime } from './climateRuntime.js';
import { readTimeRuleRuntime } from './timeRuntime.js';

export const ruleRuntimeQueryKey = (ruleId: string, baseUrl: string) =>
  ['rule-runtime', ruleId, baseUrl] as const;

export type RuleAction =
  | 'deploy'
  | 'verify'
  | 'pause'
  | 'resume'
  | 'recover'
  | 'delete'
  | 'relay-on'
  | 'relay-off';

export const useRuleRuntime = (ruleId: string) => {
  const queryClient = useQueryClient();
  const rule = useRuleStore((state) =>
    state.items.find((candidate) => candidate.id === ruleId)
  );
  const plug = usePlugStore((state) =>
    state.items.find((candidate) => candidate.id === rule?.plugId)
  );
  const queryKey = ruleRuntimeQueryKey(ruleId, plug?.baseUrl ?? 'missing');
  const runtime = useQuery({
    queryKey,
    enabled: Boolean(rule?.deployment && plug),
    retry: false,
    queryFn: async () => {
      if (!rule || !plug) throw new Error('Rule devices are unavailable.');
      return rule.kind === 'climate'
        ? readClimateRuleRuntime(rule, plug)
        : readTimeRuleRuntime(rule, plug);
    }
  });
  const action = useMutation({
    mutationFn: async (kind: RuleAction) => {
      switch (kind) {
        case 'deploy':
          return deployRule(ruleId);
        case 'verify':
          return verifyRule(ruleId);
        case 'pause':
          return pauseRule(ruleId);
        case 'resume':
          return resumeRule(ruleId);
        case 'recover':
          return recoverRule(ruleId);
        case 'delete':
          return deleteRule(ruleId);
        case 'relay-on':
          return setRuleRelay(ruleId, true);
        case 'relay-off':
          return setRuleRelay(ruleId, false);
      }
    },
    onSettled: async (_data, _error, kind) => {
      if (kind === 'delete') {
        queryClient.removeQueries({ queryKey, exact: true });
      } else {
        await queryClient.invalidateQueries({ queryKey, exact: true });
      }
      await queryClient.invalidateQueries({ queryKey: ['plug-runtime'] });
    }
  });

  return { rule, plug, runtime, action, queryKey };
};

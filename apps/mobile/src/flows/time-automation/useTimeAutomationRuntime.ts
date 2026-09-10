import { useQuery } from '@tanstack/react-query';
import type { TimeInstalledAutomation } from '../installations/model.js';
import { readTimeAutomationRuntime } from './runtime.js';

export const timeAutomationRuntimeQueryKey = (installation: TimeInstalledAutomation) =>
  [
    'time-automation-runtime',
    installation.id,
    installation.shelly.baseUrl,
    installation.schedule.onJobId,
    installation.schedule.offJobId,
    installation.config.onTime,
    installation.config.offTime,
    installation.updatedAtMs
  ] as const;

export const useTimeAutomationRuntime = (
  installation: TimeInstalledAutomation,
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    queryKey: timeAutomationRuntimeQueryKey(installation),
    queryFn: () => readTimeAutomationRuntime(installation),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

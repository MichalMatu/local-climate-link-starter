import { RPC_METHODS, type ShellyRpcRequest } from '@lcl/shelly-client';
import { z } from 'zod';
import { createShellyTransport } from './shellyRequests.js';

const optionalMetric = z.number().nonnegative().nullable().optional();

const scriptResourceStatusSchema = z.object({
  running: z.boolean().nullable().optional(),
  mem_used: optionalMetric,
  mem_peak: optionalMetric,
  mem_free: optionalMetric,
  cpu: optionalMetric
});

const systemResourceStatusSchema = z.object({
  ram_size: optionalMetric,
  ram_free: optionalMetric
});

export type ShellyResourceDiagnostics = {
  script: {
    running: boolean | null;
    memUsedBytes: number | null;
    memPeakBytes: number | null;
    memFreeBytes: number | null;
    cpuPercent: number | null;
  } | null;
  system: {
    ramSizeBytes: number | null;
    ramFreeBytes: number | null;
  } | null;
};

const metricOrNull = (value: number | null | undefined): number | null => value ?? null;

const readPayload = async (
  transport: ReturnType<typeof createShellyTransport>,
  request: ShellyRpcRequest
): Promise<unknown | null> => {
  try {
    const result = await transport.call<unknown>(request);
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
};

export const readShellyResourceDiagnostics = async (
  baseUrl: string,
  scriptId: number
): Promise<ShellyResourceDiagnostics> => {
  const transport = createShellyTransport(baseUrl);
  const [scriptPayload, systemPayload] = await Promise.all([
    readPayload(transport, {
      method: RPC_METHODS.ScriptGetStatus,
      params: { id: scriptId }
    }),
    readPayload(transport, { method: RPC_METHODS.SysGetStatus })
  ]);

  const script = scriptResourceStatusSchema.safeParse(scriptPayload);
  const system = systemResourceStatusSchema.safeParse(systemPayload);

  return {
    script: script.success
      ? {
          running: script.data.running ?? null,
          memUsedBytes: metricOrNull(script.data.mem_used),
          memPeakBytes: metricOrNull(script.data.mem_peak),
          memFreeBytes: metricOrNull(script.data.mem_free),
          cpuPercent: metricOrNull(script.data.cpu)
        }
      : null,
    system: system.success
      ? {
          ramSizeBytes: metricOrNull(system.data.ram_size),
          ramFreeBytes: metricOrNull(system.data.ram_free)
        }
      : null
  };
};

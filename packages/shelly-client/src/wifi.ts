import { z } from 'zod';
import { RPC_METHODS, type Result, type ShellyRpcTransport } from './model.js';
import { validationError } from './rpc/errors.js';

const wifiStationConfigSchema = z
  .object({
    ssid: z.string().nullable(),
    enable: z.boolean(),
    is_open: z.boolean().optional(),
    ipv4mode: z.string().optional(),
    ip: z.string().nullable().optional()
  })
  .passthrough();

const wifiConfigSchema = z
  .object({
    sta: wifiStationConfigSchema,
    sta1: wifiStationConfigSchema.optional()
  })
  .passthrough();

const wifiStatusSchema = z
  .object({
    sta_ip: z.string().nullable().optional(),
    status: z.enum(['disconnected', 'connecting', 'connected', 'got ip']),
    ssid: z.string().nullable().optional(),
    rssi: z.number().optional()
  })
  .passthrough();

export type ShellyWifiStationConfig = z.infer<typeof wifiStationConfigSchema>;
export type ShellyWifiConfig = z.infer<typeof wifiConfigSchema>;
export type ShellyWifiStatus = z.infer<typeof wifiStatusSchema>;

export type ShellyWifiReadResult = {
  config: ShellyWifiConfig;
  status: ShellyWifiStatus;
};

const parseResponse = <T>(
  response: Result<unknown>,
  schema: z.ZodType<T>
): Result<T> => {
  if (!response.ok) {
    return response;
  }

  const parsed = schema.safeParse(response.value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: validationError(parsed.error.message) };
};

export class RpcShellyWifiClient {
  constructor(private readonly transport: ShellyRpcTransport) {}

  async read(): Promise<Result<ShellyWifiReadResult>> {
    const config = parseResponse(
      await this.transport.call<unknown>({ method: RPC_METHODS.WifiGetConfig }),
      wifiConfigSchema
    );
    if (!config.ok) {
      return config;
    }

    const status = parseResponse(
      await this.transport.call<unknown>({ method: RPC_METHODS.WifiGetStatus }),
      wifiStatusSchema
    );
    if (!status.ok) {
      return status;
    }

    return {
      ok: true,
      value: {
        config: config.value,
        status: status.value
      }
    };
  }
}

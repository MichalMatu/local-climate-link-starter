import { z } from 'zod';
import { RPC_METHODS, type Result, type ShellyRpcTransport } from './model.js';

const listMethodsResponseSchema = z.object({
  methods: z.array(z.string())
});
const cloudConfigSchema = z.object({
  enable: z.boolean(),
  server: z.string().nullable()
});
const cloudStatusSchema = z.object({
  connected: z.boolean()
});
const setConfigResponseSchema = z.object({
  restart_required: z.boolean()
});

export type ShellyCloudConfig = z.infer<typeof cloudConfigSchema>;
export type ShellyCloudStatus = z.infer<typeof cloudStatusSchema>;
export type ShellyCloudSetResult = z.infer<typeof setConfigResponseSchema>;
export type ShellyCloudReadResult =
  | { supported: false }
  | {
      supported: true;
      config: ShellyCloudConfig;
      status: ShellyCloudStatus;
    };

const validationError = (message: string) => ({
  kind: 'validation-failed' as const,
  userMessageKey: 'errors.validationFailed',
  technicalMessage: message,
  retryable: false
});

const parseSetConfigResponse = (
  response: Result<unknown>
): Result<ShellyCloudSetResult> => {
  if (!response.ok) {
    return response;
  }
  const parsed = setConfigResponseSchema.safeParse(response.value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: validationError(parsed.error.message) };
};

export class RpcShellyCloudClient {
  constructor(private readonly transport: ShellyRpcTransport) {}

  private async readWithRequirements(
    requireWrite: boolean
  ): Promise<Result<ShellyCloudReadResult>> {
    const methodsResponse = await this.transport.call<unknown>({
      method: RPC_METHODS.ShellyListMethods
    });
    if (!methodsResponse.ok) {
      return methodsResponse;
    }

    const parsedMethods = listMethodsResponseSchema.safeParse(methodsResponse.value);
    if (!parsedMethods.success) {
      return { ok: false, error: validationError(parsedMethods.error.message) };
    }

    const methods = parsedMethods.data.methods;
    const canRead =
      methods.includes(RPC_METHODS.CloudGetConfig) &&
      methods.includes(RPC_METHODS.CloudGetStatus);
    const canWrite = methods.includes(RPC_METHODS.CloudSetConfig);
    if (!canRead || (requireWrite && !canWrite)) {
      return { ok: true, value: { supported: false } };
    }

    const configResponse = await this.transport.call<unknown>({
      method: RPC_METHODS.CloudGetConfig
    });
    if (!configResponse.ok) {
      return configResponse;
    }
    const parsedConfig = cloudConfigSchema.safeParse(configResponse.value);
    if (!parsedConfig.success) {
      return { ok: false, error: validationError(parsedConfig.error.message) };
    }

    const statusResponse = await this.transport.call<unknown>({
      method: RPC_METHODS.CloudGetStatus
    });
    if (!statusResponse.ok) {
      return statusResponse;
    }
    const parsedStatus = cloudStatusSchema.safeParse(statusResponse.value);
    if (!parsedStatus.success) {
      return { ok: false, error: validationError(parsedStatus.error.message) };
    }

    return {
      ok: true,
      value: {
        supported: true,
        config: parsedConfig.data,
        status: parsedStatus.data
      }
    };
  }

  async readConfig(): Promise<Result<ShellyCloudReadResult>> {
    return this.readWithRequirements(false);
  }

  async read(): Promise<Result<ShellyCloudReadResult>> {
    return this.readWithRequirements(true);
  }

  async setEnabled(enabled: boolean): Promise<Result<ShellyCloudSetResult>> {
    const parsedEnabled = z.boolean().safeParse(enabled);
    if (!parsedEnabled.success) {
      return { ok: false, error: validationError(parsedEnabled.error.message) };
    }

    return parseSetConfigResponse(
      await this.transport.call<unknown>({
        method: RPC_METHODS.CloudSetConfig,
        params: {
          config: {
            enable: parsedEnabled.data
          }
        }
      })
    );
  }
}

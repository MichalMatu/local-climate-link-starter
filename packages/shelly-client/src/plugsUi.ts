import { z } from 'zod';
import { RPC_METHODS, type Result, type ShellyRpcTransport } from './model.js';

const percentSchema = z.number().min(0).max(100);
const rgbSchema = z.tuple([percentSchema, percentSchema, percentSchema]).nullable();
const ledColorSchema = z.object({
  rgb: rgbSchema,
  brightness: percentSchema
});
const switchColorsSchema = z.object({
  on: ledColorSchema,
  off: ledColorSchema
});
const ledColorsSchema = z.object({
  'switch:0': switchColorsSchema.optional(),
  power: z.object({ brightness: percentSchema }).optional()
});
const ledModeSchema = z.enum(['power', 'switch', 'off']);
const ledsConfigSchema = z.object({
  mode: ledModeSchema,
  colors: ledColorsSchema.optional()
});
const ledsPatchSchema = z
  .object({
    mode: ledModeSchema.optional(),
    colors: ledColorsSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PLUGS_UI LED patch requires at least one field.'
  });
const plugsUiConfigSchema = z.object({
  leds: ledsConfigSchema
});
const listMethodsResponseSchema = z.object({
  methods: z.array(z.string())
});
const setConfigResponseSchema = z.object({
  restart_required: z.boolean()
});

export type ShellyPlugsUiLedMode = z.infer<typeof ledModeSchema>;
export type ShellyPlugsUiLedColor = z.infer<typeof ledColorSchema>;
export type ShellyPlugsUiLedsConfig = z.infer<typeof ledsConfigSchema>;
export type ShellyPlugsUiLedsPatch = z.input<typeof ledsPatchSchema>;
export type ShellyPlugsUiConfig = z.infer<typeof plugsUiConfigSchema>;
export type ShellyPlugsUiSetResult = z.infer<typeof setConfigResponseSchema>;
export type ShellyPlugsUiReadResult =
  { supported: false } | { supported: true; config: ShellyPlugsUiConfig };

const validationError = (message: string) => ({
  kind: 'validation-failed' as const,
  userMessageKey: 'errors.validationFailed',
  technicalMessage: message,
  retryable: false
});

export const createRelayStateLedPatch = (): ShellyPlugsUiLedsPatch => ({
  mode: 'switch',
  colors: {
    'switch:0': {
      on: { rgb: [0, 100, 0], brightness: 100 },
      off: { rgb: [100, 0, 0], brightness: 100 }
    }
  }
});

export const createLedOffPatch = (): ShellyPlugsUiLedsPatch => ({
  mode: 'off'
});

export class RpcShellyPlugsUiClient {
  constructor(private readonly transport: ShellyRpcTransport) {}

  async read(): Promise<Result<ShellyPlugsUiReadResult>> {
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

    const canRead = parsedMethods.data.methods.includes(RPC_METHODS.PlugsUiGetConfig);
    const canWrite = parsedMethods.data.methods.includes(RPC_METHODS.PlugsUiSetConfig);
    if (!canRead || !canWrite) {
      return { ok: true, value: { supported: false } };
    }

    const configResponse = await this.transport.call<unknown>({
      method: RPC_METHODS.PlugsUiGetConfig
    });
    if (!configResponse.ok) {
      return configResponse;
    }

    const parsedConfig = plugsUiConfigSchema.safeParse(configResponse.value);
    return parsedConfig.success
      ? { ok: true, value: { supported: true, config: parsedConfig.data } }
      : { ok: false, error: validationError(parsedConfig.error.message) };
  }

  async setLeds(patch: ShellyPlugsUiLedsPatch): Promise<Result<ShellyPlugsUiSetResult>> {
    const parsedPatch = ledsPatchSchema.safeParse(patch);
    if (!parsedPatch.success) {
      return { ok: false, error: validationError(parsedPatch.error.message) };
    }

    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.PlugsUiSetConfig,
      params: {
        config: {
          leds: parsedPatch.data
        }
      }
    });
    if (!response.ok) {
      return response;
    }

    const parsedResponse = setConfigResponseSchema.safeParse(response.value);
    return parsedResponse.success
      ? { ok: true, value: parsedResponse.data }
      : { ok: false, error: validationError(parsedResponse.error.message) };
  }
}

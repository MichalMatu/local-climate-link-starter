import { z } from 'zod';
import { RPC_METHODS, type Result, type ShellyRpcTransport } from './model.js';

const percentSchema = z.number().min(0).max(100);
const rgbSchema = z.tuple([percentSchema, percentSchema, percentSchema]).nullable();
const clockTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM time.');

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
const nightModeSchema = z.object({
  enable: z.boolean(),
  brightness: percentSchema,
  active_between: z.union([z.tuple([]), z.tuple([clockTimeSchema, clockTimeSchema])])
});
const ledModeSchema = z.enum(['power', 'switch', 'off']);
const ledsConfigSchema = z.object({
  mode: ledModeSchema,
  colors: ledColorsSchema.optional(),
  night_mode: nightModeSchema.optional()
});
const buttonInputModeSchema = z.enum(['momentary', 'detached']);
const controlsConfigSchema = z.object({
  'switch:0': z.object({ in_mode: buttonInputModeSchema }).optional()
});

const nonEmptyObject = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  message: string
) => schema.refine((value) => Object.keys(value).length > 0, { message });

const ledColorPatchSchema = nonEmptyObject(
  z.object({
    rgb: rgbSchema.optional(),
    brightness: percentSchema.optional()
  }),
  'LED color patch requires at least one field.'
);
const switchColorsPatchSchema = nonEmptyObject(
  z.object({
    on: ledColorPatchSchema.optional(),
    off: ledColorPatchSchema.optional()
  }),
  'Switch LED colors patch requires at least one field.'
);
const ledColorsPatchSchema = nonEmptyObject(
  z.object({
    'switch:0': switchColorsPatchSchema.optional(),
    power: nonEmptyObject(
      z.object({ brightness: percentSchema.optional() }),
      'Power LED patch requires brightness.'
    ).optional()
  }),
  'LED colors patch requires at least one field.'
);
const nightModePatchSchema = nonEmptyObject(
  z.object({
    enable: z.boolean().optional(),
    brightness: percentSchema.optional(),
    active_between: z.tuple([clockTimeSchema, clockTimeSchema]).optional()
  }),
  'Night mode patch requires at least one field.'
);
const ledsPatchSchema = nonEmptyObject(
  z.object({
    mode: ledModeSchema.optional(),
    colors: ledColorsPatchSchema.optional(),
    night_mode: nightModePatchSchema.optional()
  }),
  'PLUGS_UI LED patch requires at least one field.'
);
const plugsUiConfigSchema = z.object({
  leds: ledsConfigSchema,
  controls: controlsConfigSchema.optional()
});
const listMethodsResponseSchema = z.object({
  methods: z.array(z.string())
});
const setConfigResponseSchema = z.object({
  restart_required: z.boolean()
});

export type ShellyPlugsUiLedMode = z.infer<typeof ledModeSchema>;
export type ShellyPlugsUiLedColor = z.infer<typeof ledColorSchema>;
export type ShellyPlugsUiNightMode = z.infer<typeof nightModeSchema>;
export type ShellyPlugsUiLedsConfig = z.infer<typeof ledsConfigSchema>;
export type ShellyPlugsUiLedsPatch = z.input<typeof ledsPatchSchema>;
export type ShellyPlugsUiButtonInputMode = z.infer<typeof buttonInputModeSchema>;
export type ShellyPlugsUiControlsConfig = z.infer<typeof controlsConfigSchema>;
export type ShellyPlugsUiConfig = z.infer<typeof plugsUiConfigSchema>;
export type ShellyPlugsUiSetResult = z.infer<typeof setConfigResponseSchema>;
export type ShellyPlugsUiLedCapabilities = {
  switchColors: boolean;
  powerBrightness: boolean;
  nightMode: boolean;
};
export type ShellyPlugsUiControlCapabilities = {
  buttonInputMode: boolean;
};
export type ShellyPlugsUiReadResult =
  | { supported: false }
  | {
      supported: true;
      config: ShellyPlugsUiConfig;
      capabilities: ShellyPlugsUiLedCapabilities;
      controlCapabilities: ShellyPlugsUiControlCapabilities;
    };

const validationError = (message: string) => ({
  kind: 'validation-failed' as const,
  userMessageKey: 'errors.validationFailed',
  technicalMessage: message,
  retryable: false
});

const ledCapabilities = (config: ShellyPlugsUiConfig): ShellyPlugsUiLedCapabilities => ({
  switchColors: config.leds.colors?.['switch:0'] !== undefined,
  powerBrightness: config.leds.colors?.power?.brightness !== undefined,
  nightMode: config.leds.night_mode !== undefined
});

const controlCapabilities = (
  config: ShellyPlugsUiConfig
): ShellyPlugsUiControlCapabilities => ({
  buttonInputMode: config.controls?.['switch:0']?.in_mode !== undefined
});

const parseSetConfigResponse = (
  response: Result<unknown>
): Result<ShellyPlugsUiSetResult> => {
  if (!response.ok) {
    return response;
  }
  const parsedResponse = setConfigResponseSchema.safeParse(response.value);
  return parsedResponse.success
    ? { ok: true, value: parsedResponse.data }
    : { ok: false, error: validationError(parsedResponse.error.message) };
};

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
      ? {
          ok: true,
          value: {
            supported: true,
            config: parsedConfig.data,
            capabilities: ledCapabilities(parsedConfig.data),
            controlCapabilities: controlCapabilities(parsedConfig.data)
          }
        }
      : { ok: false, error: validationError(parsedConfig.error.message) };
  }

  async setLeds(patch: ShellyPlugsUiLedsPatch): Promise<Result<ShellyPlugsUiSetResult>> {
    const parsedPatch = ledsPatchSchema.safeParse(patch);
    if (!parsedPatch.success) {
      return { ok: false, error: validationError(parsedPatch.error.message) };
    }

    return parseSetConfigResponse(
      await this.transport.call<unknown>({
        method: RPC_METHODS.PlugsUiSetConfig,
        params: {
          config: {
            leds: parsedPatch.data
          }
        }
      })
    );
  }

  async setButtonInputMode(
    mode: ShellyPlugsUiButtonInputMode
  ): Promise<Result<ShellyPlugsUiSetResult>> {
    const parsedMode = buttonInputModeSchema.safeParse(mode);
    if (!parsedMode.success) {
      return { ok: false, error: validationError(parsedMode.error.message) };
    }

    return parseSetConfigResponse(
      await this.transport.call<unknown>({
        method: RPC_METHODS.PlugsUiSetConfig,
        params: {
          config: {
            controls: {
              'switch:0': {
                in_mode: parsedMode.data
              }
            }
          }
        }
      })
    );
  }
}

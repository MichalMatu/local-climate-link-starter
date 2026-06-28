import { defaultRuleForPreset, type RulePresetId } from '@lcl/automation-core';
import { outputProfileIdSchema, sensorProfileIdSchema } from '@lcl/device-profiles';
import { z } from 'zod';

export const GENERATOR_VERSION = '0.1.0';

const shellyRuntimeAddressSchema = z
  .string()
  .trim()
  .regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i, 'Invalid Shelly runtime address.')
  .transform((value) => value.toUpperCase());

const ruleControlMetricSchema = z.enum(['temperature', 'humidity']);
const thresholdDirectionSchema = z.enum(['below', 'above']);

export const shellyThermostatConfigSchema = z
  .object({
    version: z.literal(1),
    sensor: z.object({
      profileId: sensorProfileIdSchema,
      sensorId: z.string().min(1),
      runtimeAddress: shellyRuntimeAddressSchema,
      displayName: z.string().min(1),
      parserValidated: z.boolean().default(false)
    }),
    output: z.object({
      profileId: outputProfileIdSchema,
      relayId: z.number().int().min(0).default(0)
    }),
    rule: z.object({
      mode: z.enum(['heating', 'cooling', 'humidifying', 'dehumidifying']),
      control: z.object({
        metric: ruleControlMetricSchema,
        direction: thresholdDirectionSchema,
        onThreshold: z.number(),
        offThreshold: z.number()
      }),
      vpdAssist: z.object({
        enabled: z.boolean(),
        targetKpa: z.number().positive().max(5)
      }),
      staleTimeoutSec: z.number().int().positive(),
      minChangeMs: z.number().int().positive(),
      maxOnMs: z.number().int().positive(),
      rssiMin: z.number().int().min(-100).max(-20),
      consecutiveHits: z.number().int().min(1).max(10).default(2),
      failSafe: z.literal('off'),
      bootState: z.literal('off')
    }),
    diagnostics: z.object({
      enabled: z.boolean().default(true)
    })
  })
  .superRefine((config, context) => {
    const { control } = config.rule;
    const thresholdsAreInvalid =
      control.direction === 'below'
        ? control.onThreshold >= control.offThreshold
        : control.onThreshold <= control.offThreshold;

    if (thresholdsAreInvalid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rule', 'control', 'onThreshold'],
        message:
          control.direction === 'below'
            ? 'onThreshold must be lower than offThreshold.'
            : 'onThreshold must be higher than offThreshold.'
      });
    }
  });

export type ShellyThermostatConfig = z.infer<typeof shellyThermostatConfigSchema>;

export const createDefaultShellyThermostatConfig = (
  sensorProfileId: ShellyThermostatConfig['sensor']['profileId'] = 'xiaomi_lywsd03mmc_bthome_v2',
  preset: RulePresetId = 'heating'
): ShellyThermostatConfig => {
  const defaultRule = defaultRuleForPreset(preset);

  return {
    version: 1,
    sensor: {
      profileId: sensorProfileId,
      sensorId:
        sensorProfileId === 'tp357_custom_v1' ? 'demo-tp357' : 'demo-xiaomi-bthome',
      runtimeAddress:
        sensorProfileId === 'tp357_custom_v1' ? '11:22:33:44:55:66' : 'AA:BB:CC:DD:EE:FF',
      displayName:
        sensorProfileId === 'tp357_custom_v1' ? 'TP357 demo' : 'Xiaomi LYWSD03MMC demo',
      parserValidated: true
    },
    output: {
      profileId: 'shelly_plug_s_gen3',
      relayId: 0
    },
    rule: {
      mode: defaultRule.mode,
      control: {
        ...defaultRule.control
      },
      vpdAssist: {
        ...defaultRule.vpdAssist
      },
      staleTimeoutSec: defaultRule.staleTimeoutSec,
      minChangeMs: defaultRule.minChangeMs,
      maxOnMs: defaultRule.maxOnMs,
      rssiMin: defaultRule.rssiMin,
      consecutiveHits: defaultRule.consecutiveHits,
      failSafe: 'off',
      bootState: 'off'
    },
    diagnostics: {
      enabled: true
    }
  };
};

export const normalizeConfig = (input: unknown): ShellyThermostatConfig =>
  shellyThermostatConfigSchema.parse(input);

import { climateSettingsSchema } from './climateSettings.js';
import { defaultRuleForPreset, type RulePresetId } from '@lcl/automation-core';
import { outputProfileIdSchema, sensorProfileIdSchema } from '@lcl/device-profiles';
import { z } from 'zod';

export const GENERATOR_VERSION = '0.2.0';

const shellyRuntimeAddressSchema = z
  .string()
  .trim()
  .regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i, 'Invalid Shelly runtime address.')
  .transform((value) => value.toUpperCase());

export const shellyThermostatConfigSchema = climateSettingsSchema
  .innerType()
  .extend({
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
    })
  })
  .superRefine((config, context) => {
    const settings = climateSettingsSchema.safeParse({
      rule: config.rule,
      diagnostics: config.diagnostics
    });
    if (!settings.success) {
      for (const issue of settings.error.issues) context.addIssue(issue);
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

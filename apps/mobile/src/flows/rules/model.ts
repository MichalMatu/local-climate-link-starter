import { climateSettingsSchema } from '@lcl/script-generator';
import { z } from 'zod';
import { plugIdSchema } from '../devices/plugs/model.js';
import { dailyTimeSettingsSchema } from '../time-automation/config.js';

const baseRuleSchema = z.object({
  version: z.literal(1),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  plugId: plugIdSchema,
  relayId: z.literal(0),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative()
});

const safetyTestSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }).strict(),
  z
    .object({ status: z.literal('failed'), failedAtMs: z.number().int().nonnegative() })
    .strict(),
  z
    .object({
      status: z.literal('verified'),
      verifiedAtMs: z.number().int().nonnegative()
    })
    .strict()
]);

export const climateRuleSchema = baseRuleSchema
  .extend({
    kind: z.literal('climate'),
    sensorId: z.string().trim().min(1),
    config: climateSettingsSchema,
    deployment: z
      .object({
        scriptId: z.number().int().nonnegative(),
        scriptHash: z.string().trim().min(1),
        safetyTest: safetyTestSchema
      })
      .strict()
      .nullable()
  })
  .strict();

export const timeRuleSchema = baseRuleSchema
  .extend({
    kind: z.literal('time'),
    config: dailyTimeSettingsSchema,
    deployment: z
      .object({
        onJobId: z.number().int().nonnegative(),
        offJobId: z.number().int().nonnegative()
      })
      .strict()
      .refine((deployment) => deployment.onJobId !== deployment.offJobId)
      .nullable()
  })
  .strict();

export const automationRuleSchema = z.discriminatedUnion('kind', [
  climateRuleSchema,
  timeRuleSchema
]);
export type ClimateRule = z.infer<typeof climateRuleSchema>;
export type TimeRule = z.infer<typeof timeRuleSchema>;
export type AutomationRule = z.infer<typeof automationRuleSchema>;
